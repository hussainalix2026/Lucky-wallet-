import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import admin from 'firebase-admin';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const db = admin.firestore();

// Helper for referral bonuses
async function awardReferralBonus(uid: string, transaction: admin.firestore.Transaction) {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await transaction.get(userRef);
  const userData = userDoc.data();

  if (userData && userData.referredBy && !userData.hasReceivedReferralBonus) {
    const settingsSnap = await db.collection('settings').doc('global').get();
    const referralSettings = settingsSnap.data()?.referralBonus || { referrer: 50, referee: 20 };

    // Credit Referee
    transaction.update(userRef, { 
      balance: admin.firestore.FieldValue.increment(referralSettings.referee),
      hasReceivedReferralBonus: true 
    });
    // Add transaction for referee
    const refereeTxRef = db.collection('transactions').doc();
    transaction.set(refereeTxRef, {
      uid,
      amount: referralSettings.referee,
      type: 'Referral Bonus',
      status: 'Success',
      createdAt: new Date().toISOString(),
      description: 'Welcome bonus for joining via referral'
    });

    // Credit Referrer
    const referrerRef = db.collection('users').doc(userData.referredBy);
    transaction.update(referrerRef, { balance: admin.firestore.FieldValue.increment(referralSettings.referrer) });
    // Add transaction for referrer
    const referrerTxRef = db.collection('transactions').doc();
    transaction.set(referrerTxRef, {
      uid: userData.referredBy,
      amount: referralSettings.referrer,
      type: 'Referral Bonus',
      status: 'Success',
      createdAt: new Date().toISOString(),
      description: `Bonus for referring ${userData.fullName}`
    });
  }
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24-preview' as any,
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook (MUST be before express.json())
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { uid, type, amount, number, drawDate, winningAmount } = paymentIntent.metadata;

      try {
        if (type === 'deposit') {
          // Update user balance
          const userRef = db.collection('users').doc(uid);
          await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('User not found');
            const newBalance = (userDoc.data()?.balance || 0) + parseFloat(amount);
            transaction.update(userRef, { balance: newBalance });
            await awardReferralBonus(uid, transaction);
          });

          // Create transaction record
          await db.collection('transactions').add({
            uid,
            amount: parseFloat(amount),
            type: 'Deposit',
            status: 'Success',
            createdAt: new Date().toISOString(),
            stripePaymentIntentId: paymentIntent.id,
            paymentMethod: 'Stripe',
          });
        } else if (type === 'purchase') {
          const numbers = number.split(',').map((n: string) => parseInt(n));
          await db.runTransaction(async (transaction) => {
            for (const num of numbers) {
              // Create purchase record
              const purchaseRef = db.collection('purchasedNumbers').doc();
              transaction.set(purchaseRef, {
                uid,
                number: num,
                amount: parseFloat(amount) / numbers.length, // Split total amount among numbers
                winningAmount: parseFloat(winningAmount),
                status: 'Pending',
                drawDate,
                createdAt: new Date().toISOString(),
                stripePaymentIntentId: paymentIntent.id,
              });
            }
            await awardReferralBonus(uid, transaction);
          });

          // Create transaction record (optional, for history)
          await db.collection('transactions').add({
            uid,
            amount: parseFloat(amount),
            type: 'Purchase',
            status: 'Success',
            createdAt: new Date().toISOString(),
            stripePaymentIntentId: paymentIntent.id,
            paymentMethod: 'Stripe',
          });
        }
      } catch (err) {
        console.error('Error processing payment success:', err);
      }
    }

    res.json({ received: true });
  });

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post('/api/create-payment-intent', async (req, res) => {
    const { amount, uid, type, metadata } = req.body;

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects cents
        currency: 'inr',
        metadata: {
          uid,
          type,
          amount: amount.toString(),
          ...metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Razorpay Routes
  app.post('/api/razorpay/create-order', async (req, res) => {
    const { amount, uid, type, metadata } = req.body;

    try {
      const options = {
        amount: Math.round(amount * 100), // Razorpay expects paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: {
          uid,
          type,
          amount: amount.toString(),
          ...metadata,
        },
      };

      const order = await razorpay.orders.create(options);
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/razorpay/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      try {
        // Fetch order details to get metadata
        const order = await razorpay.orders.fetch(razorpay_order_id);
        const { uid, type, amount, number, drawDate, winningAmount } = order.notes as any;

        if (type === 'deposit') {
          const userRef = db.collection('users').doc(uid);
          await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('User not found');
            const newBalance = (userDoc.data()?.balance || 0) + parseFloat(amount);
            transaction.update(userRef, { balance: newBalance });
            await awardReferralBonus(uid, transaction);
          });

          await db.collection('transactions').add({
            uid,
            amount: parseFloat(amount),
            type: 'Deposit',
            status: 'Success',
            createdAt: new Date().toISOString(),
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            paymentMethod: 'Razorpay',
          });
        } else if (type === 'purchase') {
          const numbers = number.split(',').map((n: string) => parseInt(n));
          await db.runTransaction(async (transaction) => {
            for (const num of numbers) {
              const purchaseRef = db.collection('purchasedNumbers').doc();
              transaction.set(purchaseRef, {
                uid,
                number: num,
                amount: parseFloat(amount) / numbers.length,
                winningAmount: parseFloat(winningAmount),
                status: 'Pending',
                drawDate,
                createdAt: new Date().toISOString(),
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
              });
            }
            await awardReferralBonus(uid, transaction);
          });

          await db.collection('transactions').add({
            uid,
            amount: parseFloat(amount),
            type: 'Purchase',
            status: 'Success',
            createdAt: new Date().toISOString(),
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            paymentMethod: 'Razorpay',
          });
        }

        res.json({ status: 'ok' });
      } catch (err: any) {
        console.error('Error processing Razorpay success:', err);
        res.status(500).json({ error: err.message });
      }
    } else {
      res.status(400).json({ status: 'invalid signature' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

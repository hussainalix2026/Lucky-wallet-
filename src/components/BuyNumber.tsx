import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, writeBatch, getDocs, query, where, increment, onSnapshot } from 'firebase/firestore';
import { UserData } from '../App';
import { Ticket, ChevronLeft, CheckCircle2, AlertCircle, Info, QrCode, Loader2, CreditCard, Sparkles, Zap, Target, ShieldCheck, Copy, ExternalLink, Wallet as WalletIcon, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import StripePayment from './StripePayment';
import RazorpayPayment from './RazorpayPayment';

interface BuyNumberProps {
  userData: UserData | null;
  onBack: () => void;
  prefillData?: { number: number, investment: number } | null;
}

const INVESTMENT_TIERS = [
  { amount: 10, label: 'Micro', icon: Zap, color: 'from-amber-500 to-orange-600', reward: 1200 },
  { amount: 30, label: 'Basic', icon: Target, color: 'from-blue-400 to-cyan-600', reward: 4000 },
  { amount: 100, label: 'Starter', icon: Zap, color: 'from-blue-500 to-indigo-600', reward: 12000 },
  { amount: 500, label: 'Pro', icon: Target, color: 'from-emerald-500 to-teal-600', reward: 60000 },
  { amount: 1000, label: 'Elite', icon: Sparkles, color: 'from-purple-500 to-pink-600', reward: 120000 },
  { amount: 5000, label: 'Whale', icon: ShieldCheck, color: 'from-orange-500 to-red-600', reward: 600000 },
];

export default function BuyNumber({ userData, onBack, prefillData }: BuyNumberProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>(prefillData ? [prefillData.number] : []);
  const [investment, setInvestment] = useState(prefillData ? prefillData.investment : 10);
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [razorpayOrder, setRazorpayOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'razorpay' | 'upi' | 'wallet'>('wallet');
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [activeMerchantName, setActiveMerchantName] = useState('Digital Services');

  const merchantNames = [
    'Digital Services', 'Fast Checkout', 'Global Payments', 'Reliable Pay',
    'Instant Settlement', 'Skyline Ventures', 'V-Care Payments', 'Zenith Solutions',
    'Apex Enterprises', 'Nexus Digital', 'Prime Secure', 'Orbit Payments',
    'Stellar Services', 'Nova Traders', 'Core Fintech', 'Pulse Digitals',
    'Quantum Pay', 'Ultra Transact', 'Rapid Settle', 'Glance Services'
  ];

  React.useEffect(() => {
    const randomName = merchantNames[Math.floor(Math.random() * merchantNames.length)];
    setActiveMerchantName(randomName);
  }, [showPayment]);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
    return () => unsub();
  }, []);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setMessage({ type: 'error', text: 'Screenshot must be less than 500KB' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const totalAmount = selectedNumbers.length * investment;

  const toggleNumber = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      if (selectedNumbers.length >= 10) {
        setMessage({ type: 'error', text: 'Maximum 10 numbers per ticket' });
        return;
      }
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || selectedNumbers.length === 0) return;

    setLoading(true);
    try {
      const drawDate = new Date().toISOString().split('T')[0];
      const totalAmount = selectedNumbers.length * investment;
      const winningAmount = INVESTMENT_TIERS.find(opt => opt.amount === investment)?.reward || 0;

      if (paymentMethod === 'stripe') {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            uid: userData.uid,
            type: 'purchase',
            metadata: {
              number: selectedNumbers.join(','),
              drawDate,
              winningAmount: winningAmount.toString(),
            },
          }),
        });

        if (!response.ok) throw new Error('Failed to create payment intent');
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } else if (paymentMethod === 'razorpay') {
        const response = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            uid: userData.uid,
            type: 'purchase',
            metadata: {
              number: selectedNumbers.join(','),
              drawDate,
              winningAmount: winningAmount.toString(),
            },
          }),
        });

        if (!response.ok) throw new Error('Failed to create Razorpay order');
        const data = await response.json();
        setRazorpayOrder(data);
      } else if (paymentMethod === 'wallet') {
        if (userData.balance < totalAmount) {
          setMessage({ type: 'error', text: 'Insufficient balance. Please top up your wallet.' });
          return;
        }

        const batch = writeBatch(db);
        
        // Deduct balance
        const userRef = doc(db, 'users', userData.uid);
        batch.update(userRef, { balance: userData.balance - totalAmount });

        // Create purchase records
        for (const num of selectedNumbers) {
          const purchaseRef = doc(collection(db, 'purchasedNumbers'));
          batch.set(purchaseRef, {
            uid: userData.uid,
            number: num,
            amount: investment,
            winningAmount,
            status: 'Pending',
            drawDate,
            createdAt: new Date().toISOString(),
            paymentMethod: 'Wallet'
          });
        }

        // Create transaction record
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          uid: userData.uid,
          amount: totalAmount,
          type: 'Purchase',
          status: 'Success',
          paymentMethod: 'Wallet',
          createdAt: new Date().toISOString(),
        });

        // Referral Bonus Logic
        if (userData.referredBy && !userData.hasReceivedReferralBonus) {
          // Get referral bonus settings
          const settingsSnap = await getDocs(query(collection(db, 'settings'), where('__name__', '==', 'global'))).then(s => s.docs[0]);
          const referralSettings = settingsSnap?.data()?.referralBonus || { referrer: 50, referee: 20 };

          // Credit Referee
          batch.update(userRef, { 
            balance: increment(referralSettings.referee),
            hasReceivedReferralBonus: true 
          });
          // Add transaction for referee
          const refereeTxRef = doc(collection(db, 'transactions'));
          batch.set(refereeTxRef, {
            uid: userData.uid,
            amount: referralSettings.referee,
            type: 'Referral Bonus',
            status: 'Success',
            createdAt: new Date().toISOString(),
            description: 'Welcome bonus for joining via referral'
          });

          // Credit Referrer
          const referrerRef = doc(db, 'users', userData.referredBy);
          batch.update(referrerRef, { balance: increment(referralSettings.referrer) });
          // Add transaction for referrer
          const referrerTxRef = doc(collection(db, 'transactions'));
          batch.set(referrerTxRef, {
            uid: userData.referredBy,
            amount: referralSettings.referrer,
            type: 'Referral Bonus',
            status: 'Success',
            createdAt: new Date().toISOString(),
            description: `Bonus for referring ${userData.fullName}`
          });
        }

        await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'purchase-wallet'));

        setMessage({ type: 'success', text: 'Numbers purchased successfully using wallet balance!' });
        setSelectedNumbers([]);
        setShowPayment(false);
      } else if (paymentMethod === 'upi') {
        if (!utr) {
          setMessage({ type: 'error', text: 'Please enter Transaction ID (UTR).' });
          return;
        }

        const batch = writeBatch(db);
        const numbers = selectedNumbers;
        for (const num of numbers) {
          const purchaseRef = doc(collection(db, 'purchasedNumbers'));
          batch.set(purchaseRef, {
            uid: userData.uid,
            number: num,
            amount: investment,
            winningAmount,
            status: 'Pending',
            drawDate,
            createdAt: new Date().toISOString(),
            utr: utr,
            screenshot: screenshot,
            paymentMethod: 'Manual UPI'
          });
        }

        // Create a pending transaction record for the admin to see
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          uid: userData.uid,
          amount: totalAmount,
          type: 'Deposit', // We treat it as a deposit + auto-purchase once approved
          status: 'Pending',
          utr: utr,
          screenshot: screenshot,
          paymentMethod: 'Manual UPI',
          isDirectPurchase: true,
          purchaseDetails: {
            numbers: selectedNumbers,
            investment,
            drawDate
          },
          createdAt: new Date().toISOString(),
        });

        await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'batch-purchase-upi'));

        setMessage({ type: 'success', text: 'Purchase request submitted! Admin will verify and activate your tickets.' });
        setSelectedNumbers([]);
        setShowPayment(false);
        setUtr('');
        setScreenshot(null);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to initialize payment.' });
    } finally {
      setLoading(false);
    }
  };

  if (!userData) return null;

  return (
    <div className="p-6 space-y-8 pb-32 bg-zinc-950 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-xl transition-colors border border-zinc-800">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight font-display">Lucky Ticket</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Select your winning numbers</p>
        </div>
      </div>

      {/* Step 1: Number Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Number Grid
          </h3>
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{selectedNumbers.length}/10</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 max-h-[320px] overflow-y-auto p-4 bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-inner custom-scrollbar">
          {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              onClick={() => toggleNumber(num)}
              className={`aspect-square rounded-xl font-black text-sm transition-all duration-300 relative overflow-hidden ${
                selectedNumbers.includes(num)
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-90'
                  : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 border border-zinc-800'
              }`}
            >
              {num}
              {selectedNumbers.includes(num) && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1.5 }}
                  className="absolute inset-0 bg-white/20 rounded-full blur-xl"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Investment Tiers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-orange-500" />
            Investment Tier
          </h3>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Per Number</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {INVESTMENT_TIERS.map(tier => (
            <button
              key={tier.amount}
              onClick={() => setInvestment(tier.amount)}
              className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 relative overflow-hidden group ${
                investment === tier.amount
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3 relative z-10">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${tier.color} shadow-lg`}>
                  <tier.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{tier.label}</p>
                  <p className="text-lg font-black text-white font-display">₹{tier.amount}</p>
                </div>
              </div>
              <p className="text-[9px] font-bold opacity-60 mt-2">Potential Win: ₹{tier.reward.toLocaleString()}</p>
              {investment === tier.amount && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Purchase Summary */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 space-y-4 shadow-xl">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Total Investment</span>
              <p className="text-2xl font-black tracking-tighter text-white font-display">₹{selectedNumbers.length * investment}</p>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Potential Win</span>
              <p className="text-xl font-black tracking-tighter text-emerald-500 font-display">₹{(selectedNumbers.length * (INVESTMENT_TIERS.find(opt => opt.amount === investment)?.reward || 0)).toLocaleString()}</p>
            </div>
          </div>
          
          <button 
            disabled={selectedNumbers.length === 0}
            onClick={() => setShowPayment(true)}
            className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 shimmer"
          >
            <CreditCard className="w-5 h-5" />
            Place Order
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayment && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowPayment(false); setClientSecret(null); }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden border border-zinc-800"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight font-display">Checkout</h2>
                <button onClick={() => { setShowPayment(false); setClientSecret(null); setRazorpayOrder(null); }} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <ChevronLeft className="w-6 h-6 rotate-[-90deg] text-zinc-500" />
                </button>
              </div>

              <div className="space-y-6">
                {!clientSecret && !razorpayOrder ? (
                  <div className="space-y-6">
                    <div className="bg-zinc-800/50 p-6 rounded-3xl border border-dashed border-zinc-700 flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                        <CreditCard className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                          {paymentMethod === 'wallet' ? 'Pay from Wallet' : 
                           paymentMethod === 'stripe' ? 'Pay via Stripe' : 
                           paymentMethod === 'razorpay' ? 'Pay via Razorpay' : 
                           'Manual UPI Deposit'}
                        </p>
                        <p className="text-2xl font-black text-white mt-1 uppercase tracking-tight">₹{totalAmount}</p>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase mt-1">Merchant: <span className="text-emerald-500">{activeMerchantName}</span></p>
                        {paymentMethod === 'wallet' && (
                          <p className={`text-[10px] font-bold mt-1 ${userData.balance >= totalAmount ? 'text-emerald-500' : 'text-red-500'}`}>
                            Your Balance: ₹{userData.balance.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('wallet')}
                        className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-1 ${paymentMethod === 'wallet' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                      >
                        <WalletIcon className="w-4 h-4" />
                        Wallet
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('upi')}
                        className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-1 ${paymentMethod === 'upi' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                      >
                        <QrCode className="w-4 h-4" />
                        UPI
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('razorpay')}
                        className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-1 ${paymentMethod === 'razorpay' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                      >
                        <CreditCard className="w-4 h-4" />
                        Razorpay
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('stripe')}
                        className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-1 ${paymentMethod === 'stripe' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Stripe
                      </button>
                    </div>

                    {paymentMethod === 'wallet' && (
                      <div className="bg-zinc-800/30 p-6 rounded-3xl border border-zinc-800 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Current Balance</span>
                          <span className="text-white font-black">₹{userData.balance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Ticket Cost</span>
                          <span className="text-white font-black">₹{totalAmount}</span>
                        </div>
                        <div className="h-px bg-zinc-800"></div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Remaining Balance</span>
                          <span className={`font-black ${userData.balance >= totalAmount ? 'text-emerald-500' : 'text-red-500'}`}>
                            ₹{(userData.balance - totalAmount).toFixed(2)}
                          </span>
                        </div>
                        {userData.balance < totalAmount && (
                          <div className="space-y-4">
                            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">Insufficient Balance</p>
                            </div>
                            <button 
                              onClick={() => setPaymentMethod('upi')}
                              className="w-full py-3 rounded-xl bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4 text-emerald-500" />
                              Deposit via UPI
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'upi' && (
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-xl border border-zinc-100 ring-4 ring-emerald-500/10">
                          <div className="w-full flex justify-between items-center px-2">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" className="h-4 object-contain opacity-70" alt="UPI" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/c/cc/BHIM_logo.png" className="h-5 object-contain opacity-70" alt="BHIM" />
                          </div>

                          <div className="relative group p-4 bg-zinc-50 rounded-3xl border border-zinc-100">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(globalSettings?.upiSettings?.paymentLink || `upi://pay?pa=${globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69'}&pn=${activeMerchantName}&am=${totalAmount}&cu=INR`)}`}
                              alt="Payment QR Code"
                              className="w-48 h-48 relative z-10 p-2 bg-white rounded-2xl shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                              <QrCode className="w-20 h-20 text-emerald-500" />
                            </div>
                          </div>
                          
                          <div className="text-center space-y-4 w-full">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] animate-pulse">Scan & Pay with any UPI App</p>
                              <div className="flex items-center justify-center gap-2">
                                <p className="text-3xl font-black text-zinc-900 tracking-tighter">₹{totalAmount}</p>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(totalAmount.toString());
                                    setMessage({ type: 'success', text: 'Amount Copied!' });
                                  }}
                                  className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 text-zinc-400 hover:text-emerald-500 transition-all"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">To: <span className="text-emerald-600">{activeMerchantName}</span></p>
                            </div>

                            <div className="h-px bg-zinc-100 w-full" />

                            <div className="flex flex-col gap-3">
                              <div className="grid grid-cols-3 gap-2">
                                <a 
                                  href={`phonepe://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${totalAmount}&cu=INR`}
                                  className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                                >
                                  <img src="https://img.icons8.com/color/48/phone-pe.png" className="w-8 h-8 grayscale group-hover:grayscale-0 transition-all" alt="PhonePe" />
                                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">PhonePe</span>
                                </a>
                                <a 
                                  href={`paytmmp://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${totalAmount}&cu=INR`}
                                  className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                                >
                                  <img src="https://img.icons8.com/color/48/paytm.png" className="w-8 h-8 grayscale group-hover:grayscale-0 transition-all" alt="Paytm" />
                                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Paytm</span>
                                </a>
                                <a 
                                  href={`googlepay://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${totalAmount}&cu=INR`}
                                  className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                                >
                                  <img src="https://img.icons8.com/color/48/google-pay.png" className="w-8 h-8 grayscale group-hover:grayscale-0 transition-all" alt="GPay" />
                                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">G-Pay</span>
                                </a>
                              </div>
                              <a 
                                href={globalSettings?.upiSettings?.paymentLink || `upi://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${totalAmount}&cu=INR`}
                                className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/30"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Open Payment App
                              </a>

                              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between group">
                                <div className="flex flex-col items-start text-left">
                                  <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">UPI ID</span>
                                  <span className="text-[11px] font-bold text-zinc-900 truncate max-w-[150px]">{globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69'}</span>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69');
                                    setMessage({ type: 'success', text: 'UPI ID Copied!' });
                                  }}
                                  className="p-2 bg-white rounded-lg border border-zinc-200 text-zinc-500 hover:text-emerald-500 hover:border-emerald-500 transition-all shadow-sm"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-2 px-1 text-left">
                            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Step 2: Enter Transaction Details</h4>
                          </div>
                          
                          <div className="relative">
                            <label className="absolute -top-2 left-4 px-2 bg-zinc-900 text-[8px] font-black text-zinc-500 uppercase tracking-widest z-10">12-Digit UTR Number</label>
                            <input 
                              type="text" 
                              value={utr}
                              onChange={(e) => setUtr(e.target.value)}
                              placeholder="0000 0000 0000"
                              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-5 text-white font-black text-lg focus:outline-none focus:border-emerald-500 transition-all tracking-[0.2em] placeholder:text-zinc-800"
                              maxLength={12}
                              required={paymentMethod === 'upi'}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              <ShieldCheck className={`w-6 h-6 transition-colors ${utr.length === 12 ? 'text-emerald-500' : 'text-zinc-800'}`} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Screenshot</label>
                            <div className="relative">
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleScreenshotChange}
                                className="hidden"
                                id="purchase-screenshot-upload"
                                required={paymentMethod === 'upi'}
                              />
                              <label 
                                htmlFor="purchase-screenshot-upload"
                                className="w-full bg-zinc-800 border-2 border-dashed border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-emerald-500 transition-all"
                              >
                                {screenshot ? (
                                  <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                                    <img src={screenshot} alt="Screenshot Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                      <p className="text-[10px] font-black text-white uppercase tracking-widest">Change Screenshot</p>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <Plus className="w-8 h-8 text-zinc-600" />
                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Upload Payment Proof</p>
                                    <p className="text-[8px] text-zinc-600 font-bold uppercase">Max size: 1MB</p>
                                  </>
                                )}
                              </label>
                            </div>
                          </div>
                          
                          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex items-start gap-3">
                            <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-zinc-400 leading-relaxed">
                              Please enter the correct 12-digit UTR number from your payment app. Incorrect UTR will lead to rejection of your ticket.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handlePurchase}
                      disabled={loading}
                      className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Initializing...
                        </>
                      ) : (
                        'Confirm & Pay'
                      )}
                    </button>
                  </div>
                ) : clientSecret ? (
                  <div className="bg-white p-6 rounded-3xl">
                    <StripePayment 
                      clientSecret={clientSecret}
                      amount={selectedNumbers.length * investment}
                      onSuccess={() => {
                        setMessage({ type: 'success', text: 'Numbers purchased successfully!' });
                        setSelectedNumbers([]);
                        setShowPayment(false);
                        setClientSecret(null);
                      }}
                      onCancel={() => setClientSecret(null)}
                    />
                  </div>
                ) : (
                  <RazorpayPayment
                    orderId={razorpayOrder.id}
                    amount={selectedNumbers.length * investment}
                    userData={{
                      uid: userData.uid,
                      fullName: userData.fullName,
                      phoneNumber: userData.phoneNumber,
                    }}
                    onSuccess={() => {
                      setMessage({ type: 'success', text: 'Numbers purchased successfully!' });
                      setSelectedNumbers([]);
                      setShowPayment(false);
                      setRazorpayOrder(null);
                    }}
                    onCancel={() => setRazorpayOrder(null)}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Message Toast */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-24 left-6 right-6 p-4 rounded-2xl shadow-xl flex items-center gap-3 z-[100] ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="text-sm font-bold">{message.text}</p>
            <button onClick={() => setMessage(null)} className="ml-auto text-xs font-black uppercase">Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

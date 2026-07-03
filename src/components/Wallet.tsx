import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { UserData } from '../App';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus, History, ChevronLeft, CreditCard, Landmark, Send, AlertCircle, CheckCircle2, Clock, Trophy, Loader2, ShieldCheck, ExternalLink, QrCode, Sparkles, Copy, Smartphone, Coins, HelpCircle, RefreshCw, Headphones, FileText, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import StripePayment from './StripePayment';
import RazorpayPayment from './RazorpayPayment';
import RazorpayQRCard from './RazorpayQRCard';

interface WalletProps {
  userData: UserData | null;
  onBack: () => void;
  onNavigate?: (view: any) => void;
}

interface Transaction {
  id: string;
  amount: number;
  type: 'Deposit' | 'Winning' | 'Withdraw' | 'Referral Bonus';
  status: 'Pending' | 'Success' | 'Rejected';
  utr?: string;
  reason?: string;
  createdAt: string;
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    upiId: string;
  };
}

export default function Wallet({ userData, onBack, onNavigate }: WalletProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [razorpayOrder, setRazorpayOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'upi'>('upi');
  const [activeMerchantName, setActiveMerchantName] = useState('Digital Services');

  const [depositStep, setDepositStep] = useState(1);
  const [depositTab, setDepositTab] = useState<'online' | 'crypto'>('online');
  const [selectedChannel, setSelectedChannel] = useState<'upi' | 'ptm' | 'upay' | 'nowallet'>('upi');
  const [selectedPill, setSelectedPill] = useState<'upi98' | 'upi90'>('upi98');

  const merchantNames = [
    'Digital Services', 'Fast Checkout', 'Global Payments', 'Reliable Pay',
    'Instant Settlement', 'Skyline Ventures', 'V-Care Payments', 'Zenith Solutions',
    'Apex Enterprises', 'Nexus Digital', 'Prime Secure', 'Orbit Payments',
    'Stellar Services', 'Nova Traders', 'Core Fintech', 'Pulse Digitals',
    'Quantum Pay', 'Ultra Transact', 'Rapid Settle', 'Glance Services'
  ];

  useEffect(() => {
    if (showDeposit) {
      const randomName = merchantNames[Math.floor(Math.random() * merchantNames.length)];
      setActiveMerchantName(randomName);
      setDepositStep(1);
      setDepositTab('online');
      setSelectedChannel('upi');
      setSelectedPill('upi98');
      setDepositAmount('');
      setUtr('');
      setScreenshot(null);
    }
  }, [showDeposit]); // Change every time deposit modal is opened
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedManualUpi, setSelectedManualUpi] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [isDepositSubmitted, setIsDepositSubmitted] = useState(false);

  const handleSimulateSuccess = async (simulatedUtr: string, mockBase64Screenshot: string, autoApprove: boolean) => {
    setUtr(simulatedUtr);
    setScreenshot(mockBase64Screenshot);
    
    if (autoApprove && userData && depositAmount) {
      setLoading(true);
      try {
        const batch = writeBatch(db);
        const amountNum = parseFloat(depositAmount);

        // 1. Create successful transaction
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          uid: userData.uid,
          amount: amountNum,
          type: 'Deposit',
          status: 'Success', 
          utr: simulatedUtr,
          screenshot: mockBase64Screenshot,
          paymentMethod: paymentMethod === 'razorpay' ? 'Razorpay QR' : 'Manual UPI',
          createdAt: new Date().toISOString()
        });

        // 2. Increment user balance
        const userRef = doc(db, 'users', userData.uid);
        batch.update(userRef, {
          balance: increment(amountNum)
        });

        await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'simulate-wallet-deposit'));

        setMessage({ type: 'success', text: `UPI Sandbox Success! ₹${depositAmount} instantly credited to your wallet.` });
        setDepositAmount('');
        setShowDeposit(false);
        setUtr('');
        setScreenshot(null);
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to process instant sandbox credit.' });
      } finally {
        setLoading(false);
      }
    } else {
      setMessage({ type: 'success', text: 'Payment response simulated! Tap Claim Deposit below to process manually.' });
    }
  };

  const manualUpiList = globalSettings?.depositSettings?.manualUpiList || [];
  const upiIdToUse = (paymentMethod === 'upi' && selectedManualUpi) ? selectedManualUpi : (globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/XFu2lI2v');
  
  const presetLinks: { [key: number]: string } = {
    100: 'https://rzp.io/i/SsF0Uw13YJijrv',
    200: 'https://rzp.io/i/SsEy3bJmlrPtif',
    500: 'https://rzp.io/i/SsEzCnIbr8zWSQ',
    1000: 'https://rzp.io/i/SsEwOE8Zivg42L',
  };

  const getActivePaymentLink = () => {
    const amt = parseFloat(depositAmount);
    if (!isNaN(amt) && presetLinks[amt]) {
      return presetLinks[amt];
    }
    return globalSettings?.upiSettings?.paymentLink || 'https://rzp.io/rzp/XFu2lI2v';
  };

  const isManualRazorpay = paymentMethod === 'razorpay' && (
    (!globalSettings?.upiSettings?.razorpayId || globalSettings?.upiSettings?.razorpayQrCodePhoto) ||
    (!isNaN(parseFloat(depositAmount)) && !!presetLinks[parseFloat(depositAmount)])
  );

  useEffect(() => {
    if (manualUpiList.length > 0 && !selectedManualUpi) {
      setSelectedManualUpi(manualUpiList[0]);
    }
  }, [manualUpiList, paymentMethod]);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // Fixed to 1MB
        setMessage({ type: 'error', text: 'Screenshot must be less than 1MB' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // ... (existing helper hooks/effects)

  // Bank Details Form
  const [bankDetails, setBankDetails] = useState(userData?.bankDetails || {
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: ''
  });

  useEffect(() => {
    if (!userData) return;
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', userData.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });
  }, [userData]);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
  }, []);

  const handleUpdateBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userData.uid), { bankDetails }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${userData.uid}`));
      setMessage({ type: 'success', text: 'Bank details updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update bank details.' });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    const amount = parseFloat(withdrawAmount);
    if (amount < 100) {
      setMessage({ type: 'error', text: 'Minimum withdraw limit is ₹100' });
      return;
    }
    if (amount > userData.balance) {
      setMessage({ type: 'error', text: 'Insufficient balance' });
      return;
    }

    // Check Withdrawal Limits
    if (globalSettings?.withdrawalLimits) {
      const limits = globalSettings.withdrawalLimits;
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const tempWeek = new Date(now);
      const startOfWeek = new Date(tempWeek.setDate(tempWeek.getDate() - tempWeek.getDay())).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const withdraws = transactions.filter(t => t.type === 'Withdraw' && t.status !== 'Rejected');
      
      const dailyTotal = withdraws.filter(t => t.createdAt >= startOfDay).reduce((sum, t) => sum + t.amount, 0);
      const weeklyTotal = withdraws.filter(t => t.createdAt >= startOfWeek).reduce((sum, t) => sum + t.amount, 0);
      const monthlyTotal = withdraws.filter(t => t.createdAt >= startOfMonth).reduce((sum, t) => sum + t.amount, 0);

      if (dailyTotal + amount > limits.daily) {
        setMessage({ type: 'error', text: `Daily withdrawal limit exceeded. Remaining: ₹${Math.max(0, limits.daily - dailyTotal)}` });
        return;
      }
      if (weeklyTotal + amount > limits.weekly) {
        setMessage({ type: 'error', text: `Weekly withdrawal limit exceeded. Remaining: ₹${Math.max(0, limits.weekly - weeklyTotal)}` });
        return;
      }
      if (monthlyTotal + amount > limits.monthly) {
        setMessage({ type: 'error', text: `Monthly withdrawal limit exceeded. Remaining: ₹${Math.max(0, limits.monthly - monthlyTotal)}` });
        return;
      }
    }

    setShowWithdrawConfirm(true);
  };

  const processWithdraw = async () => {
    if (!userData) return;
    const amount = parseFloat(withdrawAmount);

    setLoading(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        uid: userData.uid,
        amount,
        type: 'Withdraw',
        status: 'Pending',
        bankDetails: userData.bankDetails, // Include bank details for admin
        createdAt: new Date().toISOString()
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'transactions'));
      
      await updateDoc(doc(db, 'users', userData.uid), {
        balance: userData.balance - amount
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${userData.uid}`));
      
      setMessage({ type: 'success', text: 'Withdraw request submitted!' });
      setWithdrawAmount('');
      setShowWithdraw(false);
      setShowWithdrawConfirm(false);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit request.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAmountPresetClick = async (amount: number) => {
    if (!userData) {
      setMessage({ type: 'error', text: 'Please log in to make a deposit.' });
      return;
    }
    setDepositAmount(amount.toString());
    setPaymentMethod('razorpay');
    
    const directLink = presetLinks[amount];
    if (directLink) {
      setDepositStep(2);
      try {
        window.open(directLink, '_blank');
        setMessage({ type: 'success', text: `Opening ₹${amount} Razorpay Payment Link...` });
      } catch (e) {
        console.log("Popup blocked:", e);
        setMessage({ type: 'info', text: `Popup blocked. Click 'Open in Payment App' below.` });
      }
      return;
    }

    const hasRazorpayKeys = !!globalSettings?.upiSettings?.razorpayId;
    const hasRazorpayQr = !!globalSettings?.upiSettings?.razorpayQrCodePhoto;

    if (hasRazorpayKeys && !hasRazorpayQr) {
      setLoading(true);
      try {
        const response = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amount,
            uid: userData.uid,
            type: 'deposit',
          }),
        });

        if (!response.ok) throw new Error('Failed to create Razorpay order');
        const data = await response.json();
        setRazorpayOrder(data);
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Error initiating Razorpay checkout.' });
      } finally {
        setLoading(false);
      }
    } else {
      // Direct jump to Step 2 to complete manual checkout or paylink
      setDepositStep(2);
      
      const pLink = globalSettings?.upiSettings?.paymentLink || 'https://rzp.io/rzp/XFu2lI2v';
      if (pLink.startsWith('http')) {
        try {
          window.open(pLink + `?amount=${amount}`, '_blank');
        } catch (e) {
          console.log("Popup blocked:", e);
        }
      }
    }
  };

  const handleDepositRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !depositAmount) return;

    setLoading(true);
    try {
      if (paymentMethod === 'stripe') {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(depositAmount),
            uid: userData.uid,
            type: 'deposit',
          }),
        });

        if (!response.ok) throw new Error('Failed to create payment intent');
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } else if (paymentMethod === 'razorpay') {
        const hasRazorpayKeys = !!globalSettings?.upiSettings?.razorpayId;
        const hasRazorpayQr = !!globalSettings?.upiSettings?.razorpayQrCodePhoto;

        if (!hasRazorpayKeys || hasRazorpayQr) {
          if (!utr) {
            setMessage({ type: 'error', text: 'Please enter Transaction ID (UTR).' });
            setLoading(false);
            return;
          }
          if (!screenshot) {
            setMessage({ type: 'error', text: 'Please upload a payment screenshot as proof.' });
            setLoading(false);
            return;
          }

          await addDoc(collection(db, 'transactions'), {
            uid: userData.uid,
            amount: parseFloat(depositAmount),
            type: 'Deposit',
            status: 'Pending',
            utr,
            screenshot,
            paymentMethod: 'Razorpay QR',
            createdAt: new Date().toISOString()
          }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'transactions'));

          setMessage({ type: 'success', text: 'Deposit request submitted! Admin will verify and credit your balance.' });
          setDepositAmount('');
          setShowDeposit(false);
          setUtr('');
          setScreenshot(null);
          return;
        }

        const response = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(depositAmount),
            uid: userData.uid,
            type: 'deposit',
          }),
        });

        if (!response.ok) throw new Error('Failed to create Razorpay order');
        const data = await response.json();
        setRazorpayOrder(data);
      } else if (paymentMethod === 'upi') {
        if (!utr) {
          setMessage({ type: 'error', text: 'Please enter Transaction ID (UTR).' });
          setLoading(false);
          return;
        }
        if (!screenshot) {
          setMessage({ type: 'error', text: 'Please upload a payment screenshot as proof.' });
          setLoading(false);
          return;
        }
        
        await addDoc(collection(db, 'transactions'), {
          uid: userData.uid,
          amount: parseFloat(depositAmount),
          type: 'Deposit',
          status: 'Pending',
          utr: utr,
          screenshot: screenshot,
          paymentMethod: 'Manual UPI',
          createdAt: new Date().toISOString(),
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'transactions'));

          setMessage({ type: 'success', text: 'Deposit request submitted! Admin will verify and update your balance.' });
          setShowDeposit(false);
          setDepositAmount('');
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
          <h1 className="text-2xl font-black text-white tracking-tight font-display">Wallet</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Manage your funds securely</p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl text-white overflow-hidden border border-zinc-800 shimmer">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em]">Total Balance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tighter font-display">₹{userData.balance.toLocaleString()}</span>
                <span className="text-emerald-500 font-bold text-xs">INR</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <button 
              onClick={() => {
                try {
                  window.open('https://rzp.io/rzp/XFu2lI2v', '_blank');
                } catch (err) {
                  console.log('Window open blocked:', err);
                }
                if (onNavigate) onNavigate('receive');
                else setShowDeposit(true);
              }}
              className="bg-emerald-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Deposit
            </button>
            <button 
              onClick={() => setShowWithdraw(true)}
              className="bg-zinc-800 text-white py-4 rounded-2xl font-black text-sm hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700"
            >
              <ArrowUpRight className="w-5 h-5" />
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
            <History className="w-4 h-4 text-emerald-500" />
            Transaction History
          </h3>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{transactions.length} Records</span>
        </div>

        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/50 rounded-[2rem] border border-dashed border-zinc-800">
              <Clock className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">No transactions yet</p>
            </div>
          ) : (
            transactions.map(tx => (
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                whileHover={{ scale: 1.015, y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                key={tx.id} 
                className={`bg-zinc-900 rounded-2xl border transition-all duration-300 overflow-hidden group ${
                  expandedTxId === tx.id ? 'ring-2 ring-zinc-700/50' : ''
                } ${
                  tx.type === 'Deposit' ? 'border-zinc-800/80 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5' : 
                  tx.type === 'Winning' ? 'border-zinc-800/80 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5' : 
                  tx.type === 'Referral Bonus' ? 'border-zinc-800/80 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5' :
                  'border-zinc-800/80 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5'
                }`}
              >
                <div 
                  onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                  className="p-4 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                      tx.type === 'Deposit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20' : 
                      tx.type === 'Winning' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20' : 
                      tx.type === 'Referral Bonus' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:bg-purple-500/20' :
                      'bg-orange-500/10 text-orange-400 border-orange-500/20 group-hover:bg-orange-500/20'
                    }`}>
                      {tx.type === 'Deposit' ? <ArrowDownLeft className="w-5 h-5" /> : 
                       tx.type === 'Winning' ? <Trophy className="w-5 h-5" /> : 
                       tx.type === 'Referral Bonus' ? <Sparkles className="w-5 h-5" /> :
                       <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-white text-sm tracking-tight">{tx.type}</p>
                        {tx.paymentMethod && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
                            {tx.paymentMethod === 'Stripe' && <ShieldCheck className="w-2.5 h-2.5" />}
                            {tx.paymentMethod === 'Razorpay' && <CreditCard className="w-2.5 h-2.5" />}
                            {tx.paymentMethod === 'Manual UPI' && <QrCode className="w-2.5 h-2.5" />}
                            {tx.paymentMethod === 'Wallet' && <WalletIcon className="w-2.5 h-2.5" />}
                            {tx.paymentMethod}
                          </span>
                        )}
                        {!tx.paymentMethod && (tx.stripePaymentIntentId || tx.razorpayPaymentId) && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
                            {tx.stripePaymentIntentId ? <ShieldCheck className="w-2.5 h-2.5" /> : <CreditCard className="w-2.5 h-2.5" />}
                            {tx.stripePaymentIntentId ? 'Stripe' : 'Razorpay'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-black text-sm tracking-tight ${tx.type === 'Withdraw' ? 'text-white' : 'text-emerald-400'}`}>
                        {tx.type === 'Withdraw' ? '-' : '+'}₹{tx.amount.toLocaleString()}
                      </p>
                      
                      {tx.status === 'Success' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-2 h-2 shrink-0" />
                          Success
                        </span>
                      )}
                      {tx.status === 'Pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                          <Clock className="w-2 h-2 shrink-0 animate-spin [animation-duration:3s]" />
                          Pending
                        </span>
                      )}
                      {tx.status === 'Rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertCircle className="w-2 h-2 shrink-0" />
                          Rejected
                        </span>
                      )}
                    </div>
                    
                    <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform duration-300 ${expandedTxId === tx.id ? 'rotate-180 text-white' : 'group-hover:text-zinc-400'}`} />
                  </div>
                </div>

                <AnimatePresence>
                  {expandedTxId === tx.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 border-t border-zinc-800 pt-4 space-y-3 bg-zinc-950/40"
                    >
                      {tx.utr && (
                        <div className="flex justify-between items-center bg-zinc-900/40 p-3 rounded-xl border border-zinc-800">
                          <div className="flex flex-col text-left">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">UTR / Reference</span>
                            <span className="text-xs font-mono font-black text-zinc-200 tracking-wider mt-0.5">{tx.utr}</span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tx.utr) {
                                navigator.clipboard.writeText(tx.utr);
                                setMessage({ type: 'success', text: 'UTR Copied!' });
                              }
                            }}
                            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all border border-zinc-700 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                      )}
                      {tx.bankDetails && tx.type === 'Withdraw' && (
                        <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 space-y-3">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-1.5">Withdrawal Destination Bank Details</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-900">
                              <p className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest">Holder Name</p>
                              <p className="text-[10px] font-black text-zinc-100 uppercase mt-0.5">{tx.bankDetails.accountHolderName}</p>
                            </div>
                            <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-900">
                              <p className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest">Account Number</p>
                              <p className="text-[10px] font-mono font-bold text-zinc-100 mt-0.5">{tx.bankDetails.accountNumber}</p>
                            </div>
                            <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-900">
                              <p className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest">IFSC Bank Code</p>
                              <p className="text-[10px] font-mono font-bold text-zinc-100 uppercase mt-0.5">{tx.bankDetails.ifscCode}</p>
                            </div>
                            <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-900">
                              <p className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest">UPI ID</p>
                              <p className="text-[10px] font-black text-zinc-100 mt-0.5">{tx.bankDetails.upiId}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {tx.reason && tx.status === 'Rejected' && (
                        <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 flex gap-2.5 items-start">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Reason for Rejection</p>
                            <p className="text-xs font-bold text-red-300 mt-0.5">{tx.reason}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 px-1 text-[8px] font-black uppercase tracking-widest">
                        <span className="text-zinc-600">Transaction hash ID</span>
                        <span className="text-zinc-600 font-mono tracking-tight select-all">{tx.id}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Action Modals */}
      <AnimatePresence>
        {showDeposit && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-0 sm:p-4">
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="relative w-full h-full sm:h-[90vh] max-w-md bg-[#f4f5f8] rounded-none sm:rounded-[2.5rem] flex flex-col overflow-hidden text-zinc-900 shadow-2xl font-sans"
            >
              {isDepositSubmitted ? (
                /* High fidelity Pending request page */
                <div className="flex-1 flex flex-col bg-white">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-100 flex-shrink-0">
                    <button 
                      onClick={() => { setShowDeposit(false); setIsDepositSubmitted(false); }}
                      className="p-2 -ml-2 text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                    </button>
                    <h2 className="text-lg font-black text-zinc-800 tracking-tight font-display">Deposit Status</h2>
                    <div className="w-10 h-10" /> {/* Spacer */}
                  </div>
                  
                  {/* Body */}
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                    <div className="w-24 h-24 bg-emerald-50 rounded-[3rem] flex items-center justify-center border-4 border-emerald-100 shadow-xl">
                      <Clock className="w-12 h-12 text-emerald-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-zinc-800 tracking-tight leading-none">Request Submitted!</h3>
                      <p className="text-zinc-500 text-sm font-medium px-4 leading-relaxed">
                        Our admin verification team is checking your payment. It will be credited within 15-30 minutes.
                      </p>
                    </div>
                    
                    <div className="w-full bg-zinc-50 border border-zinc-100 p-6 rounded-3xl space-y-4 shadow-sm">
                      <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                        <span className="text-zinc-400">Status</span>
                        <span className="text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">Verifying</span>
                      </div>
                      <div className="h-px bg-zinc-200/50" />
                      <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-zinc-400">
                        <span>Est. Processing Time</span>
                        <span className="text-zinc-800 font-extrabold bg-zinc-100 px-2.5 py-1 rounded-full">~15-30 mins</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => { setShowDeposit(false); setIsDepositSubmitted(false); }}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              ) : clientSecret ? (
                /* Stripe wrapper code inside white container */
                <div className="flex-1 flex flex-col bg-white">
                  <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-100 flex-shrink-0">
                    <button onClick={() => setClientSecret(null)} className="p-2 -ml-2 text-zinc-600 hover:text-zinc-900">
                      <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                    </button>
                    <h2 className="text-lg font-black text-zinc-800 tracking-tight font-display">Stripe Checkout</h2>
                    <div className="w-10 h-10" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-[#f4f5f8]">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                      <StripePayment 
                        clientSecret={clientSecret}
                        amount={parseFloat(depositAmount)}
                        onSuccess={() => {
                          setMessage({ type: 'success', text: 'Payment successful! Balance will be updated shortly.' });
                          setShowDeposit(false);
                          setClientSecret(null);
                          setDepositAmount('');
                        }}
                        onCancel={() => setClientSecret(null)}
                      />
                    </div>
                  </div>
                </div>
              ) : razorpayOrder ? (
                /* Razorpay checker */
                <div className="flex-1 flex flex-col bg-white">
                  <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-100 flex-shrink-0">
                    <button onClick={() => setRazorpayOrder(null)} className="p-2 -ml-2 text-zinc-600 hover:text-zinc-900">
                      <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                    </button>
                    <h2 className="text-lg font-black text-zinc-800 tracking-tight font-display">Razorpay Payment</h2>
                    <div className="w-10 h-10" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
                    <RazorpayPayment
                      orderId={razorpayOrder.id}
                      amount={parseFloat(depositAmount)}
                      userData={{
                        uid: userData.uid,
                        fullName: userData.fullName,
                        phoneNumber: userData.phoneNumber,
                      }}
                      keyId={globalSettings?.upiSettings?.razorpayId}
                      onSuccess={() => {
                        setMessage({ type: 'success', text: 'Payment successful! Balance will be updated shortly.' });
                        setShowDeposit(false);
                        setRazorpayOrder(null);
                        setDepositAmount('');
                      }}
                      onCancel={() => setRazorpayOrder(null)}
                    />
                  </div>
                </div>
              ) : depositStep === 1 ? (
                /* FIRST STEP: SELECT AMOUNT & CHANNELS (MATCHES SCREENSHOT SPECIFICALLY) */
                <form className="flex-1 flex flex-col overflow-hidden bg-white" onSubmit={(e) => e.preventDefault()}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-100 flex-shrink-0">
                    <button 
                      type="button"
                      onClick={() => setShowDeposit(false)} 
                      className="p-2 -ml-2 text-zinc-600 hover:text-zinc-900 active:scale-95 transition-all"
                    >
                      <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                    </button>
                    
                    <h2 className="text-[#13151b] text-lg font-black tracking-tight font-display">Deposit</h2>
                    
                    <div className="flex items-center">
                      <button 
                        type="button"
                        onClick={() => {
                          if (onNavigate) {
                            onNavigate('verification');
                          } else {
                            setMessage({ type: 'info', text: 'Head over to Finance & Support or contact admin for help.' });
                          }
                        }}
                        className="p-2 text-zinc-600 hover:text-zinc-900 active:scale-95 transition-all"
                      >
                        <Headphones className="w-5 h-5 stroke-[2]" />
                      </button>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          setShowDeposit(false);
                          setTimeout(() => {
                            const elem = document.getElementById("transaction-history-section");
                            if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                        className="p-2 text-zinc-600 hover:text-zinc-900 relative active:scale-95 transition-all"
                      >
                        <FileText className="w-5 h-5 stroke-[2]" />
                        <span className="absolute top-0 right-0 w-5 h-5 bg-[#ff3b30] text-white text-[8px] font-black flex items-center justify-center rounded-full border border-white scale-90 ring-1 ring-red-500/20">
                          99+
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Body (Scrollable) */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#f4f5f8]">
                    
                    {/* Payment Method Header */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Payment method</span>
                        <div className="flex items-center gap-1.5 bg-white border border-zinc-200/50 py-1.5 px-3 rounded-full shadow-sm">
                          <span className="text-xs">🇮🇳</span>
                          <span className="text-xs font-black text-[#fca93b]">{(userData?.balance || 0).toFixed(2)}</span>
                          <button 
                            type="button"
                            onClick={() => setMessage({ type: 'success', text: 'Wallet balance refreshed!' })}
                            className="p-0.5 text-zinc-400 hover:text-zinc-700 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Online Deposit / Crypto tabs */}
                      <div className="flex gap-4 border-b border-zinc-200">
                        <button 
                          type="button"
                          onClick={() => setDepositTab('online')}
                          className={`relative flex-1 pb-3 text-center transition-all ${depositTab === 'online' ? 'text-zinc-900 font-extrabold border-b-[3px] border-zinc-900' : 'text-zinc-400 font-bold'}`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Smartphone className="w-4 h-4 text-zinc-700 font-black" />
                            <span className="text-xs font-bold">Online deposit</span>
                          </div>
                          {/* +4% Badges */}
                          <div className="absolute -top-3.5 right-0 bg-red-500 text-white font-black text-[7px] px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-0.5">
                            <span>🎁</span>
                            <span>+4%</span>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={() => setMessage({ type: 'info', text: 'Cryptocurrency payment networks are undergoing maintenance.' })}
                          className="relative flex-1 pb-3 text-center transition-all opacity-60 text-zinc-400 font-bold font-sans"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Coins className="w-4 h-4 text-amber-500 font-black" />
                            <span className="text-xs font-bold">Cryptocurrency</span>
                          </div>
                          <div className="absolute -top-3.5 right-4 bg-[#ff9500] text-white font-black text-[7px] px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-0.5">
                            <span>🎁</span>
                            <span>+2%</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Channels Selector Grid */}
                    <div className="grid grid-cols-2 gap-3 pb-2">
                      {/* UPI */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('upi');
                          setSelectedChannel('upi');
                        }}
                        className={`relative flex items-center gap-3 p-4 bg-white rounded-2xl border-2 transition-all text-left ${
                          selectedChannel === 'upi'
                            ? 'border-zinc-800 shadow-md bg-zinc-50/20'
                            : 'border-zinc-100 shadow-sm hover:border-zinc-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-sm font-black text-emerald-600">
                          🛆
                        </div>
                        <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">UPI</span>
                        <div className="absolute -top-1.5 -right-1.5 bg-[#fd3d39] text-white font-black text-[7px] px-1.5 py-0.5 rounded-md scale-90 border border-white">
                          2.5%
                        </div>
                      </button>

                      {/* PTM */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('razorpay');
                          setSelectedChannel('ptm');
                        }}
                        className={`relative flex items-center gap-3 p-4 bg-white rounded-2xl border-2 transition-all text-left ${
                          selectedChannel === 'ptm'
                            ? 'border-zinc-800 shadow-md bg-zinc-50/20'
                            : 'border-zinc-100 shadow-sm hover:border-zinc-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-sm font-black text-blue-600">
                          🔸
                        </div>
                        <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">PTM</span>
                        <div className="absolute -top-1.5 -right-1.5 bg-[#fd3d39] text-white font-black text-[7px] px-1.5 py-0.5 rounded-md scale-90 border border-white">
                          2.5%
                        </div>
                      </button>

                      {/* UPAY Wallet */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('upi');
                          setSelectedChannel('upay');
                        }}
                        className={`relative flex items-center gap-3 p-4 bg-white rounded-2xl border-2 transition-all text-left ${
                          selectedChannel === 'upay'
                            ? 'border-zinc-800 shadow-md bg-zinc-50/20'
                            : 'border-zinc-100 shadow-sm hover:border-zinc-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-xs font-black text-purple-600">
                          💼
                        </div>
                        <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">UPAY Wallet</span>
                        <div className="absolute -top-1.5 -right-1.5 bg-[#fd3d39] text-white font-black text-[7px] px-1.5 py-0.5 rounded-md scale-90 border border-white">
                          2%
                        </div>
                      </button>

                      {/* NO Wallet */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('upi');
                          setSelectedChannel('nowallet');
                        }}
                        className={`relative flex items-center gap-3 p-4 bg-white rounded-2xl border-2 transition-all text-left ${
                          selectedChannel === 'nowallet'
                            ? 'border-zinc-800 shadow-md bg-zinc-50/20'
                            : 'border-zinc-100 shadow-sm hover:border-zinc-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-xs font-black text-cyan-600">
                          🧬
                        </div>
                        <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">NO wallet</span>
                        <div className="absolute -top-1.5 -right-1.5 bg-[#fd3d39] text-white font-black text-[7px] px-1.5 py-0.5 rounded-md scale-90 border border-white">
                          2.5%
                        </div>
                      </button>
                    </div>

                    {/* Sub Channels Pills */}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPill('upi98')}
                        className={`px-6 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest border transition-all ${
                          selectedPill === 'upi98'
                            ? 'bg-white border-zinc-800 text-zinc-900 shadow-sm'
                            : 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200'
                        }`}
                      >
                        UPI.98
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPill('upi90')}
                        className={`px-6 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest border transition-all ${
                          selectedPill === 'upi90'
                            ? 'bg-white border-zinc-800 text-zinc-900 shadow-sm'
                            : 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200'
                        }`}
                      >
                        UPI.90
                      </button>
                    </div>

                    <div className="h-px bg-zinc-200/50" />

                    {/* PRESETS ENTRY HEADER */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Deposit amount</span>
                        <button 
                          type="button"
                          onClick={() => setMessage({ type: 'info', text: 'Claim instant matching sports bonuses on selected amounts!' })}
                          className="text-[10px] font-black text-zinc-400 hover:text-zinc-600 transition-colors uppercase tracking-wider flex items-center gap-1 font-sans"
                        >
                          Bonus event explanation
                          <HelpCircle className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                      </div>

                      {/* Presets Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 1, amt: 100, bonus: 1.00, label: 'Option 1' },
                          { id: 2, amt: 200, bonus: 2.00, label: 'Option 2' },
                          { id: 3, amt: 500, bonus: 5.00, label: 'Option 3' },
                          { id: 4, amt: 1000, bonus: 10.00, label: 'Option 4' },
                        ].map((item) => {
                          const isActive = parseFloat(depositAmount) === item.amt;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleAmountPresetClick(item.amt)}
                              className={`flex flex-col text-left p-3.5 rounded-2xl border-2 transition-all relative overflow-hidden group ${
                                isActive 
                                  ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/15 scale-[1.02]' 
                                  : 'border-zinc-100 bg-white hover:border-zinc-200 shadow-sm hover:scale-[1.01]'
                              }`}
                            >
                              <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${
                                isActive ? 'text-emerald-600' : 'text-zinc-400 font-sans'
                              }`}>
                                {item.label}
                              </span>
                              <span className="text-xl font-black text-zinc-950 mt-1 tracking-tight">
                                ₹{item.amt.toLocaleString()}
                              </span>
                              <div className={`mt-2.5 inline-flex self-start px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                                isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[#fff9e5] text-[#c09930]'
                              }`}>
                                Bonus +₹{item.bonus.toFixed(0)}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom input */}
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center text-lg font-black text-zinc-800">
                          <span>₹</span>
                        </div>
                        <input 
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="Min 100~Max 50,000"
                          className="w-full bg-[#fef6f6] border border-[#ffe0e0] rounded-2xl py-4.5 pl-10 pr-6 focus:border-red-400 focus:ring-0 transition-all font-black text-base text-zinc-800 font-display shadow-inner"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Button */}
                  <div className="p-5 bg-white border-t border-zinc-100 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const amt = parseFloat(depositAmount);
                        if (!amt || amt < 100 || amt > 50000) {
                          setMessage({ type: 'error', text: 'Transaction amount must be between ₹100 and ₹50,000.' });
                          return;
                        }
                        // Advance to Step 2
                        setDepositStep(2);
                      }}
                      className={`w-full py-4.5 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all ${
                        parseFloat(depositAmount) >= 100
                          ? 'bg-[#131313] text-white shadow-xl hover:bg-zinc-800 active:scale-95'
                          : 'bg-[#bebdbd] text-[#e3e3e3] cursor-not-allowed'
                      }`}
                    >
                      Deposit Now
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 2: COMPLETE PAYMENT SCAN QR CODE & ENTER UTR SCREENSHOT PROOF */
                <form className="flex-1 flex flex-col overflow-hidden bg-white" onSubmit={handleDepositRequest}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-100 flex-shrink-0">
                    <button 
                      type="button"
                      onClick={() => setDepositStep(1)} 
                      className="p-2 -ml-2 text-zinc-600 hover:text-zinc-900 active:scale-95 transition-all"
                    >
                      <ChevronLeft className="w-6 h-6 stroke-[3]" />
                    </button>
                    <h2 className="text-lg font-black text-zinc-800 tracking-tight font-display">Scan & Paste UTR</h2>
                    <div className="w-10 h-10" />
                  </div>

                  {/* Body (Scrollable) */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#f4f5f8]">
                    
                    {/* Security Badge Alert */}
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100/50 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-[10px] text-emerald-800 leading-normal font-bold uppercase tracking-wide">
                        Secure INR Deposit via {paymentMethod === 'razorpay' ? 'Razorpay QR' : (selectedChannel === 'upi' ? 'Manual UPI' : 'Wallet Transfer')}
                      </p>
                    </div>

                    {/* QR Code Presentation Box */}
                    {isManualRazorpay ? (
                      <div className="flex flex-col gap-6">
                        <RazorpayQRCard 
                          amount={depositAmount} 
                          payLink={getActivePaymentLink()} 
                          merchantName="HUSSAIN ALI"
                          qrPhotoOverride={globalSettings?.upiSettings?.razorpayQrCodePhoto}
                          onSimulateSuccess={handleSimulateSuccess}
                        />

                        {/* Amount & Copy action wrapper */}
                        <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-zinc-100 flex items-center justify-between px-6">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Amount to Pay</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-zinc-900">₹{depositAmount}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(depositAmount);
                                setMessage({ type: 'success', text: 'Amount Copied!' });
                              }}
                              className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 text-zinc-400 hover:text-emerald-500 transition-all"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Open link CTA */}
                        <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-zinc-100 flex flex-col gap-3">
                          <a 
                            href={getActivePaymentLink()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2.5 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open Razorpay Payment Page
                          </a>
                          
                          <div className="flex items-center gap-2 justify-center py-2.5 px-4 bg-yellow-50 rounded-xl border border-yellow-100">
                            <AlertCircle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                            <p className="text-[9px] font-bold text-yellow-700 uppercase tracking-tight text-left">Upload screenshot of transaction below</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-6 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-xl border border-zinc-100 ring-4 ring-emerald-500/5">
                        <div className="w-full flex justify-between items-center px-1">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" className="h-3.5 object-contain opacity-70" alt="UPI" />
                          <img src="https://upload.wikimedia.org/wikipedia/commons/c/cc/BHIM_logo.png" className="h-4 object-contain opacity-70" alt="BHIM" />
                        </div>

                        <div className="relative group p-4 bg-zinc-50 rounded-[2rem] border border-zinc-100">
                          {globalSettings?.depositSettings?.qrCodePhoto ? (
                            <img 
                              src={globalSettings.depositSettings.qrCodePhoto}
                              alt="Payment QR Code"
                              className="w-44 h-44 relative z-10 p-2 bg-white rounded-2xl shadow-sm object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(globalSettings?.upiSettings?.paymentLink || `upi://pay?pa=${upiIdToUse}&pn=${activeMerchantName}&am=${depositAmount}&cu=INR`)}`}
                              alt="Payment QR Code"
                              className="w-44 h-44 relative z-10 p-2 bg-white rounded-2xl shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                            <QrCode className="w-20 h-20 text-emerald-500" />
                          </div>
                        </div>

                        {/* Display Amount & Pay with UPI links */}
                        <div className="text-center space-y-4 w-full">
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] animate-pulse">Scan & Pay with any UPI App</p>
                            <div className="flex items-center justify-center gap-2">
                              <p className="text-3xl font-black text-zinc-900 tracking-tighter">₹{depositAmount}</p>
                              <button 
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(depositAmount);
                                  setMessage({ type: 'success', text: 'Amount Copied!' });
                                }}
                                className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 text-zinc-400 hover:text-emerald-500 transition-all"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-sans">To: <span className="text-emerald-600">{activeMerchantName}</span></p>
                          </div>

                          <div className="h-px bg-zinc-100 w-full" />

                          {/* UPI quick links or Razorpay direct info */}
                          <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-3 gap-2">
                              <a 
                                href={`phonepe://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/XFu2lI2v')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                                className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                              >
                                <img src="https://img.icons8.com/color/48/phone-pe.png" className="w-7 h-7 grayscale group-hover:grayscale-0 transition-all" alt="PhonePe" />
                                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">PhonePe</span>
                              </a>
                              <a 
                                href={`paytmmp://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/XFu2lI2v')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                                className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                              >
                                <img src="https://img.icons8.com/color/48/paytm.png" className="w-7 h-7 grayscale group-hover:grayscale-0 transition-all" alt="Paytm" />
                                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Paytm</span>
                              </a>
                              <a 
                                href={`googlepay://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/XFu2lI2v')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                                className="flex flex-col items-center gap-1.5 p-3 bg-[#f4f5f8] border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                              >
                                <img src="https://img.icons8.com/color/48/google-pay.png" className="w-7 h-7 grayscale group-hover:grayscale-0 transition-all" alt="GPay" />
                                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">G-Pay</span>
                              </a>
                            </div>

                            <a 
                              href={globalSettings?.upiSettings?.paymentLink || `upi://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/XFu2lI2v')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/10"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open in Payment App
                            </a>

                            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                              <div className="flex flex-col items-start leading-tight">
                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">UPI ID</span>
                                <span className="text-[10px] font-bold text-zinc-900 truncate max-w-[170px]">{upiIdToUse}</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(upiIdToUse);
                                  setMessage({ type: 'success', text: 'UPI ID Copied!' });
                                }}
                                className="p-1.5 bg-white rounded-lg border border-zinc-200 text-zinc-500 hover:text-emerald-500 hover:border-emerald-500 transition-all shadow-sm"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-center py-2.5 px-4 bg-yellow-50 rounded-xl border border-yellow-100">
                            <AlertCircle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                            <p className="text-[9px] font-bold text-yellow-700 uppercase tracking-tight text-left">Upload screenshot of transaction below</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* UTR & Screenshot inputs */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Transaction ID (UTR)</label>
                        <input 
                          type="text" 
                          value={utr}
                          onChange={(e) => setUtr(e.target.value)}
                          placeholder="Enter 12-digit UTR"
                          className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-4 text-zinc-800 font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm"
                          required
                          maxLength={12}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Screenshot</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleScreenshotChange}
                            className="hidden"
                            id="screenshot-upload"
                          />
                          <label 
                            htmlFor="screenshot-upload"
                            className="w-full bg-white border-2 border-dashed border-[#ebebeb] rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-emerald-500 hover:bg-zinc-50/20 transition-all text-center"
                          >
                            {screenshot ? (
                              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-sm">
                                <img src={screenshot} alt="Screenshot Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <p className="text-[9px] font-black text-white uppercase tracking-widest">Change Screenshot</p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <Plus className="w-8 h-8 text-zinc-400" />
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Upload Payment Proof</p>
                                <p className="text-[8px] text-zinc-400 font-bold uppercase">Max size: 1MB</p>
                              </>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission Row */}
                  <div className="p-5 bg-white border-t border-zinc-100 flex-shrink-0 space-y-2">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#10b981] text-white py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit for Verification'}
                    </button>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest text-center font-sans">
                      <ShieldCheck className="w-3 h-3 inline mr-1 text-emerald-500" />
                      Admin will verify your payment within 15-30 minutes
                    </p>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}

        {showWithdraw && (
          <Modal title={showWithdrawConfirm ? "Confirm Withdrawal" : "Withdraw Money"} onClose={() => { setShowWithdraw(false); setShowWithdrawConfirm(false); }}>
            <div className="space-y-6">
              {showWithdrawConfirm ? (
                <div className="space-y-6">
                  <div className="bg-zinc-800/50 p-6 rounded-3xl border border-zinc-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Withdrawal Amount</span>
                      <span className="text-xl font-black text-white">₹{parseFloat(withdrawAmount).toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-zinc-700" />
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Bank Details Review</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">Account Holder</p>
                          <p className="text-sm font-black text-white">{userData.bankDetails?.accountHolderName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">Account Number</p>
                          <p className="text-sm font-black text-white">{userData.bankDetails?.accountNumber}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">IFSC Code</p>
                          <p className="text-sm font-black text-white">{userData.bankDetails?.ifscCode}</p>
                        </div>
                        {userData.bankDetails?.upiId && (
                          <div>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase">UPI ID</p>
                            <p className="text-sm font-black text-white">{userData.bankDetails?.upiId}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowWithdrawConfirm(false)}
                      className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black text-sm hover:bg-zinc-700 transition-all border border-zinc-700"
                    >
                      Back
                    </button>
                    <button 
                      onClick={processWithdraw}
                      disabled={loading}
                      className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirm Withdraw'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Bank Details Section */}
                  <div className="bg-zinc-800/50 p-6 rounded-3xl border border-zinc-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
                        <Landmark className="w-4 h-4 text-emerald-500" />
                        Payment Details
                      </h3>
                    </div>
                    
                    <form onSubmit={handleUpdateBankDetails} className="space-y-3">
                      <input 
                        type="text"
                        value={bankDetails.accountHolderName}
                        onChange={(e) => setBankDetails({...bankDetails, accountHolderName: e.target.value})}
                        placeholder="Account Holder Name"
                        className="w-full bg-zinc-900 border-zinc-700 border-2 rounded-xl py-3 px-4 text-sm font-bold text-white placeholder:text-zinc-600"
                        required
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                          placeholder="Account Number"
                          className="w-full bg-zinc-900 border-zinc-700 border-2 rounded-xl py-3 px-4 text-sm font-bold text-white placeholder:text-zinc-600"
                          required
                        />
                        <input 
                          type="text"
                          value={bankDetails.ifscCode}
                          onChange={(e) => setBankDetails({...bankDetails, ifscCode: e.target.value})}
                          placeholder="IFSC Code"
                          className="w-full bg-zinc-900 border-zinc-700 border-2 rounded-xl py-3 px-4 text-sm font-bold text-white placeholder:text-zinc-600"
                          required
                        />
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-zinc-600 text-[10px] font-black">OR</span>
                        </div>
                        <input 
                          type="text"
                          value={bankDetails.upiId}
                          onChange={(e) => setBankDetails({...bankDetails, upiId: e.target.value})}
                          placeholder="UPI ID (optional)"
                          className="w-full bg-zinc-900 border-zinc-700 border-2 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-white placeholder:text-zinc-600"
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-zinc-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-700 transition-all border border-zinc-700"
                      >
                        Update Details
                      </button>
                    </form>
                  </div>

                  {/* Withdrawal Limits Display */}
                  {(() => {
                    if (!globalSettings?.withdrawalLimits) return null;
                    const limits = globalSettings.withdrawalLimits;
                    const now = new Date();
                    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                    const tempWeek = new Date(now);
                    const startOfWeek = new Date(tempWeek.setDate(tempWeek.getDate() - tempWeek.getDay())).toISOString();
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

                    const withdraws = transactions.filter(t => t.type === 'Withdraw' && t.status !== 'Rejected');
                    
                    const dailyTotal = withdraws.filter(t => t.createdAt >= startOfDay).reduce((sum, t) => sum + t.amount, 0);
                    const remainingDaily = Math.max(0, limits.daily - dailyTotal);

                    return (
                      <div className="bg-zinc-800/30 border border-zinc-800 p-4 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400 font-medium">Daily Withdrawal Limit:</span>
                          <span className="text-emerald-400 font-bold">₹{remainingDaily.toLocaleString()} / ₹{limits.daily.toLocaleString()} left</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${(remainingDaily / limits.daily) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider text-center mt-1">
                          You can withdraw daily up to ₹{limits.daily.toLocaleString()} from your wallet balance
                        </p>
                      </div>
                    );
                  })()}

                  {/* Withdraw Form */}
                  <form onSubmit={handleWithdrawRequest} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Withdraw Amount (₹)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-500">₹</span>
                        <input 
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-zinc-800/50 border-zinc-700 border-2 rounded-2xl py-5 pl-12 pr-6 focus:border-emerald-500 focus:ring-0 transition-all font-black text-2xl text-white font-display"
                          required
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={loading || !userData.bankDetails}
                      className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Request Withdraw'}
                    </button>
                    {!userData.bankDetails && <p className="text-center text-[10px] text-red-500 font-bold uppercase tracking-widest">Please update bank details first</p>}
                  </form>
                </>
              )}
            </div>
          </Modal>
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

function Modal({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="relative w-full max-w-md bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl border border-zinc-800"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-white tracking-tight font-display">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 rotate-[-90deg] text-zinc-500" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

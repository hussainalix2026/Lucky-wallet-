import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { UserData } from '../App';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus, History, ChevronLeft, CreditCard, Landmark, Send, AlertCircle, CheckCircle2, Clock, Trophy, Loader2, ShieldCheck, ExternalLink, QrCode, Sparkles, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import StripePayment from './StripePayment';
import RazorpayPayment from './RazorpayPayment';

interface WalletProps {
  userData: UserData | null;
  onBack: () => void;
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

export default function Wallet({ userData, onBack }: WalletProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [razorpayOrder, setRazorpayOrder] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'razorpay' | 'upi'>('upi');
  const [activeMerchantName, setActiveMerchantName] = useState('Digital Services');

  const merchantNames = [
    'Digital Services', 'Fast Checkout', 'Global Payments', 'Reliable Pay',
    'Instant Settlement', 'Skyline Ventures', 'V-Care Payments', 'Zenith Solutions',
    'Apex Enterprises', 'Nexus Digital', 'Prime Secure', 'Orbit Payments',
    'Stellar Services', 'Nova Traders', 'Core Fintech', 'Pulse Digitals',
    'Quantum Pay', 'Ultra Transact', 'Rapid Settle', 'Glance Services'
  ];

  useEffect(() => {
    const randomName = merchantNames[Math.floor(Math.random() * merchantNames.length)];
    setActiveMerchantName(randomName);
  }, [showDeposit]); // Change every time deposit modal is opened
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [isDepositSubmitted, setIsDepositSubmitted] = useState(false);

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
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const withdraws = transactions.filter(t => t.type === 'Withdraw' && t.status !== 'Rejected');
      
      const dailyTotal = withdraws.filter(t => t.createdAt >= startOfDay).reduce((sum, t) => sum + t.amount, 0);
      const weeklyTotal = withdraws.filter(t => t.createdAt >= startOfWeek).reduce((sum, t) => sum + t.amount, 0);
      const monthlyTotal = withdraws.filter(t => t.createdAt >= startOfMonth).reduce((sum, t) => sum + t.amount, 0);

      if (dailyTotal + amount > limits.daily) {
        setMessage({ type: 'error', text: `Daily withdrawal limit exceeded. Remaining: ₹${limits.daily - dailyTotal}` });
        return;
      }
      if (weeklyTotal + amount > limits.weekly) {
        setMessage({ type: 'error', text: `Weekly withdrawal limit exceeded. Remaining: ₹${limits.weekly - weeklyTotal}` });
        return;
      }
      if (monthlyTotal + amount > limits.monthly) {
        setMessage({ type: 'error', text: `Monthly withdrawal limit exceeded. Remaining: ₹${limits.monthly - monthlyTotal}` });
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
              onClick={() => setShowDeposit(true)}
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
                key={tx.id} 
                className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden group hover:bg-zinc-800 transition-all"
              >
                <div 
                  onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                      tx.type === 'Deposit' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      tx.type === 'Winning' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                      tx.type === 'Referral Bonus' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                      'bg-orange-500/10 text-orange-500 border-orange-500/20'
                    }`}>
                      {tx.type === 'Deposit' ? <ArrowDownLeft className="w-6 h-6" /> : 
                       tx.type === 'Winning' ? <Trophy className="w-6 h-6" /> : 
                       tx.type === 'Referral Bonus' ? <Sparkles className="w-6 h-6" /> :
                       <ArrowUpRight className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
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
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm tracking-tight ${tx.type === 'Withdraw' ? 'text-white' : 'text-emerald-500'}`}>
                      {tx.type === 'Withdraw' ? '-' : '+'}₹{tx.amount.toLocaleString()}
                    </p>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      tx.status === 'Success' ? 'bg-emerald-500/10 text-emerald-500' : 
                      tx.status === 'Pending' ? 'bg-orange-500/10 text-orange-500 animate-pulse' : 
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {tx.status === 'Pending' ? 'Awaiting Approval' : tx.status}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedTxId === tx.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 border-t border-zinc-800 pt-4 space-y-3"
                    >
                      {tx.utr && (
                        <div className="flex justify-between items-center bg-zinc-800/50 p-3 rounded-xl border border-zinc-700">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">UTR Number</span>
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-black text-white tracking-wider">{tx.utr}</span>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 navigator.clipboard.writeText(tx.utr!);
                                 setMessage({ type: 'success', text: 'UTR Copied!' });
                               }}
                               className="p-1 hover:bg-zinc-700 rounded transition-all"
                             >
                               <Copy className="w-3 h-3 text-zinc-500" />
                             </button>
                          </div>
                        </div>
                      )}
                      {tx.bankDetails && tx.type === 'Withdraw' && (
                        <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 space-y-2">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Withdrawal Bank Details</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Holder</p>
                              <p className="text-[10px] font-black text-white">{tx.bankDetails.accountHolderName}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Account</p>
                              <p className="text-[10px] font-black text-white">{tx.bankDetails.accountNumber}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">IFSC</p>
                              <p className="text-[10px] font-black text-white">{tx.bankDetails.ifscCode}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">UPI ID</p>
                              <p className="text-[10px] font-black text-white">{tx.bankDetails.upiId}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {tx.reason && tx.status === 'Rejected' && (
                        <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Reason for Rejection</p>
                          <p className="text-xs font-bold text-red-400">{tx.reason}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Transaction ID</span>
                        <span className="text-[8px] font-mono text-zinc-600">{tx.id}</span>
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
          <Modal title={isDepositSubmitted ? "Deposit Pending" : "Add Money"} onClose={() => { setShowDeposit(false); setClientSecret(null); setRazorpayOrder(null); setIsDepositSubmitted(false); }}>
            {isDepositSubmitted ? (
              <div className="flex flex-col items-center gap-6 py-8 text-center">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center border-4 border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                  <Clock className="w-10 h-10 text-emerald-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">Request Submitted!</h3>
                  <p className="text-zinc-500 text-sm font-medium px-4">
                    Our admin team is verifying your payment. Your balance will be updated automatically within 15-30 minutes.
                  </p>
                </div>
                <div className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-500">Status</span>
                    <span className="text-orange-500">Verifying</span>
                  </div>
                  <div className="h-px bg-zinc-800" />
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Est. Time</span>
                    <span className="text-white">~20 Mins</span>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowDeposit(false); setIsDepositSubmitted(false); }}
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 transition-all"
                >
                  Done
                </button>
              </div>
            ) : !clientSecret && !razorpayOrder ? (
              <form onSubmit={handleDepositRequest} className="space-y-6">
                <div className="bg-zinc-800/50 p-6 rounded-3xl border border-dashed border-zinc-700 flex flex-col items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                    <CreditCard className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center">Secure deposit via {paymentMethod === 'stripe' ? 'Stripe' : paymentMethod === 'razorpay' ? 'Razorpay' : 'Manual UPI'}</p>
                </div>

                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`flex-1 min-w-[100px] py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${paymentMethod === 'upi' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                  >
                    Manual UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('razorpay')}
                    className={`flex-1 min-w-[100px] py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${paymentMethod === 'razorpay' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                  >
                    Razorpay
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('stripe')}
                    className={`flex-1 min-w-[100px] py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${paymentMethod === 'stripe' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                  >
                    Stripe
                  </button>
                </div>

                {paymentMethod === 'upi' && depositAmount && (
                  <div className="bg-white p-6 rounded-[2.5rem] mb-6 flex flex-col items-center gap-6 shadow-xl border border-zinc-100 ring-4 ring-emerald-500/10">
                    <div className="w-full flex justify-between items-center px-2">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" className="h-4 object-contain opacity-70" alt="UPI" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/c/cc/BHIM_logo.png" className="h-5 object-contain opacity-70" alt="BHIM" />
                    </div>

                    <div className="relative group p-4 bg-zinc-50 rounded-3xl border border-zinc-100">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(globalSettings?.upiSettings?.paymentLink || `upi://pay?pa=${globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69'}&pn=${activeMerchantName}&am=${depositAmount}&cu=INR`)}`}
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
                          <p className="text-3xl font-black text-zinc-900 tracking-tighter">₹{depositAmount}</p>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(depositAmount);
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
                            href={`phonepe://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                            className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                          >
                            <img src="https://img.icons8.com/color/48/phone-pe.png" className="w-8 h-8 grayscale group-hover:grayscale-0 transition-all" alt="PhonePe" />
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">PhonePe</span>
                          </a>
                          <a 
                            href={`paytmmp://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                            className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                          >
                            <img src="https://img.icons8.com/color/48/paytm.png" className="w-8 h-8 grayscale group-hover:grayscale-0 transition-all" alt="Paytm" />
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Paytm</span>
                          </a>
                          <a 
                            href={`googlepay://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                            className="flex flex-col items-center gap-1.5 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-emerald-500 transition-all group"
                          >
                            <img src="https://img.icons8.com/color/48/google-pay.png" className="w-8 h-8 grayscale group-hover:grayscale-0 transition-all" alt="GPay" />
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">G-Pay</span>
                          </a>
                        </div>
                        <a 
                          href={globalSettings?.upiSettings?.paymentLink || `upi://pay?pa=${encodeURIComponent(globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69')}&pn=${encodeURIComponent(activeMerchantName)}&am=${depositAmount}&cu=INR`}
                          className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/30"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Payment App
                        </a>

                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between group">
                          <div className="flex flex-col items-start">
                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">UPI ID</span>
                            <span className="text-[11px] font-bold text-zinc-900">{globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69'}</span>
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

                      <div className="flex items-center gap-2 justify-center py-2 px-4 bg-yellow-50 rounded-xl border border-yellow-100">
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                        <p className="text-[9px] font-bold text-yellow-700 uppercase tracking-tight text-left">Upload screenshot of transaction below</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-500">₹</span>
                      <input 
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-800/50 border-zinc-700 border-2 rounded-2xl py-5 pl-12 pr-6 focus:border-emerald-500 focus:ring-0 transition-all font-black text-2xl text-white font-display"
                        required
                      />
                    </div>
                  </div>

                  {paymentMethod === 'upi' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Transaction ID (UTR)</label>
                        <input 
                          type="text" 
                          value={utr}
                          onChange={(e) => setUtr(e.target.value)}
                          placeholder="Enter 12-digit UTR"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                          required={paymentMethod === 'upi'}
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
                            required={paymentMethod === 'upi'}
                          />
                          <label 
                            htmlFor="screenshot-upload"
                            className="w-full bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-emerald-500 transition-all"
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
                    </div>
                  )}
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (paymentMethod === 'upi' ? 'Submit for Verification' : 'Continue to Payment')}
                </button>
                {paymentMethod === 'upi' && (
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-center mt-2">
                    <ShieldCheck className="w-3 h-3 inline mr-1 text-emerald-500" />
                    Admin will verify your payment within 15-30 minutes
                  </p>
                )}
              </form>
            ) : clientSecret ? (
              <div className="bg-white p-6 rounded-3xl">
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
            ) : (
              <RazorpayPayment
                orderId={razorpayOrder.id}
                amount={parseFloat(depositAmount)}
                userData={{
                  uid: userData.uid,
                  fullName: userData.fullName,
                  phoneNumber: userData.phoneNumber,
                }}
                onSuccess={() => {
                  setMessage({ type: 'success', text: 'Payment successful! Balance will be updated shortly.' });
                  setShowDeposit(false);
                  setRazorpayOrder(null);
                  setDepositAmount('');
                }}
                onCancel={() => setRazorpayOrder(null)}
              />
            )}
          </Modal>
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

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, writeBatch, increment, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { ShieldCheck, ChevronLeft, CheckCircle2, XCircle, Users, Wallet, Trophy, Clock, AlertCircle, Search, CreditCard, Send, Plus, Settings, Ticket, Copy, Camera, QrCode, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface AdminPanelProps {
  onBack: () => void;
}

type AdminTab = 'deposits' | 'withdraws' | 'results' | 'users' | 'tickets' | 'settings' | 'verifications';

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('deposits');
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdraws, setPendingWithdraws] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [purchasedNumbers, setPurchasedNumbers] = useState<any[]>([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'All' | 'Pending' | 'Won' | 'Lost'>('All');
  const [selectedUserForTickets, setSelectedUserForTickets] = useState<any | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [winningNumber, setWinningNumber] = useState('');
  const [withdrawUtrs, setWithdrawUtrs] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [withdrawalLimits, setWithdrawalLimits] = useState({
    daily: 5000,
    weekly: 25000,
    monthly: 100000
  });
  const [referralBonus, setReferralBonus] = useState({
    referrer: 50,
    referee: 20
  });

  useEffect(() => {
    // Pending Deposits
    const qDep = query(collection(db, 'transactions'), where('type', '==', 'Deposit'), where('status', '==', 'Pending'));
    const unsubDep = onSnapshot(qDep, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingDeposits(docs);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'transactions'));

    // Pending Withdraws
    const qWit = query(collection(db, 'transactions'), where('type', '==', 'Withdraw'), where('status', '==', 'Pending'));
    const unsubWit = onSnapshot(qWit, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingWithdraws(docs);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'transactions'));

    // Users
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => (b.balance || 0) - (a.balance || 0));
      setUsers(docs);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));

    // Global Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.withdrawalLimits) {
          setWithdrawalLimits(data.withdrawalLimits);
        }
        if (data.referralBonus) {
          setReferralBonus(data.referralBonus);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/global'));

    // All Purchased Numbers for Admin
    const qPurchases = query(collection(db, 'purchasedNumbers'));
    const unsubPurchases = onSnapshot(qPurchases, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPurchasedNumbers(docs);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'purchasedNumbers'));

    // Payment Verifications
    const qVer = query(collection(db, 'paymentVerifications'), where('status', '==', 'Pending'));
    const unsubVer = onSnapshot(qVer, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setVerifications(docs);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'paymentVerifications'));

    return () => { unsubDep(); unsubWit(); unsubUsers(); unsubSettings(); unsubPurchases(); unsubVer(); };
  }, []);

  const handleApproveDeposit = async (tx: any) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', tx.id), { status: 'Success' });
      
      if (tx.isDirectPurchase) {
        // Find and approve the purchased numbers
        const q = query(collection(db, 'purchasedNumbers'), where('uid', '==', tx.uid), where('utr', '==', tx.utr), where('status', '==', 'Pending'));
        const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'purchasedNumbers'));
        if (snap) {
          snap.docs.forEach(pDoc => {
            batch.update(pDoc.ref, { status: 'Active' });
          });
        }
      } else {
        batch.update(doc(db, 'users', tx.uid), { balance: increment(tx.amount) });
      }

      // Referral Bonus Logic
      const userDocRef = doc(db, 'users', tx.uid);
      let userDocSnap;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${tx.uid}`);
      }
      const userData = (userDocSnap && userDocSnap.exists()) ? userDocSnap.data() : null;

      if (userData && userData.referredBy && !userData.hasReceivedReferralBonus) {
        // Credit Referee
        batch.update(userDocRef, { 
          balance: increment(referralBonus.referee),
          hasReceivedReferralBonus: true 
        });
        // Add transaction for referee
        const refereeTxRef = doc(collection(db, 'transactions'));
        batch.set(refereeTxRef, {
          uid: tx.uid,
          amount: referralBonus.referee,
          type: 'Referral Bonus',
          status: 'Success',
          createdAt: new Date().toISOString(),
          description: 'Welcome bonus for joining via referral'
        });

        // Credit Referrer
        const referrerRef = doc(db, 'users', userData.referredBy);
        batch.update(referrerRef, { balance: increment(referralBonus.referrer) });
        // Add transaction for referrer
        const referrerTxRef = doc(collection(db, 'transactions'));
        batch.set(referrerTxRef, {
          uid: userData.referredBy,
          amount: referralBonus.referrer,
          type: 'Referral Bonus',
          status: 'Success',
          createdAt: new Date().toISOString(),
          description: `Bonus for referring ${userData.fullName}`
        });
      }

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'batch-approve-deposit'));
      setMessage({ type: 'success', text: tx.isDirectPurchase ? 'Direct purchase approved and tickets activated!' : 'Deposit approved and balance updated!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve deposit.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDeposit = async (tx: any) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', tx.id), { status: 'Rejected', reason: 'Invalid UTR or Payment not received' });

      if (tx.isDirectPurchase) {
        // Find and reject the purchased numbers
        const q = query(collection(db, 'purchasedNumbers'), where('uid', '==', tx.uid), where('utr', '==', tx.utr), where('status', '==', 'Pending'));
        const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'purchasedNumbers'));
        if (snap) {
          snap.docs.forEach(pDoc => {
            batch.update(pDoc.ref, { status: 'Rejected' });
          });
        }
      }

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'batch-reject-deposit'));
      setMessage({ type: 'success', text: 'Deposit rejected.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reject deposit.' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWithdraw = async (tx: any) => {
    setLoading(true);
    try {
      const utr = withdrawUtrs[tx.id];
      await updateDoc(doc(db, 'transactions', tx.id), { 
        status: 'Success',
        utr: utr || null
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `transactions/${tx.id}`));
      setMessage({ type: 'success', text: 'Withdrawal marked as success!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve withdrawal.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectWithdraw = async (tx: any) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', tx.id), { status: 'Rejected', reason: 'Invalid Bank Details or Other Reason' });
      batch.update(doc(db, 'users', tx.uid), { balance: increment(tx.amount) }); // Refund balance
      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'batch-reject-withdraw'));
      setMessage({ type: 'success', text: 'Withdrawal rejected and balance refunded!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reject withdrawal.' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveVerification = async (ver: any) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'paymentVerifications', ver.id), { status: 'Approved' });
      setMessage({ type: 'success', text: 'Verification approved! Please manually credit the user or activate their ticket based on the proof.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve verification.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectVerification = async (ver: any) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'paymentVerifications', ver.id), { status: 'Rejected' });
      setMessage({ type: 'success', text: 'Verification rejected.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reject verification.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        withdrawalLimits,
        referralBonus
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'settings/global'));
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetResult = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(winningNumber);
    if (isNaN(num) || num < 1 || num > 100) return;

    setLoading(true);
    try {
      const drawDate = new Date().toISOString().split('T')[0];
      
      // 1. Get all pending purchases for today
      const q = query(collection(db, 'purchasedNumbers'), where('drawDate', '==', drawDate), where('status', '==', 'Pending'));
      const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'purchasedNumbers'));
      
      if (!snap) return;

      const batch = writeBatch(db);
      let totalPayout = 0;
      let winnersCount = 0;

      snap.docs.forEach(purchaseDoc => {
        const purchase = purchaseDoc.data();
        if (purchase.number === num) {
          // Winner!
          batch.update(purchaseDoc.ref, { status: 'Won' });
          batch.update(doc(db, 'users', purchase.uid), { balance: increment(purchase.winningAmount) });
          // Add winning transaction
          const txRef = doc(collection(db, 'transactions'));
          batch.set(txRef, {
            uid: purchase.uid,
            amount: purchase.winningAmount,
            type: 'Winning',
            status: 'Success',
            createdAt: new Date().toISOString()
          });
          totalPayout += purchase.winningAmount;
          winnersCount++;
        } else {
          // Loser
          batch.update(purchaseDoc.ref, { status: 'Lost' });
        }
      });

      // 2. Create result record
      const resultRef = doc(collection(db, 'results'));
      batch.set(resultRef, {
        number: num,
        drawDate,
        winnersCount,
        totalPayout,
        createdAt: new Date().toISOString()
      });

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'batch-set-result'));
      setMessage({ type: 'success', text: `Result set! ${winnersCount} winners found.` });
      setWinningNumber('');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to set result.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-zinc-50 flex flex-col">
      {/* Admin Header */}
      <div className="bg-zinc-900 text-white p-6 rounded-b-[2.5rem] shadow-xl">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              Admin Panel
            </h1>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Full Control System</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <TabButton active={activeTab === 'deposits'} onClick={() => setActiveTab('deposits')} icon={<Plus className="w-4 h-4" />} label="Dep" />
          <TabButton active={activeTab === 'withdraws'} onClick={() => setActiveTab('withdraws')} icon={<Send className="w-4 h-4" />} label="Wit" />
          <TabButton active={activeTab === 'verifications'} onClick={() => setActiveTab('verifications')} icon={<Camera className="w-4 h-4" />} label="Ver" />
          <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')} icon={<Trophy className="w-4 h-4" />} label="Res" />
          <TabButton active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={<Ticket className="w-4 h-4" />} label="Tkt" />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users className="w-4 h-4" />} label="Usr" />
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="w-4 h-4" />} label="Set" />
        </div>
      </div>

      {/* Admin Content */}
      <div className="flex-1 p-6 space-y-6 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'deposits' && (
            <motion.div key="deposits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Pending Deposits ({pendingDeposits.length})
              </h3>
              {pendingDeposits.map(tx => (
                <div key={tx.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-lg text-zinc-900">₹{tx.amount}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">UTR: {tx.utr}</p>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(tx.utr);
                            setMessage({ type: 'success', text: 'UTR copied!' });
                          }}
                          className="p-1 hover:bg-zinc-100 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3 text-zinc-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">
                          {tx.paymentMethod || (tx.stripePaymentIntentId ? 'Stripe' : tx.razorpayPaymentId ? 'Razorpay' : 'Unknown')}
                        </p>
                        <div className="flex items-center gap-1">
                          {(tx.paymentMethod === 'Stripe' || tx.stripePaymentIntentId) && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                          {(tx.paymentMethod === 'Razorpay' || tx.razorpayPaymentId) && <CreditCard className="w-3 h-3 text-emerald-500" />}
                          {tx.paymentMethod === 'Manual UPI' && <QrCode className="w-3 h-3 text-emerald-500" />}
                          {tx.paymentMethod === 'Wallet' && <Wallet className="w-3 h-3 text-emerald-500" />}
                        </div>
                      </div>
                      {tx.screenshot && (
                        <button 
                          onClick={() => setSelectedScreenshot(tx.screenshot)}
                          className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                        >
                          <CreditCard className="w-3 h-3" /> View Screenshot
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <p className="text-xs font-bold text-zinc-900">User ID: {tx.uid.slice(0, 8)}...</p>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(tx.uid);
                            setMessage({ type: 'success', text: 'User ID copied!' });
                          }}
                          className="p-1 hover:bg-zinc-100 rounded transition-colors"
                        >
                          <Copy className="w-3 h-3 text-zinc-400" />
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      {tx.isDirectPurchase && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                          Direct Purchase
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleApproveDeposit(tx)}
                      disabled={loading}
                      className="bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button 
                      onClick={() => handleRejectDeposit(tx)}
                      disabled={loading}
                      className="bg-red-50 text-red-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest border border-red-100 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingDeposits.length === 0 && <EmptyState icon={<CheckCircle2 className="w-12 h-12" />} text="No pending deposits" />}
            </motion.div>
          )}

          {activeTab === 'withdraws' && (
            <motion.div key="withdraws" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Pending Withdrawals ({pendingWithdraws.length})
              </h3>
              {pendingWithdraws.map(tx => (
                <div key={tx.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-lg text-zinc-900">₹{tx.amount}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">UID: {tx.uid.slice(0, 8)}...</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-600">Manual Payment Required</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Bank Details for Withdrawal */}
                  {tx.bankDetails && (
                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-2">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Bank Details</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-zinc-500 font-bold">Holder</p>
                          <p className="font-black text-zinc-900">{tx.bankDetails.accountHolderName}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 font-bold">Account</p>
                          <p className="font-black text-zinc-900">{tx.bankDetails.accountNumber}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 font-bold">IFSC</p>
                          <p className="font-black text-zinc-900">{tx.bankDetails.ifscCode}</p>
                        </div>
                        {tx.bankDetails.upiId && (
                          <div>
                            <p className="text-zinc-500 font-bold">UPI ID</p>
                            <p className="font-black text-zinc-900">{tx.bankDetails.upiId}</p>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          const details = `Name: ${tx.bankDetails.accountHolderName}\nAcc: ${tx.bankDetails.accountNumber}\nIFSC: ${tx.bankDetails.ifscCode}${tx.bankDetails.upiId ? `\nUPI: ${tx.bankDetails.upiId}` : ''}`;
                          navigator.clipboard.writeText(details);
                          setMessage({ type: 'success', text: 'Bank details copied to clipboard!' });
                        }}
                        className="w-full mt-2 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Copy Details
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <input 
                      type="text"
                      placeholder="Enter UTR / Transaction ID"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 focus:outline-none focus:border-emerald-500 transition-colors"
                      onChange={(e) => setWithdrawUtrs({...withdrawUtrs, [tx.id]: e.target.value})}
                      value={withdrawUtrs[tx.id] || ''}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleApproveWithdraw(tx)}
                        disabled={loading}
                        className="bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Paid
                      </button>
                      <button 
                        onClick={() => handleRejectWithdraw(tx)}
                        disabled={loading}
                        className="bg-red-50 text-red-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest border border-red-100 flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {pendingWithdraws.length === 0 && <EmptyState icon={<CheckCircle2 className="w-12 h-12" />} text="No pending withdrawals" />}
            </motion.div>
          )}

          {activeTab === 'verifications' && (
            <motion.div key="verifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-500" />
                Payment Verifications ({verifications.length})
              </h3>
              {verifications.map(ver => (
                <div key={ver.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">UTR: {ver.utr}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Purchase: {ver.purchaseNumber}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">User: {ver.userEmail || ver.uid.slice(0, 8)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Manual UPI</p>
                        <QrCode className="w-3 h-3 text-emerald-500" />
                      </div>
                      <button 
                        onClick={() => setSelectedScreenshot(ver.screenshot)}
                        className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                      >
                        <CreditCard className="w-3 h-3" /> View Proof Screenshot
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{new Date(ver.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleApproveVerification(ver)}
                      disabled={loading}
                      className="bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button 
                      onClick={() => handleRejectVerification(ver)}
                      disabled={loading}
                      className="bg-red-50 text-red-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest border border-red-100 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              ))}
              {verifications.length === 0 && <EmptyState icon={<Camera className="w-12 h-12" />} text="No pending verifications" />}
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-purple-100">
                    <Trophy className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Set Daily Result</h3>
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Result time: Daily at 4:00 PM</p>
                </div>

                <form onSubmit={handleSetResult} className="space-y-4">
                  <div className="space-y-1 text-center">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Winning Number (1-100)</label>
                    <input 
                      type="number"
                      value={winningNumber}
                      onChange={(e) => setWinningNumber(e.target.value)}
                      placeholder="00"
                      className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-3xl py-6 text-center text-4xl font-black focus:border-purple-500 focus:ring-0 transition-all"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-purple-200 hover:bg-purple-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Processing Winners...' : 'Declare Result'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-6">
                <form onSubmit={handleUpdateSettings} className="space-y-8">
                  <div className="space-y-6">
                    <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                      <Settings className="w-5 h-5 text-emerald-500" />
                      Withdrawal Limits
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Daily Limit (₹)</label>
                        <input 
                          type="number"
                          value={withdrawalLimits.daily}
                          onChange={(e) => setWithdrawalLimits({...withdrawalLimits, daily: parseInt(e.target.value)})}
                          className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 px-6 focus:border-emerald-500 focus:ring-0 transition-all font-black text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Weekly Limit (₹)</label>
                        <input 
                          type="number"
                          value={withdrawalLimits.weekly}
                          onChange={(e) => setWithdrawalLimits({...withdrawalLimits, weekly: parseInt(e.target.value)})}
                          className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 px-6 focus:border-emerald-500 focus:ring-0 transition-all font-black text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Monthly Limit (₹)</label>
                        <input 
                          type="number"
                          value={withdrawalLimits.monthly}
                          onChange={(e) => setWithdrawalLimits({...withdrawalLimits, monthly: parseInt(e.target.value)})}
                          className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 px-6 focus:border-emerald-500 focus:ring-0 transition-all font-black text-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                      <Gift className="w-5 h-5 text-purple-500" />
                      Referral Bonus Settings
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Referrer Bonus (₹)</label>
                        <input 
                          type="number"
                          value={referralBonus.referrer}
                          onChange={(e) => setReferralBonus({...referralBonus, referrer: parseInt(e.target.value)})}
                          className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 px-6 focus:border-purple-500 focus:ring-0 transition-all font-black text-lg"
                        />
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest ml-1">Amount given to the person who shared the link</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Referee Bonus (₹)</label>
                        <input 
                          type="number"
                          value={referralBonus.referee}
                          onChange={(e) => setReferralBonus({...referralBonus, referee: parseInt(e.target.value)})}
                          className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 px-6 focus:border-purple-500 focus:ring-0 transition-all font-black text-lg"
                        />
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest ml-1">Amount given to the new user who joined</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Save All Settings'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'tickets' && (
            <motion.div key="tickets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex flex-col gap-4">
                <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-emerald-500" />
                  All Purchased Numbers ({purchasedNumbers.length})
                </h3>
                
                {/* Search and Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text"
                      placeholder="Search by name or phone..."
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      className="w-full bg-white border-zinc-100 border-2 rounded-2xl py-3 pl-11 pr-4 focus:border-emerald-500 focus:ring-0 transition-all text-sm font-medium"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {['All', 'Pending', 'Won', 'Lost'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setTicketFilter(f as any)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                          ticketFilter === f 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-white text-zinc-400 border border-zinc-100'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {purchasedNumbers
                  .filter(ticket => {
                    const user = users.find(u => u.id === ticket.uid);
                    const searchMatch = !ticketSearch || 
                      (user?.fullName?.toLowerCase()?.includes(ticketSearch.toLowerCase()) || 
                       user?.phoneNumber?.includes(ticketSearch));
                    const filterMatch = ticketFilter === 'All' || ticket.status === ticketFilter;
                    return searchMatch && filterMatch;
                  })
                  .map(ticket => {
                    const user = users.find(u => u.id === ticket.uid);
                    return (
                      <div key={ticket.id} className="bg-white p-4 rounded-2xl border border-zinc-100 flex items-center gap-4 shadow-sm">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                          ticket.status === 'Won' ? 'bg-emerald-100 text-emerald-600' : 
                          ticket.status === 'Lost' ? 'bg-red-100 text-red-600' : 
                          'bg-zinc-100 text-zinc-600'
                        }`}>
                          {ticket.number}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-zinc-900 tracking-tight">{user?.fullName || 'Unknown User'}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                            {user?.phoneNumber || ticket.uid.slice(0, 8)} • {new Date(ticket.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[8px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">
                            Draw: {ticket.drawDate} {ticket.utr && `• UTR: ${ticket.utr}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-zinc-900">₹{ticket.amount}</p>
                          <p className={`text-[8px] font-black uppercase tracking-widest ${
                            ticket.status === 'Won' ? 'text-emerald-500' : 
                            ticket.status === 'Lost' ? 'text-red-400' : 
                            'text-zinc-400'
                          }`}>{ticket.status}</p>
                        </div>
                      </div>
                    );
                  })}
                {purchasedNumbers.length === 0 && <EmptyState icon={<Ticket className="w-12 h-12" />} text="No numbers purchased yet" />}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-white border-zinc-100 border-2 rounded-2xl py-4 pl-12 pr-4 focus:border-emerald-500 focus:ring-0 transition-all font-medium"
                />
              </div>
              <div className="space-y-3">
                {users
                  .filter(u => 
                    (u.fullName?.toLowerCase()?.includes(userSearch.toLowerCase()) || 
                     u.phoneNumber?.includes(userSearch))
                  )
                  .map(user => {
                    const userTickets = purchasedNumbers.filter(t => t.uid === user.id);
                    return (
                      <div key={user.id} className="bg-white p-4 rounded-2xl border border-zinc-100 flex items-center gap-4 shadow-sm hover:border-emerald-500/50 transition-colors">
                        <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                          <Users className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-zinc-900 tracking-tight">{user.fullName}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{user.phoneNumber}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Ticket className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{userTickets.length} Tickets</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <div>
                            <p className="font-black text-emerald-600">₹{user.balance}</p>
                            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Balance</p>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedUserForTickets(user);
                            }}
                            className="px-3 py-1.5 bg-zinc-900 text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-500 transition-colors"
                          >
                            View Numbers
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Tickets Modal */}
      <AnimatePresence>
        {selectedUserForTickets && (
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUserForTickets(null)}
              className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-lg bg-zinc-50 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 bg-white border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedUserForTickets.fullName}</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{selectedUserForTickets.phoneNumber}</p>
                </div>
                <button 
                  onClick={() => setSelectedUserForTickets(null)}
                  className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-zinc-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
                {purchasedNumbers
                  .filter(t => t.uid === selectedUserForTickets.id)
                  .map(ticket => (
                    <div key={ticket.id} className="bg-white p-4 rounded-2xl border border-zinc-100 flex items-center gap-4 shadow-sm">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                        ticket.status === 'Won' ? 'bg-emerald-100 text-emerald-600' : 
                        ticket.status === 'Lost' ? 'bg-red-100 text-red-600' : 
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {ticket.number}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-[8px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">
                          Draw: {ticket.drawDate} {ticket.utr && `• UTR: ${ticket.utr}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-zinc-900">₹{ticket.amount}</p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${
                          ticket.status === 'Won' ? 'text-emerald-500' : 
                          ticket.status === 'Lost' ? 'text-red-400' : 
                          'text-zinc-400'
                        }`}>{ticket.status}</p>
                      </div>
                    </div>
                  ))}
                {purchasedNumbers.filter(t => t.uid === selectedUserForTickets.id).length === 0 && (
                  <div className="text-center py-12">
                    <Ticket className="w-12 h-12 text-zinc-100 mx-auto mb-2" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No tickets found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Screenshot Modal */}
      <AnimatePresence>
        {selectedScreenshot && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedScreenshot(null)}
              className="absolute inset-0 bg-zinc-900/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Payment Proof</h3>
                <button 
                  onClick={() => setSelectedScreenshot(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-zinc-400" />
                </button>
              </div>
              <div className="p-4 bg-zinc-50 flex justify-center items-center min-h-[300px]">
                <img 
                  src={selectedScreenshot} 
                  alt="Payment Screenshot" 
                  className="max-w-full max-h-[70vh] rounded-xl shadow-lg"
                />
              </div>
              <div className="p-6 bg-white border-t border-zinc-100 flex justify-end">
                <button 
                  onClick={() => setSelectedScreenshot(null)}
                  className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all"
                >
                  Close Preview
                </button>
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

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 rounded-2xl transition-all ${active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
    >
      {icon}
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="text-center py-24 bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm">
      <div className="text-zinc-100 mx-auto mb-4 flex justify-center">{icon}</div>
      <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">{text}</p>
    </div>
  );
}

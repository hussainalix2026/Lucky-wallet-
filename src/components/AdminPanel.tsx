import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, writeBatch, increment, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { ShieldCheck, ChevronLeft, CheckCircle2, XCircle, Users, Wallet, Trophy, Clock, AlertCircle, Search, CreditCard, Send, Plus, Settings, Ticket, Copy, Camera, QrCode, Gift, Zap, Landmark, Gamepad2, Trash2, Eye, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface AdminPanelProps {
  onBack: () => void;
  onSpectateLudo?: (gameId: string) => void;
  onJoinLudo?: (gameId: string) => void;
}

type AdminTab = 'deposits' | 'withdraws' | 'results' | 'users' | 'tickets' | 'settings' | 'verifications' | 'fantasy' | 'ludo';

export default function AdminPanel({ onBack, onSpectateLudo, onJoinLudo }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('deposits');
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdraws, setPendingWithdraws] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [purchasedNumbers, setPurchasedNumbers] = useState<any[]>([]);
  const [fantasyMatches, setFantasyMatches] = useState<any[]>([]);
  const [ludoGames, setLudoGames] = useState<any[]>([]);
  const [fantasyPlayers, setFantasyPlayers] = useState<any[]>([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'All' | 'Pending' | 'Won' | 'Lost'>('All');
  const [selectedUserForTickets, setSelectedUserForTickets] = useState<any | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditUser, setCreditUser] = useState<any | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [winningNumber, setWinningNumber] = useState('');
  const [withdrawUtrs, setWithdrawUtrs] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [newMatch, setNewMatch] = useState({ 
    league: '', 
    team1Name: '', team1Short: '', team1Logo: '', 
    team2Name: '', team2Short: '', team2Logo: '', 
    startTime: '', prizePool: '', thumbnail: '' 
  });
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [newPlayer, setNewPlayer] = useState({ 
    name: '', photo: '', role: 'BAT' as any, 
    team: '', credits: 9, selBy: '0%' 
  });
  const [withdrawalLimits, setWithdrawalLimits] = useState({
    daily: 5000,
    weekly: 25000,
    monthly: 100000
  });
  const [referralBonus, setReferralBonus] = useState({
    referrer: 50,
    referee: 20
  });
  const [upiSettings, setUpiSettings] = useState({
    upiId: 'razorpay.me/@grantlucky137',
    paymentLink: 'https://rzp.io/rzp/s8ouvl69'
  });

  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const handleAdminError = (err: any, path: string) => {
      console.error(`Admin Fetch Error (${path}):`, err);
      if (err.message && err.message.includes('permission')) {
        setPermissionError('You do not have permission to access admin data. Please ensure your account is marked as admin.');
      } else {
        handleFirestoreError(err, OperationType.GET, path);
      }
    };

    // Pending Deposits
    const qDep = query(collection(db, 'transactions'), where('type', '==', 'Deposit'), where('status', '==', 'Pending'));
    const unsubDep = onSnapshot(qDep, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingDeposits(docs);
    }, (err) => handleAdminError(err, 'transactions'));

    // Pending Withdraws
    const qWit = query(collection(db, 'transactions'), where('type', '==', 'Withdraw'), where('status', '==', 'Pending'));
    const unsubWit = onSnapshot(qWit, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingWithdraws(docs);
    }, (err) => handleAdminError(err, 'transactions'));

    // Users
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => (b.balance || 0) - (a.balance || 0));
      setUsers(docs);
    }, (err) => handleAdminError(err, 'users'));

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
        if (data.upiSettings) {
          setUpiSettings(data.upiSettings);
        }
      }
    }, (err) => handleAdminError(err, 'settings/global'));

    // All Purchased Numbers for Admin
    const qPurchases = query(collection(db, 'purchasedNumbers'));
    const unsubPurchases = onSnapshot(qPurchases, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPurchasedNumbers(docs);
    }, (err) => handleAdminError(err, 'purchasedNumbers'));

    // Payment Verifications
    const qVer = query(collection(db, 'paymentVerifications'), where('status', '==', 'Pending'));
    const unsubVer = onSnapshot(qVer, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setVerifications(docs);
    }, (err) => handleAdminError(err, 'paymentVerifications'));

    // Fantasy Matches
    const qFantasyMatches = query(collection(db, 'fantasyMatches'));
    const unsubFantasyMatches = onSnapshot(qFantasyMatches, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFantasyMatches(docs);
    }, (err) => handleAdminError(err, 'fantasyMatches'));

    // Fantasy Players
    const qFantasyPlayers = query(collection(db, 'fantasyPlayers'));
    const unsubFantasyPlayers = onSnapshot(qFantasyPlayers, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFantasyPlayers(docs);
    }, (err) => handleAdminError(err, 'fantasyPlayers'));

    // Ludo Games
    const qLudo = query(collection(db, 'ludoGames'));
    const unsubLudo = onSnapshot(qLudo, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLudoGames(docs);
    }, (err) => handleAdminError(err, 'ludoGames'));

    return () => { unsubDep(); unsubWit(); unsubUsers(); unsubSettings(); unsubPurchases(); unsubVer(); unsubFantasyMatches(); unsubFantasyPlayers(); unsubLudo(); };
  }, []);

  const handleManualCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditUser || !creditAmount) return;
    
    setLoading(true);
    try {
      const amount = parseFloat(creditAmount);
      if (isNaN(amount)) throw new Error('Invalid amount');

      const batch = writeBatch(db);
      const userRef = doc(db, 'users', creditUser.id);
      const txRef = doc(collection(db, 'transactions'));

      batch.update(userRef, { balance: increment(amount) });
      batch.set(txRef, {
        uid: creditUser.id,
        amount: amount,
        type: 'Deposit',
        status: 'Success',
        paymentMethod: 'Admin Manual',
        createdAt: new Date().toISOString(),
        description: 'Balance added manually by admin'
      });

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'manual-credit'));
      setMessage({ type: 'success', text: `Successfully credited ₹${amount} to ${creditUser.fullName}` });
      setShowCreditModal(false);
      setCreditAmount('');
      setCreditUser(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to credit balance' });
    } finally {
      setLoading(false);
    }
  };

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
        referralBonus,
        upiSettings
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'settings/global'));
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'fantasyMatches'), {
        league: newMatch.league,
        team1: { name: newMatch.team1Name, short: newMatch.team1Short, logo: newMatch.team1Logo },
        team2: { name: newMatch.team2Name, short: newMatch.team2Short, logo: newMatch.team2Logo },
        startTime: newMatch.startTime,
        prizePool: newMatch.prizePool,
        thumbnail: newMatch.thumbnail,
        isLive: false,
        createdAt: new Date().toISOString()
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'fantasyMatches'));
      setMessage({ type: 'success', text: 'Match added!' });
      setNewMatch({ league: '', team1Name: '', team1Short: '', team1Logo: '', team2Name: '', team2Short: '', team2Logo: '', startTime: '', prizePool: '', thumbnail: '' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add match.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'fantasyPlayers'), {
        ...newPlayer,
        matchId: selectedMatchId,
        createdAt: new Date().toISOString()
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'fantasyPlayers'));
      setMessage({ type: 'success', text: 'Player added!' });
      setNewPlayer({ name: '', photo: '', role: 'BAT', team: '', credits: 9, selBy: '0%' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add player.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!window.confirm('Are you sure you want to delete this game?')) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'ludoGames', gameId), { status: 'deleted' }); // Soft delete or just remove
      // Or actual delete: await deleteDoc(doc(db, 'ludoGames', gameId));
      setMessage({ type: 'success', text: 'Game deleted successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete game' });
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
      {permissionError ? (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-zinc-900 tracking-tight">Access Denied</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-[240px]">
              {permissionError}
            </p>
          </div>
          <button 
            onClick={onBack}
            className="px-8 py-3 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all font-display"
          >
            Go Back
          </button>
        </div>
      ) : (
        <>
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
          <TabButton active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={<Ticket className="w-4 h-4" />} label="Tkt" />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users className="w-4 h-4" />} label="Usr" />
          <TabButton active={activeTab === 'fantasy'} onClick={() => setActiveTab('fantasy')} icon={<Zap className="w-4 h-4" />} label="Fnt" />
          <TabButton active={activeTab === 'ludo'} onClick={() => setActiveTab('ludo')} icon={<Gamepad2 className="w-4 h-4" />} label="Ludo" />
          <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')} icon={<Trophy className="w-4 h-4" />} label="Res" />
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
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2">
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
                        {tx.merchantName && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 rounded-lg border border-zinc-100">
                            <Landmark className="w-2.5 h-2.5 text-zinc-400" />
                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Brand: <span className="text-zinc-900">{tx.merchantName}</span></span>
                          </div>
                        )}
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
                        {(() => {
                          const user = users.find(u => u.id === tx.uid);
                          return (
                            <div className="text-right">
                              <p className="text-xs font-black text-zinc-900">{user?.fullName || 'Unknown User'}</p>
                              <p className="text-[9px] font-bold text-zinc-500">{user?.phoneNumber || tx.uid.slice(0, 8)}</p>
                            </div>
                          );
                        })()}
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
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{new Date(tx.createdAt).toLocaleDateString()}</p>
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

                  <div className="space-y-6">
                    <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-blue-500" />
                      Manual UPI Payment Settings
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">UPI ID</label>
                        <input 
                          type="text"
                          value={upiSettings.upiId}
                          onChange={(e) => setUpiSettings({...upiSettings, upiId: e.target.value})}
                          placeholder="e.g. name@upi or razorpay.me/@username"
                          className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 px-6 focus:border-blue-500 focus:ring-0 transition-all font-black text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Link (HTTPS)</label>
                        <input 
                          type="text"
                          value={upiSettings.paymentLink}
                          onChange={(e) => setUpiSettings({...upiSettings, paymentLink: e.target.value})}
                          placeholder="e.g. https://razorpay.me/@username"
                          className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 px-6 focus:border-blue-500 focus:ring-0 transition-all font-black text-lg"
                        />
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest ml-1">Direct link for users to pay. Used to generate QR code.</p>
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

          {activeTab === 'fantasy' && (
            <motion.div key="fantasy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6">
                <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Manage Cricket Fantasy
                </h3>

                {/* Add Match Form */}
                <form onSubmit={handleAddMatch} className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Add New Match</p>
                  </div>
                  <input type="text" placeholder="League (e.g. IPL 2026)" value={newMatch.league} onChange={e => setNewMatch({...newMatch, league: e.target.value})} className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Team 1 Name" value={newMatch.team1Name} onChange={e => setNewMatch({...newMatch, team1Name: e.target.value})} className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                    <input type="text" placeholder="Team 1 Short" value={newMatch.team1Short} onChange={e => setNewMatch({...newMatch, team1Short: e.target.value})} className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                  </div>
                  <input type="text" placeholder="Team 1 Logo URL" value={newMatch.team1Logo} onChange={e => setNewMatch({...newMatch, team1Logo: e.target.value})} className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Team 2 Name" value={newMatch.team2Name} onChange={e => setNewMatch({...newMatch, team2Name: e.target.value})} className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                    <input type="text" placeholder="Team 2 Short" value={newMatch.team2Short} onChange={e => setNewMatch({...newMatch, team2Short: e.target.value})} className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                  </div>
                  <input type="text" placeholder="Team 2 Logo URL" value={newMatch.team2Logo} onChange={e => setNewMatch({...newMatch, team2Logo: e.target.value})} className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Start Time (Tomorrow, 7:30 PM)" value={newMatch.startTime} onChange={e => setNewMatch({...newMatch, startTime: e.target.value})} className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                    <input type="text" placeholder="Prize Pool (₹9.22 Crores)" value={newMatch.prizePool} onChange={e => setNewMatch({...newMatch, prizePool: e.target.value})} className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" required />
                  </div>
                  <input type="text" placeholder="Match Thumbnail URL (Match Banner)" value={newMatch.thumbnail} onChange={e => setNewMatch({...newMatch, thumbnail: e.target.value})} className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-xs font-bold" />
                  
                  <button type="submit" disabled={loading} className="w-full bg-zinc-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all font-display">
                    {loading ? 'Adding Match...' : 'Add match'}
                  </button>
                </form>

                {/* Match List & Player Addition */}
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Available Matches ({fantasyMatches.length})</p>
                   </div>
                   {fantasyMatches.map(match => (
                     <div key={match.id} className={`p-4 rounded-2xl border transition-all ${selectedMatchId === match.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-zinc-100 bg-white'}`}>
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-3">
                             <img src={match.team1.logo} alt="" className="w-8 h-8 rounded-full border border-zinc-100" />
                             <div className="flex flex-col">
                               <span className="text-xs font-black text-zinc-900">{match.team1.short} vs {match.team2.short}</span>
                               <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{match.league}</span>
                             </div>
                             <img src={match.team2.logo} alt="" className="w-8 h-8 rounded-full border border-zinc-100" />
                           </div>
                           <button 
                             onClick={() => setSelectedMatchId(selectedMatchId === match.id ? null : match.id)}
                             className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${selectedMatchId === match.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-100 text-zinc-400'}`}
                           >
                             {selectedMatchId === match.id ? 'Managing' : 'Add Players'}
                           </button>
                        </div>

                        {selectedMatchId === match.id && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 pt-4 border-t border-zinc-100 space-y-6"
                          >
                            <form onSubmit={handleAddPlayer} className="space-y-3 bg-white p-4 rounded-xl border border-zinc-100 shadow-sm">
                              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Add Player to Match</p>
                              <input type="text" placeholder="Full Player Name" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-[10px] font-bold" required />
                              <input type="text" placeholder="Player Photo URL" value={newPlayer.photo} onChange={e => setNewPlayer({...newPlayer, photo: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-[10px] font-bold" required />
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Role</label>
                                  <select value={newPlayer.role} onChange={e => setNewPlayer({...newPlayer, role: e.target.value as any})} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-[10px] font-bold" required>
                                     <option value="WK">WK (Wicket Keeper)</option>
                                     <option value="BAT">BAT (Batsman)</option>
                                     <option value="AR">AR (All Rounder)</option>
                                     <option value="BOWL">BOWL (Bowler)</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Team</label>
                                  <select value={newPlayer.team} onChange={e => setNewPlayer({...newPlayer, team: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-[10px] font-bold" required>
                                     <option value="">Select Team</option>
                                     <option value={match.team1.short}>{match.team1.name}</option>
                                     <option value={match.team2.short}>{match.team2.name}</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Credits</label>
                                  <input type="number" step="0.5" placeholder="Credits" value={newPlayer.credits} onChange={e => setNewPlayer({...newPlayer, credits: parseFloat(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-[10px] font-bold" required />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Selected By %</label>
                                  <input type="text" placeholder="75%" value={newPlayer.selBy} onChange={e => setNewPlayer({...newPlayer, selBy: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-[10px] font-bold" required />
                                </div>
                              </div>

                              <button type="submit" disabled={loading} className="w-full bg-emerald-500 text-white py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all">
                                {loading ? 'Saving...' : 'Save Player'}
                              </button>
                            </form>
                            
                            <div className="space-y-3">
                               <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Added Players ({fantasyPlayers.filter(p => p.matchId === match.id).length})</p>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {fantasyPlayers.filter(p => p.matchId === match.id).map(player => (
                                   <div key={player.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                                      <img src={player.photo} alt="" className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200" />
                                      <div className="flex-1">
                                         <p className="text-[10px] font-black text-zinc-900">{player.name}</p>
                                         <div className="flex items-center gap-2 mt-0.5">
                                           <span className="text-[7px] font-black px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded uppercase">{player.role}</span>
                                           <span className="text-[7px] font-bold text-zinc-400 uppercase">{player.team}</span>
                                           <span className="text-[7px] font-black text-emerald-600 ml-auto">{player.credits} Cr</span>
                                         </div>
                                      </div>
                                   </div>
                                 ))}
                               </div>
                               {fantasyPlayers.filter(p => p.matchId === match.id).length === 0 && (
                                 <div className="text-center py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                                   <Users className="w-6 h-6 text-zinc-200 mx-auto mb-2" />
                                   <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">No players added for this match</p>
                                 </div>
                               )}
                            </div>
                          </motion.div>
                        )}
                     </div>
                   ))}
                   {fantasyMatches.length === 0 && (
                     <EmptyState icon={<Trophy className="w-12 h-12" />} text="No cricket matches added yet" />
                   )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ludo' && (
            <motion.div key="ludo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-zinc-900 tracking-tight flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-red-500" />
                  Active Ludo Games ({ludoGames.filter(g => g.status !== 'deleted').length})
                </h3>
              </div>

              <div className="grid gap-4">
                {ludoGames
                  .filter(game => game.status !== 'deleted')
                  .map(game => (
                    <div key={game.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Game ID:</span>
                            <span className="text-[10px] font-mono font-bold text-zinc-900">{game.id}</span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(game.id);
                                setMessage({ type: 'success', text: 'Game ID copied!' });
                              }}
                              className="p-1 hover:bg-zinc-100 rounded transition-colors"
                            >
                              <Copy className="w-3 h-3 text-zinc-400" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                              game.status === 'playing' ? 'bg-emerald-100 text-emerald-600' : 
                              game.status === 'waiting' ? 'bg-blue-100 text-blue-600' : 
                              'bg-zinc-100 text-zinc-500'
                            }`}>
                              {game.status}
                            </span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                              {new Date(game.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-emerald-600">₹{game.prizePool || 0}</p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Prize Pool</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-3 h-3 text-zinc-400" />
                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Players</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {game.players?.map((p: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  p.color === 'red' ? 'bg-red-500' : 
                                  p.color === 'blue' ? 'bg-blue-500' : 
                                  p.color === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                                }`} />
                                <span className="text-[10px] font-bold text-zinc-900 truncate">{p.name || p.uid.slice(0, 8)}</span>
                              </div>
                            )) || <p className="text-[10px] text-zinc-400 italic">No players</p>}
                          </div>
                        </div>
                        <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-3 h-3 text-yellow-500" />
                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Current State</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-zinc-500">Turn:</span>
                              <span className={`text-[9px] font-black uppercase ${
                                game.currentPlayer === 'red' ? 'text-red-500' : 
                                game.currentPlayer === 'blue' ? 'text-blue-500' : 
                                game.currentPlayer === 'yellow' ? 'text-yellow-500' : 'text-green-500'
                              }`}>{game.currentPlayer || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-zinc-500">Dice:</span>
                              <span className="text-[9px] font-black text-zinc-900">{game.diceValue || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <button 
                          onClick={() => onSpectateLudo?.(game.id)}
                          className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                        >
                          <Eye className="w-3.5 h-3.5" /> Spectate
                        </button>
                        <button 
                          onClick={() => onJoinLudo?.(game.id)}
                          className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-200"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Join
                        </button>
                        <button 
                          onClick={() => handleDeleteGame(game.id)}
                          className="flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                {ludoGames.filter(g => g.status !== 'deleted').length === 0 && (
                  <EmptyState icon={<Gamepad2 className="w-12 h-12" />} text="No active Ludo games" />
                )}
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
                            <p className="font-black text-emerald-600">₹{user.balance.toFixed(2)}</p>
                            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Balance</p>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => {
                                setCreditUser(user);
                                setShowCreditModal(true);
                              }}
                              className="px-3 py-1.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                              Credit
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedUserForTickets(user);
                              }}
                              className="px-3 py-1.5 bg-zinc-900 text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-500 transition-colors"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Credit Balance Modal */}
      <AnimatePresence>
        {showCreditModal && creditUser && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreditModal(false)}
              className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xs bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
               <div className="flex flex-col items-center gap-4 mb-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900">Add Balance</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">To: {creditUser.fullName}</p>
                </div>
              </div>

              <form onSubmit={handleManualCredit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Amount (₹)</label>
                  <input 
                    type="number"
                    autoFocus
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-xl py-3 px-4 text-zinc-900 focus:border-emerald-500 focus:ring-0 transition-all font-black text-xl text-center"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowCreditModal(false)}
                    className="flex-1 bg-zinc-100 text-zinc-400 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    {loading ? '...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
        </>
      )}
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

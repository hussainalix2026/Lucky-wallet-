import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDocFromServer } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Wallet from './components/Wallet';
import BuyNumber from './components/BuyNumber';
import MyPurchases from './components/MyPurchases';
import Results from './components/Results';
import AdminPanel from './components/AdminPanel';
import PaymentVerification from './components/PaymentVerification';
import LudoGame from './components/LudoGame';
import { Wallet as WalletIcon, Ticket, Trophy, History, ShieldCheck, LogOut, Timer, Zap, Sparkles, Camera, Gamepad2, Trophy as TrophyIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function LiveTicker() {
  const [winners] = useState([
    { name: 'Rahul S.', amount: 12000, time: '2m ago' },
    { name: 'Anjali K.', amount: 5000, time: '5m ago' },
    { name: 'Sameer P.', amount: 1200, time: '8m ago' },
    { name: 'Priya M.', amount: 12000, time: '12m ago' },
  ]);

  return (
    <div className="bg-zinc-900 overflow-hidden py-2 border-y border-zinc-800">
      <motion.div 
        animate={{ x: [0, -1000] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="flex whitespace-nowrap gap-8"
      >
        {[...winners, ...winners].map((winner, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-emerald-400 flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" />
              {winner.name}
            </span>
            <span className="text-zinc-500">WON</span>
            <span className="text-white font-black">₹{winner.amount}</span>
            <span className="text-zinc-600">• {winner.time}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function NextDrawTimer() {
  const [timeLeft, setTimeLeft] = useState('14:22:05');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hours = 23 - now.getHours();
      const minutes = 59 - now.getMinutes();
      const seconds = 59 - now.getSeconds();
      setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
      <Timer className="w-4 h-4 text-emerald-500 animate-pulse" />
      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Next Draw: {timeLeft}</span>
    </div>
  );
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export type View = 'dashboard' | 'wallet' | 'buy' | 'purchases' | 'results' | 'admin' | 'verification' | 'ludo';

export interface UserData {
  uid: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  balance: number;
  isAdmin?: boolean;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  hasReceivedReferralBonus?: boolean;
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    upiId: string;
  };
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [prefillData, setPrefillData] = useState<{ number: number, investment: number } | null>(null);
  const [selectedLudoGame, setSelectedLudoGame] = useState<{ id: string, mode: 'player' | 'spectator' } | null>(null);

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    if (newClicks >= 5) {
      setShowAdminAuth(true);
      setLogoClicks(0);
    } else {
      setLogoClicks(newClicks);
      // Reset clicks after 2 seconds of inactivity
      setTimeout(() => setLogoClicks(0), 2000);
    }
  };

  const verifyAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'ug121a220081') {
      setCurrentView('admin');
      setShowAdminAuth(false);
      setAdminPassword('');
      setAdminError('');
    } else {
      setAdminError('Invalid Admin Password');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserData(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserData({ uid: user.uid, ...docSnap.data() } as UserData);
      } else {
        // New user initialization is handled in Auth component
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Test connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-pulse flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-3xl shadow-2xl shadow-emerald-500/20 flex items-center justify-center animate-float">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight font-display">GrandLuck Pro</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Initializing Secure Session</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Auth />
      </ErrorBoundary>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard userData={userData} onNavigate={setCurrentView} />;
      case 'wallet': return <Wallet userData={userData} onBack={() => setCurrentView('dashboard')} />;
      case 'buy': return (
        <BuyNumber 
          userData={userData} 
          onBack={() => { setCurrentView('dashboard'); setPrefillData(null); }} 
          prefillData={prefillData}
        />
      );
      case 'purchases': return (
        <MyPurchases 
          userData={userData} 
          onBack={() => setCurrentView('dashboard')} 
          onPlayAgain={(data) => {
            setPrefillData(data);
            setCurrentView('buy');
          }}
        />
      );
      case 'results': return <Results onBack={() => setCurrentView('dashboard')} />;
      case 'admin': return (
        <AdminPanel 
          onBack={() => setCurrentView('dashboard')} 
          onSpectateLudo={(gameId) => {
            setSelectedLudoGame({ id: gameId, mode: 'spectator' });
            setCurrentView('ludo');
          }}
          onJoinLudo={(gameId) => {
            setSelectedLudoGame({ id: gameId, mode: 'player' });
            setCurrentView('ludo');
          }}
        />
      );
      case 'verification': return <PaymentVerification userData={userData} onBack={() => setCurrentView('dashboard')} />;
      case 'ludo': return (
        <LudoGame 
          userData={userData} 
          onBack={() => {
            setCurrentView('dashboard');
            setSelectedLudoGame(null);
          }} 
          adminGameConfig={selectedLudoGame}
        />
      );
      default: return <Dashboard userData={userData} onNavigate={setCurrentView} />;
    }
  };

  return (
    <ErrorBoundary>
      <Elements stripe={stripePromise}>
        <div className="min-h-screen bg-zinc-950 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-zinc-800 font-sans">
          {/* Header */}
          <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
            <div 
              className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform"
              onClick={handleLogoClick}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-float">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg tracking-tight text-white leading-none">GrandLuck</span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Premium Pro</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NextDrawTimer />
              <button 
                onClick={() => auth.signOut()}
                className="p-2 text-zinc-500 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          <AnimatePresence>
            {showAdminAuth && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-6"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] w-full max-w-xs shadow-2xl"
                >
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                      <ShieldCheck className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-black text-white">Admin Access</h3>
                  </div>
                  <form onSubmit={verifyAdmin} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Master Password</label>
                      <input 
                        type="password"
                        autoFocus
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full bg-zinc-800 border-zinc-700 border-2 rounded-xl py-3 px-4 text-white focus:border-emerald-500 focus:ring-0 transition-all font-mono"
                        placeholder="••••••••"
                      />
                    </div>
                    {adminError && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-wider">{adminError}</p>}
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => { setShowAdminAuth(false); setAdminPassword(''); setAdminError(''); }}
                        className="flex-1 bg-zinc-800 text-zinc-400 py-3 rounded-xl font-bold text-sm hover:bg-zinc-700 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                      >
                        Verify
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <LiveTicker />
  
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto pb-24 bg-zinc-950">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </main>
  
          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800 px-6 py-3 flex justify-between items-center z-50">
            <NavButton 
              active={currentView === 'dashboard'} 
              onClick={() => setCurrentView('dashboard')} 
              icon={<WalletIcon className="w-6 h-6" />} 
              label="Home" 
            />
            <NavButton 
              active={currentView === 'buy'} 
              onClick={() => setCurrentView('buy')} 
              icon={<Ticket className="w-6 h-6" />} 
              label="Play" 
            />
            <NavButton 
              active={currentView === 'results'} 
              onClick={() => setCurrentView('results')} 
              icon={<Trophy className="w-6 h-6" />} 
              label="Winners" 
            />
            <NavButton 
              active={currentView === 'purchases'} 
              onClick={() => setCurrentView('purchases')} 
              icon={<History className="w-6 h-6" />} 
              label="History" 
            />
          </nav>
        </div>
      </Elements>
    </ErrorBoundary>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-emerald-500 scale-110' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-emerald-500/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

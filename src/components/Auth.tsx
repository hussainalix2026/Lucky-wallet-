import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, query, collection, where, getDocs, updateDoc, increment, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, User, Lock, ArrowRight, Wallet, LogIn, Mail, Gift } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatEmail = (phone: string) => `${phone}@luckywallet.com`;

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!userSnap?.exists()) {
        try {
          // Get referral bonus settings
          let settingsSnap;
          try {
            settingsSnap = await getDoc(doc(db, 'settings', 'global'));
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'settings/global');
          }
          const referralSettings = (settingsSnap && settingsSnap.exists()) ? settingsSnap.data().referralBonus : { referrer: 50, referee: 20 };
          const initialBalance = 10; // Default registration bonus for Google users (no referral code support in popup yet)

          const userData = {
            fullName: user.displayName || 'Google User',
            phoneNumber: user.phoneNumber || '',
            email: user.email,
            balance: initialBalance,
            isAdmin: user.email === "hussainalix2026@gmail.com",
            referralCode: generateReferralCode(),
            referredBy: null,
            referralCount: 0,
            hasReceivedReferralBonus: false,
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, userData);

          // Add registration bonus transaction
          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            amount: initialBalance,
            type: 'Referral Bonus',
            status: 'Success',
            createdAt: new Date().toISOString(),
            paymentMethod: 'Wallet',
            reason: 'Registration Bonus'
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError('Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !password || (mode === 'register' && !fullName)) {
      setError('Please fill all fields');
      return;
    }

    if (phoneNumber.length < 10) {
      setError('Invalid phone number');
      return;
    }

    setLoading(true);
    setError(null);

    const email = formatEmail(phoneNumber);

    try {
      if (mode === 'register') {
        let referredByUid = '';
        if (referralCodeInput) {
          const q = query(collection(db, 'users'), where('referralCode', '==', referralCodeInput.toUpperCase()));
          const snap = await getDocs(q);
          if (snap.empty) {
            setError('Invalid referral code');
            setLoading(false);
            return;
          }
          referredByUid = snap.docs[0].id;
        }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        await updateProfile(user, { displayName: fullName });

        try {
          // Get referral bonus settings
          let settingsSnap;
          try {
            settingsSnap = await getDoc(doc(db, 'settings', 'global'));
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'settings/global');
          }
          const referralSettings = (settingsSnap && settingsSnap.exists()) ? settingsSnap.data().referralBonus : { referrer: 50, referee: 20 };
          
          // If referred, use referee bonus, otherwise use default 10
          const initialBalance = referredByUid ? (referralSettings?.referee || 20) : 10;

          const userData = {
            fullName,
            phoneNumber,
            email,
            balance: initialBalance,
            isAdmin: false,
            referralCode: generateReferralCode(),
            referredBy: referredByUid || null,
            referralCount: 0,
            hasReceivedReferralBonus: referredByUid ? true : false, // Mark as received if they got it on registration
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), userData);

          // Add registration bonus transaction
          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            amount: initialBalance,
            type: 'Referral Bonus',
            status: 'Success',
            createdAt: new Date().toISOString(),
            paymentMethod: 'Wallet',
            reason: referredByUid ? 'Referral Welcome Bonus' : 'Registration Bonus'
          });

          if (referredByUid) {
            // Increment referral count for the referrer
            await updateDoc(doc(db, 'users', referredByUid), {
              referralCount: increment(1),
              balance: increment(referralSettings?.referrer || 50)
            });

            // Add transaction for referrer
            await addDoc(collection(db, 'transactions'), {
              uid: referredByUid,
              amount: referralSettings?.referrer || 50,
              type: 'Referral Bonus',
              status: 'Success',
              createdAt: new Date().toISOString(),
              description: `Bonus for referring ${fullName}`
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = 'Authentication failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') msg = 'Phone number already registered.';
      if (err.code === 'auth/invalid-credential') {
        msg = "Invalid phone number or password. If you haven't registered yet, please switch to the Register tab.";
      }
      if (err.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      if (err.code === 'auth/user-not-found') msg = 'User not found.';
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-emerald-500 rounded-3xl shadow-lg shadow-emerald-200 flex items-center justify-center mb-4">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Lucky Wallet</h1>
          <p className="text-zinc-500 font-medium mt-1">
            {mode === 'register' ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white border-2 border-zinc-100 text-zinc-700 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
              <span className="bg-white px-4 text-zinc-400">Or use phone</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input 
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 pl-12 pr-4 focus:border-emerald-500 focus:ring-0 transition-all font-medium"
                      required={mode === 'register'}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 pl-12 pr-4 focus:border-emerald-500 focus:ring-0 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 pl-12 pr-4 focus:border-emerald-500 focus:ring-0 transition-all font-medium"
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">Referral Code (Optional)</label>
                <div className="relative">
                  <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input 
                    type="text"
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value)}
                    placeholder="Enter referral code"
                    className="w-full bg-zinc-50 border-zinc-100 border-2 rounded-2xl py-4 pl-12 pr-4 focus:border-emerald-500 focus:ring-0 transition-all font-medium uppercase"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : mode === 'register' ? 'Register' : 'Login'}
              {mode === 'register' ? <ArrowRight className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </button>

            <button 
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="w-full text-zinc-400 font-bold text-sm hover:text-zinc-600 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

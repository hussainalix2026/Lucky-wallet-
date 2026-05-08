import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, query, where, getDocs } from 'firebase/firestore';
import { UserData } from '../App';
import { ChevronLeft, QrCode, Copy, ShieldCheck, Zap, Sparkles, AlertCircle, Info, CheckCircle2, History, ArrowRight, Camera, Send, Loader2, Landmark, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface ReceivePaymentProps {
  userData: UserData | null;
  onBack: () => void;
  onViewHistory: () => void;
}

export default function ReceivePayment({ userData, onBack, onViewHistory }: ReceivePaymentProps) {
  const [activeTab, setActiveTab] = useState<'upi' | 'bank' | 'wallet'>('upi');
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [activeMerchantName, setActiveMerchantName] = useState('GrandLuck Pro Services');
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('100');
  const [utr, setUtr] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const merchantNames = [
    'Digital Services', 'GrandLuck Pro', 'Global Payments', 'Reliable Pay',
    'Instant Settlement', 'Skyline Ventures', 'V-Care Payments', 'Zenith Solutions'
  ];

  useEffect(() => {
    const randomName = merchantNames[Math.floor(Math.random() * merchantNames.length)];
    setActiveMerchantName(randomName);
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !utr) {
      setMessage({ type: 'error', text: 'Please enter 12-digit UTR/Transaction ID.' });
      return;
    }

    if (utr.length < 10) {
      setMessage({ type: 'error', text: 'Reference ID must be at least 10 characters.' });
      return;
    }

    setLoading(true);
    try {
      // Check if this UTR is already used by this user or any user in paymentVerifications
      const q = query(collection(db, 'paymentVerifications'), where('utr', '==', utr));
      const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'check-utr'));
      
      if (snap && !snap.empty) {
        setMessage({ type: 'error', text: 'This Transaction ID is already under review or processed.' });
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'paymentVerifications'), {
        uid: userData.uid,
        utr,
        amount: Number(amount),
        method: activeTab,
        screenshot: null, 
        status: 'Pending',
        createdAt: new Date().toISOString(),
        userEmail: userData.email || 'N/A',
        userPhone: userData.phoneNumber || 'N/A',
        merchantName: activeMerchantName
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'paymentVerifications'));

      setMessage({ type: 'success', text: 'Request submitted! Balance will be updated after verification.' });
      setUtr('');
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit verification.' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const upiId = globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/s8ouvl69';
  const isVpa = upiId.includes('@');
  const isUrl = upiId.includes('http') || upiId.includes('rzp.io');

  const bankDetails = globalSettings?.depositSettings?.bankDetails || {
    bankName: 'HDFC Bank',
    accountHolder: activeMerchantName,
    accountNumber: '50100456789123',
    ifscCode: 'HDFC0001234'
  };
  const walletIds = globalSettings?.depositSettings?.walletIds || {
    mobikwik: '9876543210',
    freecharge: '9876543210'
  };

  const manualPaymentLink = globalSettings?.depositSettings?.manualPaymentLink;

  const paymentLink = manualPaymentLink || (isVpa 
    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(activeMerchantName)}&am=${amount}&cu=INR`
    : (upiId.startsWith('http') ? upiId : `https://${upiId}`));

  const handlePayNow = (appPackage?: string) => {
    if (isUrl) {
      window.open(paymentLink, '_blank');
    } else {
      // Create a temporary link element for better deep linking
      const link = document.createElement('a');
      link.href = paymentLink;
      link.target = '_blank'; // Some browsers handle upi:// better with _blank
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Fallback
      setTimeout(() => {
        window.location.href = paymentLink;
      }, 50);
    }
  };

  const upiApps = [
    { name: 'PhonePe', icon: 'https://img.icons8.com/color/48/phone-pe.png', package: 'com.phonepe.app' },
    { name: 'GPay', icon: 'https://img.icons8.com/color/48/google-pay.png', package: 'com.google.android.apps.nbu.paisa' },
    { name: 'Paytm', icon: 'https://img.icons8.com/color/48/paytm.png', package: 'net.one97.paytm' }
  ];

  if (!userData) return null;

  return (
    <div className="p-6 space-y-8 pb-32 bg-zinc-950 min-h-full">
      {/* Header Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
        <button 
          onClick={() => setActiveTab('upi')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'upi' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          <QrCode className="w-4 h-4" />
          UPI
        </button>
        <button 
          onClick={() => setActiveTab('bank')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'bank' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          <Landmark className="w-4 h-4" />
          Bank
        </button>
        <button 
          onClick={() => setActiveTab('wallet')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'wallet' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          <CreditCard className="w-4 h-4" />
          Wallet
        </button>
      </div>

      <div className="space-y-8">
        <motion.div 
          key={activeTab}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800 space-y-8 shadow-2xl relative overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full"></div>

          {/* 1. Entry & Amount (Top) */}
          <div className="space-y-4 relative">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <Zap className="w-4 h-4 text-emerald-500" />
                 <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Deposit Value</span>
              </div>
              <button 
                onClick={onBack}
                className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
            </div>
            
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-500">₹</span>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl py-6 pl-12 pr-6 focus:border-emerald-500 transition-all font-black text-4xl text-white font-display text-center focus:outline-none"
                placeholder="100"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {['100', '500', '1000', '2000'].map(val => (
                <button 
                   key={val}
                   onClick={() => setAmount(val)}
                   className={`py-2.5 rounded-xl text-[9px] font-black border transition-all ${amount === val ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                >
                  ₹{val}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Reference Input (MOVE ABOVE QR as requested) */}
          <div className="space-y-4 relative">
            <div className="flex justify-between items-end px-1">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Transaction Ref / UTR</span>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest leading-none">Paste your ID here</p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                 <ShieldCheck className="w-3 h-3 text-emerald-500" />
                 <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Manual Verify</span>
              </div>
            </div>

            <div className="relative">
              <input 
                type="text" 
                value={utr}
                onChange={(e) => setUtr(e.target.value.toUpperCase())}
                placeholder="UTR / REFERENCE ID"
                className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-5 text-white font-black text-xl focus:outline-none focus:border-emerald-500 transition-all tracking-[0.15em] text-center placeholder:text-zinc-800 placeholder:tracking-normal"
                required
              />
            </div>
          </div>

          {/* 3. Transaction Details (Based on Tab) */}
          <div className="space-y-6 relative">
            {activeTab === 'upi' && (
              <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl transition-all">
                <div className="bg-zinc-100 px-6 py-3 flex justify-between items-center border-b border-zinc-200">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Scan QR to Pay</span>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" className="h-2.5 opacity-60" alt="UPI" />
                </div>
                <div className="p-10 flex flex-col items-center gap-8">
                  <div className="relative p-3 bg-zinc-50 rounded-[3rem] border-2 border-zinc-100 ring-[12px] ring-zinc-50 shadow-inner">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(paymentLink)}&color=000&bgcolor=f9f9f9&margin=10`}
                      alt="Payment QR"
                      className="w-64 h-64 sm:w-72 sm:h-72 rounded-[2.5rem] shadow-sm block mix-blend-multiply"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                      <QrCode className="w-32 h-32" />
                    </div>
                  </div>
                    <div className="w-full space-y-4">
                      {/* App Shortcuts */}
                      {!isUrl && (
                        <div className="grid grid-cols-3 gap-3">
                          {upiApps.map(app => (
                            <button 
                              key={app.name}
                              onClick={() => handlePayNow(app.package)}
                              className="flex flex-col items-center gap-2 p-3 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-emerald-500 transition-all active:scale-95"
                            >
                              <img src={app.icon} className="w-8 h-8" alt={app.name} />
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{app.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <button 
                        onClick={() => copyToClipboard(upiId)}
                        className="w-full flex items-center justify-between p-5 bg-zinc-50 rounded-2xl border border-zinc-100 group active:scale-95 transition-all"
                      >
                        <div className="text-left">
                          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block mb-0.5">
                            {isVpa ? 'UPI ID (Tap to Copy)' : 'Payment Link (Tap to Copy)'}
                          </span>
                          <span className="text-sm font-black text-zinc-900 break-all">{upiId}</span>
                        </div>
                        <div className={`p-2.5 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white text-zinc-400 border border-zinc-200'}`}>
                          {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </div>
                      </button>

                      <button 
                        onClick={() => handlePayNow()}
                        className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                      >
                        {isUrl ? 'Continue to Payment' : 'Pay via Specific App'}
                        {!isUrl && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="bg-zinc-800/50 rounded-3xl p-6 border border-zinc-700 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <Landmark className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Bank Details</p>
                    <p className="text-[8px] text-zinc-500 font-bold uppercase">Manual IMPS/NEFT Transfer</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {[
                    { label: 'Bank Name', value: bankDetails.bankName },
                    { label: 'Account Holder', value: bankDetails.accountHolder },
                    { label: 'Account Number', value: bankDetails.accountNumber },
                    { label: 'IFSC Code', value: bankDetails.ifscCode }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div>
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{item.label}</p>
                        <p className="text-xs font-bold text-white">{item.value}</p>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(item.value)}
                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-600 hover:text-emerald-500 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="bg-zinc-800/50 rounded-3xl p-6 border border-zinc-700 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <CreditCard className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">E-Wallets</p>
                    <p className="text-[8px] text-zinc-500 font-bold uppercase">Mobikwik / Freecharge</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div>
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Mobikwik Wallet ID</p>
                      <p className="text-xs font-bold text-white">{walletIds.mobikwik}</p>
                    </div>
                    <button onClick={() => copyToClipboard(walletIds.mobikwik)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-600 hover:text-emerald-500"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div>
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Freecharge Wallet ID</p>
                      <p className="text-xs font-bold text-white">{walletIds.freecharge}</p>
                    </div>
                    <button onClick={() => copyToClipboard(walletIds.freecharge)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-600 hover:text-emerald-500"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="space-y-4">
              <button 
                onClick={handleSubmit}
                disabled={loading || !utr}
                className={`w-full py-6 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-3 ${
                  loading || !utr 
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none' 
                    : 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <> <Send className="w-4 h-4" /> Claim Deposit </>}
              </button>

              <div className="flex items-center gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                 <Info className="w-4 h-4 text-emerald-500 shrink-0" />
                 <p className="text-[9px] font-bold text-zinc-500 leading-relaxed uppercase tracking-widest">
                   Funds are added after verification (15-30 mins). Fake submissions will lead to permanent ban.
                 </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>


      {/* Popups */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-24 left-6 right-6 p-5 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] border ${message.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-red-500 border-red-400 text-white'}`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <p className="text-xs font-black uppercase tracking-tight flex-1">{message.text}</p>
            <button onClick={() => setMessage(null)} className="p-1 hover:bg-white/20 rounded-md transition-colors">
              <ChevronLeft className="w-5 h-5 rotate-[270deg]" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

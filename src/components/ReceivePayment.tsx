import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, query, where, getDocs, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { UserData } from '../App';
import { ChevronLeft, QrCode, Copy, ShieldCheck, Zap, Sparkles, AlertCircle, Info, CheckCircle2, History, ArrowRight, Camera, Send, Loader2, Landmark, CreditCard, Trash2, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Html5Qrcode } from 'html5-qrcode';
import RazorpayQRCard from './RazorpayQRCard';

interface ReceivePaymentProps {
  userData: UserData | null;
  onBack: () => void;
  onViewHistory: () => void;
}

export default function ReceivePayment({ userData, onBack, onViewHistory }: ReceivePaymentProps) {
  const [activeTab, setActiveTab] = useState<'upi' | 'bank'>('upi');
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [activeMerchantName, setActiveMerchantName] = useState('GrandLuck Pro Services');
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('100');
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedManualUpi, setSelectedManualUpi] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [qrUploading, setQrUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedUpiData, setScannedUpiData] = useState<{ pa: string; pn?: string; am?: string } | null>(null);

  useEffect(() => {
    let html5QrCode: any = null;

    if (isScanning) {
      // Small delay to ensure the DOM is printed and ready
      const timer = setTimeout(() => {
        try {
          html5QrCode = new Html5Qrcode("qr-reader");
          
          const qrCodeSuccessCallback = (decodedText: string) => {
            setIsScanning(false);
            setMessage({ type: 'success', text: 'Merchant QR code scanned successfully!' });

            if (decodedText.startsWith('upi://')) {
              const params: Record<string, string> = {};
              const queryString = decodedText.split('?')[1];
              if (queryString) {
                queryString.split('&').forEach(part => {
                  const [key, val] = part.split('=');
                  if (key && val) {
                    params[key] = decodeURIComponent(val);
                  }
                });
              }
              
              if (params.pa) {
                setScannedUpiData({
                  pa: params.pa,
                  pn: params.pn || undefined,
                  am: params.am || undefined
                });

                setSelectedManualUpi(params.pa);
                if (params.pn) {
                  setActiveMerchantName(params.pn);
                }
                if (params.am) {
                  setAmount(params.am);
                }
              }
            } else {
              setScannedUpiData({ pa: decodedText });
              if (decodedText.includes('@')) {
                setSelectedManualUpi(decodedText);
              }
            }
          };

          const config = { 
            fps: 10, 
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0
          };

          html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            qrCodeSuccessCallback,
            () => {} // silent on scan path errors
          ).catch((err: any) => {
            console.error("Camera access failed", err);
            setMessage({ type: 'error', text: 'Could not access camera. Please allow permission.' });
            setIsScanning(false);
          });
        } catch (e) {
          console.error(e);
          setIsScanning(false);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          try {
            html5QrCode.stop().then(() => {
              html5QrCode.clear();
            }).catch((err: any) => {
              // already stopped / not scanning
            });
          } catch (e) {
            // ignore empty / null errors
          }
        }
      };
    }
  }, [isScanning]);

  const handleUserQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!userData) {
      setMessage({ type: 'error', text: 'You must be logged in to upload.' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select a valid image file.' });
      return;
    }

    if (file.size > 800 * 1024) {
      setMessage({ type: 'error', text: 'Image too large (Max 800KB)' });
      return;
    }

    setQrUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await updateDoc(doc(db, 'users', userData.uid), {
          paymentQrCode: base64
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${userData.uid}`));
        
        setMessage({ type: 'success', text: 'Your receiving QR Code shared successfully!' });
        setQrUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to upload QR Code.' });
      setQrUploading(false);
    }
  };

  const handleRemoveUserQr = async () => {
    if (!userData) return;
    setQrUploading(true);
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        paymentQrCode: null
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${userData.uid}`));
      setMessage({ type: 'success', text: 'Your receiving QR Code removed successfully.' });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to remove QR Code.' });
    } finally {
      setQrUploading(false);
    }
  };

  const merchantNames = [
    'Digital Services', 'GrandLuck Pro', 'Global Payments', 'Reliable Pay',
    'Instant Settlement', 'Skyline Ventures', 'V-Care Payments', 'Zenith Solutions'
  ];

  useEffect(() => {
    // Persistent merchant name for this session
    const savedName = sessionStorage.getItem('merchant_name');
    if (savedName) {
      setActiveMerchantName(savedName);
    } else {
      const randomName = merchantNames[Math.floor(Math.random() * merchantNames.length)];
      setActiveMerchantName(randomName);
      sessionStorage.setItem('merchant_name', randomName);
    }

    // Subscribe to global settings
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
    return unsub;
  }, []);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setMessage({ type: 'error', text: 'Image too large (Max 800KB)' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSimulateSuccess = async (simulatedUtr: string, mockBase64Screenshot: string, autoApprove: boolean) => {
    setUtr(simulatedUtr);
    setScreenshot(mockBase64Screenshot);
    
    if (autoApprove && userData) {
      setLoading(true);
      try {
        const batch = writeBatch(db);
        
        // 1. Create the verification document instantly as Approved
        const verRef = doc(collection(db, 'paymentVerifications'));
        batch.set(verRef, {
          uid: userData.uid,
          utr: simulatedUtr,
          amount: Number(amount),
          method: activeTab,
          screenshot: mockBase64Screenshot, 
          status: 'Approved', 
          createdAt: new Date().toISOString(),
          userEmail: userData.email || 'N/A',
          userPhone: userData.phoneNumber || 'N/A',
          merchantName: activeMerchantName
        });

        // 2. ALSO update the user's balance in Firestore instantly!
        const userRef = doc(db, 'users', userData.uid);
        batch.update(userRef, {
          balance: increment(Number(amount))
        });

        // 3. AND add a matching transaction record with Success status
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          uid: userData.uid,
          amount: Number(amount),
          type: 'Deposit',
          status: 'Success',
          utr: simulatedUtr,
          screenshot: mockBase64Screenshot,
          paymentMethod: activeTab === 'upi' ? 'Manual UPI' : 'Bank Transfer',
          createdAt: new Date().toISOString()
        });

        await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'simulate-instant-verification'));
        
        setMessage({ type: 'success', text: `UPI Sandbox Success! ₹${amount} instantly credited to your wallet.` });
        setUtr('');
        setScreenshot(null);
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to process instant sandbox credit.' });
      } finally {
        setLoading(false);
      }
    } else {
      setMessage({ type: 'success', text: 'Payment simulated! Tap Claim Deposit below to complete.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
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
        screenshot, 
        status: 'Pending',
        createdAt: new Date().toISOString(),
        userEmail: userData.email || 'N/A',
        userPhone: userData.phoneNumber || 'N/A',
        merchantName: activeMerchantName
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'paymentVerifications'));

      setSubmitted(true);
      setUtr('');
      setScreenshot(null);
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit verification.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userData) return;
    const q = query(
      collection(db, 'paymentVerifications'), 
      where('uid', '==', userData.uid)
    );
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentRequests(docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
    });
  }, [userData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const upiId = globalSettings?.upiSettings?.upiId || 'rzp.io/rzp/XFu2lI2v';
  const manualUpiList = globalSettings?.depositSettings?.manualUpiList || [];
  const upiIdToUse = (activeTab === 'upi' && selectedManualUpi) ? selectedManualUpi : upiId;

  const isVpa = upiIdToUse.includes('@');
  const isUrl = upiIdToUse.includes('http') || upiIdToUse.includes('rzp.io');

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
    ? `upi://pay?pa=${upiIdToUse}&pn=${encodeURIComponent(activeMerchantName)}&am=${amount}&cu=INR`
    : (upiIdToUse.startsWith('http') ? upiIdToUse : `https://${upiIdToUse}`));

  useEffect(() => {
    if (manualUpiList.length > 0 && !selectedManualUpi) {
      setSelectedManualUpi(manualUpiList[0]);
    }
  }, [manualUpiList]);

  const getAppDeepLink = (appName: string) => {
    const vpa = isVpa ? upiIdToUse : (globalSettings?.upiSettings?.upiId || '');
    const encodedVpa = encodeURIComponent(vpa);
    const encodedMerchant = encodeURIComponent(activeMerchantName);
    const orderAmount = amount || '100';
    
    switch (appName.toLowerCase()) {
      case 'phonepe':
        return `phonepe://pay?pa=${encodedVpa}&pn=${encodedMerchant}&am=${orderAmount}&cu=INR`;
      case 'paytm':
        return `paytmmp://pay?pa=${encodedVpa}&pn=${encodedMerchant}&am=${orderAmount}&cu=INR`;
      case 'gpay':
      case 'googlepay':
        return `googlepay://pay?pa=${encodedVpa}&pn=${encodedMerchant}&am=${orderAmount}&cu=INR`;
      default:
        return `upi://pay?pa=${encodedVpa}&pn=${encodedMerchant}&am=${orderAmount}&cu=INR`;
    }
  };

  const handlePayNow = (appPackage?: string, appName?: string) => {
    let url = paymentLink;
    if (appName) {
      url = getAppDeepLink(appName);
    } else if (!isUrl && isVpa) {
      url = `upi://pay?pa=${encodeURIComponent(upiIdToUse)}&pn=${encodeURIComponent(activeMerchantName)}&am=${amount || '100'}&cu=INR`;
    }

    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      // Create a temporary link element for better deep linking
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank'; // Some browsers handle upi:// better with _blank
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Fallback
      setTimeout(() => {
        window.location.href = url;
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
    <div className="p-6 space-y-8 pb-32 bg-zinc-950 min-h-screen">
      {/* Merchant Header */}
      <div className="flex flex-col items-center gap-2 pt-4">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-2">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight font-display">{activeMerchantName}</h2>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Verified Merchant</span>
        </div>
      </div>

      {/* Header Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
        <button 
          onClick={() => setActiveTab('upi')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'upi' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          <QrCode className="w-4 h-4" />
          UPI Method
        </button>
        <button 
          onClick={() => setActiveTab('bank')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'bank' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          <Landmark className="w-4 h-4" />
          Bank Transfer
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

            <div className="flex flex-col gap-2.5">
              <button 
                type="button"
                onClick={() => setIsScanning(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-md active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4 shrink-0" />
                Scan Merchant Code
              </button>

              {scannedUpiData && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex flex-col gap-2 text-left"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Scanned Merchant QR</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setScannedUpiData(null);
                        setSelectedManualUpi(manualUpiList[0] || '');
                        setActiveMerchantName(sessionStorage.getItem('merchant_name') || 'GrandLuck Pro Services');
                      }}
                      className="text-[8px] font-black text-red-500 uppercase tracking-widest hover:underline"
                    >
                      Clear Scan
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <p className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest">Payee Name</p>
                      <p className="text-[10px] font-extrabold text-white truncate">{scannedUpiData.pn || activeMerchantName}</p>
                    </div>
                    <div>
                      <p className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest">UPI ID (VPA)</p>
                      <p className="text-[10px] font-extrabold text-emerald-500 truncate select-all">{scannedUpiData.pa}</p>
                    </div>
                  </div>

                  {scannedUpiData.am && (
                    <div className="mt-1 flex items-center justify-between text-[8px] text-zinc-400 font-black uppercase tracking-widest bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                      <span>QR Embedded Amount:</span>
                      <span className="text-white text-[10px]">₹{scannedUpiData.am}</span>
                    </div>
                  )}
                </motion.div>
              )}
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
                 <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Verified</span>
              </div>
            </div>

            <div className="relative group">
              <input 
                type="text" 
                value={utr}
                onChange={(e) => setUtr(e.target.value.toUpperCase())}
                placeholder="UTR / REFERENCE ID"
                className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-5 text-white font-black text-xl focus:outline-none focus:border-emerald-500 transition-all tracking-[0.15em] text-center placeholder:text-zinc-800 placeholder:tracking-normal group-hover:border-zinc-700"
                required
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                 <label htmlFor="screenshot-input" className="p-2 cursor-pointer hover:bg-emerald-500/10 rounded-xl transition-all">
                    <Camera className={`w-5 h-5 ${screenshot ? 'text-emerald-500' : 'text-zinc-500'}`} />
                 </label>
                 <input type="file" id="screenshot-input" className="hidden" accept="image/*" onChange={handleScreenshotChange} />
              </div>
            </div>

            {screenshot && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative w-24 h-16 rounded-xl overflow-hidden border-2 border-emerald-500/50 shadow-lg group mx-auto">
                <img src={screenshot} className="w-full h-full object-cover" alt="Preview" />
                <button onClick={() => setScreenshot(null)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <span className="text-[8px] text-white font-black uppercase">Remove</span>
                </button>
              </motion.div>
            )}
          </div>

          {/* 3. Transaction Details (Based on Tab) */}
          <div className="space-y-6 relative">
            {activeTab === 'upi' && (
              <div className="flex flex-col items-center gap-8">
                <RazorpayQRCard 
                  amount={amount} 
                  payLink={paymentLink} 
                  merchantName="HUSSAIN ALI"
                  qrPhotoOverride={globalSettings?.upiSettings?.razorpayQrCodePhoto || globalSettings?.depositSettings?.qrCodePhoto}
                  onSimulateSuccess={handleSimulateSuccess}
                />

                <div className="w-full space-y-4">
                  {/* App Shortcuts */}
                  {(isVpa || (globalSettings?.upiSettings?.upiId && globalSettings.upiSettings.upiId.includes('@'))) && (
                    <div className="grid grid-cols-3 gap-3">
                      {upiApps.map(app => (
                        <button 
                          key={app.name}
                          onClick={() => handlePayNow(app.package, app.name)}
                          className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-emerald-500 transition-all active:scale-95 group"
                        >
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform p-2">
                             <img src={app.icon} className="w-full h-full object-contain" alt={app.name} />
                          </div>
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{app.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Manual UPI Selection */}
                  {manualUpiList.length > 0 && (
                    <div className="w-full space-y-2">
                       <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center">Available UPI Channels</p>
                       <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar justify-center">
                          {manualUpiList.map((uri: string, i: number) => (
                             <button
                               key={i}
                               onClick={() => setSelectedManualUpi(uri)}
                               className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all whitespace-nowrap border ${selectedManualUpi === uri ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                             >
                               Channel {i + 1}
                             </button>
                          ))}
                       </div>
                    </div>
                  )}

                  <button 
                    onClick={() => copyToClipboard(upiIdToUse)}
                    className="w-full flex items-center justify-between p-5 bg-zinc-900 rounded-2xl border border-zinc-800 group active:scale-95 transition-all"
                  >
                    <div className="text-left">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-0.5">
                        {isVpa ? 'UPI ID (Tap to Copy)' : 'Payment Link (Tap to Copy)'}
                      </span>
                      <span className="text-sm font-black text-white break-all">{upiIdToUse}</span>
                    </div>
                    <div className={`p-2.5 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                      {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </div>
                  </button>

                  <button 
                    onClick={() => handlePayNow()}
                    className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.15em] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl ${
                      isUrl && upiIdToUse.includes('rzp.io') 
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20' 
                        : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20'
                    }`}
                  >
                    {isUrl && upiIdToUse.includes('rzp.io') ? 'Proceed to Pay on Razorpay' : isUrl ? 'Continue to Payment' : 'Pay via All UPI Apps'}
                    {isUrl && upiIdToUse.includes('rzp.io') ? <Sparkles className="w-4 h-4 animate-pulse" /> : !isUrl ? <ArrowRight className="w-4 h-4" /> : null}
                  </button>
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
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Mobile Wallets</p>
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
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full py-6 rounded-2xl bg-emerald-500 text-white flex flex-col items-center justify-center gap-2 shadow-xl shadow-emerald-500/30"
                  >
                    <CheckCircle2 className="w-8 h-8 animate-bounce" />
                    <span className="text-xs font-black uppercase tracking-widest">Claim Submitted Successfully</span>
                  </motion.div>
                ) : (
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
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                 <Info className="w-4 h-4 text-emerald-500 shrink-0" />
                 <p className="text-[9px] font-bold text-zinc-500 leading-relaxed uppercase tracking-widest">
                   Funds are added after verification (15-30 mins). Fake submissions will lead to permanent ban.
                 </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* User's Own Payment QR Code Upload Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 space-y-6 relative overflow-hidden shadow-2xl"
        >
          {/* Subtle Background Glow */}
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <QrCode className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-left">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Your Receiving QR Code</h3>
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5">Share QR to receive money</p>
              </div>
            </div>
            
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              Optional
            </span>
          </div>

          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide leading-relaxed">
            Upload your personal UPI / Payment QR code if you choose to share it. This enables fast, automated payouts directly to your preferred account when withdrawing.
          </p>

          <AnimatePresence mode="wait">
            {qrUploading ? (
              <motion.div 
                key="loading-qr"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center justify-center gap-3 bg-zinc-950 rounded-2xl border border-zinc-800"
              >
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest animate-pulse">Processing Custom QR...</span>
              </motion.div>
            ) : userData?.paymentQrCode ? (
              <motion.div 
                key="saved-qr"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="relative group p-4 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 flex items-center justify-center">
                  <img 
                    src={userData.paymentQrCode} 
                    alt="Your Shared QR" 
                    className="w-44 h-44 object-contain rounded-2xl relative z-10 p-2 bg-white"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-[2.5rem] flex items-center justify-center transition-all z-20">
                    <button 
                      type="button"
                      onClick={handleRemoveUserQr}
                      className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all transform hover:scale-110 active:scale-95 shadow-lg flex items-center justify-center"
                      title="Remove QR Code"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 justify-center py-2.5 px-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-tight text-center">Your QR is active and shared with the merchant</p>
                  </div>

                  <button 
                    type="button"
                    onClick={handleRemoveUserQr}
                    className="w-full py-4 bg-zinc-950 text-red-500 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove shared QR code
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="upload-prompt"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <label 
                  htmlFor="user-qr-upload"
                  className="group relative border-2 border-dashed border-zinc-800 hover:border-emerald-500/40 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all bg-zinc-950/50 hover:bg-zinc-950"
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-110 group-hover:border-emerald-500/30 transition-all">
                    <Upload className="w-5 h-5 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Upload QR Code Photo</p>
                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1">PNG, JPG or JPEG (Max 800KB)</p>
                  </div>
                  <input 
                    type="file" 
                    id="user-qr-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleUserQrUpload} 
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Recent Activity Section */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-6 space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-500" />
              Recent Deposits
            </h3>
            <button 
              onClick={() => onViewHistory()}
              className="text-[10px] font-black text-emerald-500 uppercase tracking-widest"
            >
              See All
            </button>
          </div>

          <div className="space-y-3">
             {recentRequests.length > 0 ? (
               recentRequests.map((req) => (
                 <div key={req.id} className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800 transition-all hover:border-zinc-700">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' : req.status === 'Rejected' ? 'bg-red-500/10 text-red-500' : 'bg-zinc-800 text-zinc-500'}`}>
                          {req.method === 'upi' ? <QrCode className="w-5 h-5" /> : req.method === 'bank' ? <Landmark className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                       </div>
                       <div>
                          <p className="text-xs font-black text-white">₹{req.amount}</p>
                          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{req.utr}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-1 inline-block ${
                         req.status === 'Approved' ? 'bg-emerald-500 text-white' : 
                         req.status === 'Rejected' ? 'bg-red-500 text-white' : 
                         'bg-zinc-800 text-zinc-400'
                       }`}>
                          {req.status}
                       </div>
                       <p className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest">
                          {new Date(req.createdAt).toLocaleDateString()}
                       </p>
                    </div>
                 </div>
               ))
             ) : (
               <div className="text-center py-8">
                  <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-3 opacity-20">
                     <History className="w-6 h-6 text-zinc-500" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">No Recent Activity</p>
               </div>
             )}
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

      {/* Camera QR Scanner Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-sm bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-6 flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
              
              {/* Visual scan target brackets overlay */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center mb-2 z-10">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Scanner Active</span>
                <button 
                  type="button"
                  onClick={() => setIsScanning(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-red-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-zinc-400 cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="w-full mt-6 text-center">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Scan Merchant Code</h3>
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Point camera at the merchant's QR code</p>
              </div>

              {/* Aspect-square scanner view window */}
              <div className="relative w-full aspect-square bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800">
                <div id="qr-reader" className="w-full h-full object-cover" />
                
                {/* Decorative Scan Outline corners */}
                <div className="absolute inset-8 pointer-events-none border-2 border-emerald-500/20 rounded-xl">
                  <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-[4px] border-l-[4px] border-emerald-500" />
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-[4px] border-r-[4px] border-emerald-500" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-[4px] border-l-[4px] border-emerald-500" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-[4px] border-r-[4px] border-emerald-500" />
                  
                  {/* Pulsing Scan Laser bar */}
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-md shadow-emerald-500/50 animate-bounce top-1/2" />
                </div>
              </div>

              <div className="flex items-center gap-2 justify-center py-2 px-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-tight text-center">Instantly populates payments fields</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

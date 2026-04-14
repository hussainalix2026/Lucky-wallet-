import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { UserData } from '../App';
import { ChevronLeft, CheckCircle2, AlertCircle, Camera, Send, Loader2, ShieldCheck, Info, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface PaymentVerificationProps {
  userData: UserData | null;
  onBack: () => void;
}

export default function PaymentVerification({ userData, onBack }: PaymentVerificationProps) {
  const [utr, setUtr] = useState('');
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !utr || !screenshot) {
      setMessage({ type: 'error', text: 'Please fill all required fields and upload a screenshot.' });
      return;
    }

    setLoading(true);
    try {
      // Check if a transaction with this UTR already exists for THIS user
      const q = query(collection(db, 'transactions'), where('uid', '==', userData.uid));
      const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'transactions-check'));
      
      if (snap && !snap.empty) {
        // If it exists and is already success, no need to verify
        const alreadySuccess = snap.docs.some(doc => doc.data().utr === utr && doc.data().status === 'Success');
        if (alreadySuccess) {
          setMessage({ type: 'error', text: 'This transaction is already verified and successful.' });
          setLoading(false);
          return;
        }
      }

      await addDoc(collection(db, 'paymentVerifications'), {
        uid: userData.uid,
        utr,
        purchaseNumber: purchaseNumber || 'N/A',
        screenshot,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        userEmail: userData.email || 'N/A',
        userPhone: userData.phoneNumber || 'N/A'
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'paymentVerifications'));

      setMessage({ type: 'success', text: 'Payment proof submitted successfully! Admin will verify it shortly.' });
      setUtr('');
      setPurchaseNumber('');
      setScreenshot(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit payment proof.' });
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
          <h1 className="text-2xl font-black text-white tracking-tight font-display">Payment Verification</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Submit proof for manual payments</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Box */}
        <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex items-start gap-3">
          <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-zinc-400 leading-relaxed">
            If you made a manual UPI payment but your balance or ticket isn't active, upload the screenshot and UTR here for manual verification.
          </p>
        </div>

        {/* UTR Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">12-Digit UTR Number *</label>
          <div className="relative">
            <input 
              type="text" 
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="0000 0000 0000"
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-4 text-white font-black text-lg focus:outline-none focus:border-emerald-500 transition-all tracking-wider"
              maxLength={12}
              required
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <ShieldCheck className={`w-5 h-5 transition-colors ${utr.length === 12 ? 'text-emerald-500' : 'text-zinc-800'}`} />
            </div>
          </div>
        </div>

        {/* Purchase Number Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Purchase Number / Ticket (Optional)</label>
          <div className="relative">
            <input 
              type="text" 
              value={purchaseNumber}
              onChange={(e) => setPurchaseNumber(e.target.value)}
              placeholder="e.g. Ticket #45"
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-4 text-white font-black text-lg focus:outline-none focus:border-emerald-500 transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Ticket className="w-5 h-5 text-zinc-800" />
            </div>
          </div>
        </div>

        {/* Screenshot Upload */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Screenshot *</label>
          <div className="relative">
            <input 
              type="file" 
              accept="image/*"
              onChange={handleScreenshotChange}
              className="hidden"
              id="verification-screenshot-upload"
              required
            />
            <label 
              htmlFor="verification-screenshot-upload"
              className="w-full bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-[2rem] p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-emerald-500 transition-all group"
            >
              {screenshot ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl">
                  <img src={screenshot} alt="Screenshot Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white mb-2" />
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Change Screenshot</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 group-hover:scale-110 transition-transform">
                    <Camera className="w-8 h-8 text-zinc-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Upload Payment Proof</p>
                    <p className="text-[10px] text-zinc-600 font-bold mt-1">PNG, JPG up to 1MB</p>
                  </div>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          type="submit"
          disabled={loading || !utr || !screenshot}
          className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit for Verification
            </>
          )}
        </button>
      </form>

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

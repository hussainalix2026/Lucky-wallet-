import React, { useState } from 'react';
import { Loader2, CheckCircle2, ShieldCheck, Zap, Sparkles, AlertCircle } from 'lucide-react';

interface RazorpayQRCardProps {
  amount: string;
  payLink: string;
  merchantName?: string;
  qrPhotoOverride?: string;
  onSimulateSuccess?: (utr: string, base64Screenshot: string, autoApprove: boolean) => void;
}

export default function RazorpayQRCard({ 
  amount, 
  payLink, 
  merchantName = "HUSSAIN ALI", 
  qrPhotoOverride,
  onSimulateSuccess
}: RazorpayQRCardProps) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState('');
  const [simProgress, setSimProgress] = useState(0);
  const [isAutoApprove, setIsAutoApprove] = useState(true);
  const [simError, setSimError] = useState('');

  // If we have an uploaded custom QR photo, we can display it. Otherwise we generate the QR using QR server
  const qrCodeUrl = qrPhotoOverride || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payLink)}&color=000&bgcolor=fff`;

  const playPaymentChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      
      playTone(1174.66, 0, 0.4); // D6 note
      playTone(1567.98, 0.15, 0.6); // G6 note
    } catch (e) {
      console.error("Audio Web API error:", e);
    }
  };

  const playPaymentVoiceAnnouncement = (amt: string) => {
    try {
      if ('speechSynthesis' in window) {
        // Cancel first to avoid backlog
        window.speechSynthesis.cancel();
        const text = `Received payment of ${amt} rupees on Razorpay!`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.error("Speech Synthesis error:", e);
    }
  };

  const generateMockInvoice = (amt: string, utr: string, payee: string): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 450;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }

        // 1. Sleek dark gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, 600);
        grad.addColorStop(0, '#04225d');
        grad.addColorStop(1, '#050c1e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 450, 600);

        // Circular glows
        ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
        ctx.beginPath();
        ctx.arc(225, 140, 120, 0, Math.PI * 2);
        ctx.fill();

        // 2. Receipt White Sheet
        ctx.fillStyle = '#ffffff';
        // Rounded rectangle path helper
        const roundedRect = (cx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
          cx.beginPath();
          cx.moveTo(x + r, y);
          cx.lineTo(x + w - r, y);
          cx.quadraticCurveTo(x + w, y, x + w, y + r);
          cx.lineTo(x + w, y + h - r);
          cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          cx.lineTo(x + r, y + h);
          cx.quadraticCurveTo(x, y + h, x, y + h - r);
          cx.lineTo(x, y + r);
          cx.quadraticCurveTo(x, y, x + r, y);
          cx.closePath();
          cx.fill();
        };

        roundedRect(ctx, 30, 40, 390, 520, 24);

        // Header strip
        ctx.fillStyle = '#f8fafc';
        roundedRect(ctx, 30, 40, 390, 54, 24);
        ctx.fillRect(30, 64, 390, 30);

        // UPI & BHIM logos text
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 13px sans-serif';
        ctx.fillText('UPI SECURE GATEWAY RECEIPT', 50, 72);

        // Approved tick badge
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(225, 150, 26, 0, Math.PI * 2);
        ctx.fill();

        // Tick mark
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(215, 150);
        ctx.lineTo(221, 156);
        ctx.lineTo(236, 141);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TRANSACTION SUCCESSFUL', 225, 198);

        // Huge Amount Text
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 34px sans-serif';
        ctx.fillText(`₹${parseFloat(amt || '100').toFixed(2)}`, 225, 245);

        // Divider
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, 275);
        ctx.lineTo(390, 275);
        ctx.stroke();

        // Transaction Details
        ctx.textAlign = 'left';
        const details = [
          { label: 'MERCHANT NAME', val: payee.toUpperCase() },
          { label: 'UPI TRANSACTION REFERENCE', val: utr },
          { label: 'DATE & TIME', val: new Date().toLocaleString() },
          { label: 'SETTLEMENT GATEWAY', val: 'RAZORPAY DIRECT' },
          { label: 'NETWORK CLIENT STATUS', val: 'APPROVED (NPCI INSTID)' }
        ];

        let offset = 305;
        details.forEach(item => {
          ctx.font = '900 8px sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(item.label, 60, offset);

          ctx.font = '800 11px monospace';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(item.val, 60, offset + 15);
          offset += 40;
        });

        // Safe Badge
        ctx.fillStyle = '#f0fdf4';
        roundedRect(ctx, 120, 510, 210, 26, 6);
        ctx.fillStyle = '#15803d';
        ctx.font = '900 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🛡️ VERIFIED BY NPCI BANK TRUST', 225, 526);

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch (e) {
        console.error("Canvas draw failure:", e);
        resolve('');
      }
    });
  };

  const startPaymentSimulation = async () => {
    if (isSimulating) return;
    setSimError('');
    if (!amount || parseFloat(amount) <= 0) {
      setSimError('Please input a valid payment amount first.');
      return;
    }

    setIsSimulating(true);
    setSimProgress(10);
    setSimulationStep('Connecting to secure UPI rails...');

    // Progress Simulation Phases
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    await sleep(600);
    setSimProgress(35);
    setSimulationStep(`Syncing payment of ₹${amount} with Bank Server...`);

    await sleep(800);
    setSimProgress(65);
    setSimulationStep('NPCI Sandbox Gateway: Confirming transaction balance...');

    await sleep(700);
    setSimProgress(90);
    setSimulationStep('Generating transaction cryptographic receipt UTR...');

    // Generate random realistic 12-digit UPI UTR inside range
    const prefix = '524103' + Math.floor(100000 + Math.random() * 900000).toString();
    
    await sleep(500);
    setSimProgress(100);
    setSimulationStep('Payment verified!');

    // Trigger local alarms, sounds and synthesizers
    playPaymentChime();
    playPaymentVoiceAnnouncement(amount);

    const mockProof = await generateMockInvoice(amount, prefix, merchantName);

    await sleep(400);
    setIsSimulating(false);
    setSimulationStep('');
    setSimProgress(0);

    if (onSimulateSuccess) {
      onSimulateSuccess(prefix, mockProof, isAutoApprove);
    }
  };

  return (
    <div className="relative w-full max-w-xs sm:max-w-sm mx-auto overflow-hidden bg-gradient-to-b from-white to-[#f0f4ff] rounded-[2.5rem] border border-[#dce3f5] shadow-2xl p-6 flex flex-col items-center">
      {/* Dynamic Background Graphics to mimic the diagonal stripe exactly */}
      <div 
        className="absolute -left-1/4 top-1/4 w-[150%] h-44 bg-[#1862ff] -rotate-[22deg] transform origin-center opacity-90 shadow-lg"
        style={{ zIndex: 0 }}
      />

      {/* Powered by Razorpay Section */}
      <div className="relative z-10 flex flex-col items-center mb-5 mt-1 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
        <span className="text-[8px] uppercase font-black text-slate-400 tracking-[0.18em]">Powered by</span>
        <div className="flex items-center gap-1 mt-0.5">
          <svg className="h-3 w-auto fill-[#00298a]" viewBox="0 0 120 28">
            <path d="M12.4 2.1l-9.8 19.3h5.4l2-4.1h7.8l-1.4 2.8c-.8 1.6-2.4 2.6-4.2 2.6H1.3c-.6 0-1-.6-.7-1.1L10.7 1.1c.3-.5.9-.9 1.5-.9h5.1c.4 0 .7.3.5.7l-5.4 1.2z" fill="#00298a" />
          </svg>
          <span className="font-sans font-black text-[#00298a] tracking-tighter text-xs">Razorpay</span>
        </div>
      </div>

      {/* Floating Pristine Card Container */}
      <div className="relative z-10 w-full bg-white rounded-3xl p-5 shadow-2xl border border-white/60 flex flex-col items-center gap-4">
        {/* UPI and BHIM Header */}
        <div className="w-full flex justify-between items-center px-1">
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/cc/BHIM_logo.png" className="h-3 object-contain opacity-80" alt="BHIM" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo.png" className="h-3.5 object-contain" alt="UPI" />
        </div>

        {/* Razorpay Gateway Display Box instead of QR */}
        <div className="w-full py-6 px-4 bg-[#f8fafc] rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-2 relative group text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-1">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Selected Deposit Amount</span>
          <span className="text-3xl font-black text-slate-800 font-display">₹{amount || '100'}</span>
        </div>

        {/* Direct Pay Button */}
        <a 
          href={payLink || "https://rzp.io/rzp/XFu2lI2v"}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest text-center shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>Pay via Razorpay</span>
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        </a>
      </div>

      {/* Interactive Payment Sandbox Simulator */}
      <div className="relative z-10 w-full mt-4 bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 space-y-3 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            Sandbox Simulator
          </div>
          <span className="text-[7px] font-black uppercase text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
            Test Tool
          </span>
        </div>

        {simError && (
          <div className="p-2 border border-red-900/40 bg-red-950/25 rounded-md text-[8px] text-red-400 font-bold uppercase tracking-wide flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
            {simError}
          </div>
        )}

        {isSimulating ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
              <p className="text-[9px] font-black text-neon text-zinc-300 uppercase tracking-widest">{simulationStep}</p>
            </div>
            
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${simProgress}%` }} 
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[8px] text-zinc-400 leading-normal font-bold uppercase tracking-widest">
              Instantly simulates scanning the code, transferring ₹{amount} from your sandbox wallet, generating receipts, and auto-completing checkout.
            </p>

            {onSimulateSuccess && (
              <div className="flex items-center justify-between p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="flex flex-col text-left">
                  <span className="text-[8px] font-black text-white uppercase tracking-wider">Fast Credit</span>
                  <span className="text-[7px] text-zinc-500 font-bold uppercase">Skips manual admin approval step</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={isAutoApprove} 
                    onChange={(e) => setIsAutoApprove(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white" />
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={startPaymentSimulation}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              ⚡ Simulate Instant Pay
            </button>
          </div>
        )}
      </div>

      {/* GPay, PhonePe, Paytm Logos row below card */}
      <div className="relative z-10 flex items-center justify-center gap-5 mt-5 bg-white/95 backdrop-blur-sm py-2 px-5 rounded-2xl shadow-sm border border-slate-100/40">
        <div className="flex items-center gap-1 opacity-95">
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Pay_Logo_2020.svg" className="h-4 object-contain" alt="GPay" />
        </div>
        <div className="flex items-center gap-1 opacity-95 border-l border-r border-[#e2e8f0] px-3">
          <img src="https://img.icons8.com/color/48/phone-pe.png" className="h-4 object-contain" alt="PhonePe" />
          <span className="text-[9px] font-extrabold text-[#5f259f] tracking-tight">PhonePe</span>
        </div>
        <div className="flex items-center gap-1 opacity-95">
          <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Paytm_Logo_%28standalone%29.svg" className="h-3 object-contain" alt="Paytm" />
        </div>
      </div>

      {/* Hussain Ali Title banner at bottom */}
      <div className="relative z-10 mt-5 mb-1 text-center bg-white/80 px-6 py-2 rounded-2xl shadow-sm border border-white/60">
        <h3 className="text-sm font-black text-[#001d4a] uppercase tracking-wider font-sans">
          {merchantName}
        </h3>
      </div>
    </div>
  );
}

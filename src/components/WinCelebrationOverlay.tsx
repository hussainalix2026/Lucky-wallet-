import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Sparkles, Star, Zap, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WinCelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  prizeAmount: number;
  gameName?: string;
  customTitle?: string;
  customSubtext?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  type: 'confetti' | 'star' | 'coin' | 'sparkle';
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  bounce: number;
  decay: number;
}

export default function WinCelebrationOverlay({
  isOpen,
  onClose,
  prizeAmount,
  gameName = 'Game',
  customTitle,
  customSubtext,
}: WinCelebrationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  // Initialize and run particle engine
  useEffect(() => {
    if (!isOpen) {
      setActive(false);
      return;
    }

    setActive(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const resizeCanvas = () => {
      const parent = containerRef.current;
      if (!parent || !canvas) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Helper functions for particles
    const colors = [
      '#FFD700', '#FFA500', '#FF4500', '#FF1493', '#00FFFF', 
      '#32CD32', '#1E90FF', '#9370DB', '#FF8C00', '#00FA9A'
    ];

    const createParticle = (x: number, y: number, isBurst = false): Particle => {
      const angle = isBurst ? Math.random() * Math.PI * 2 : Math.PI * 1.5 + (Math.random() - 0.5) * 1.2;
      const speed = isBurst ? Math.random() * 8 + 4 : Math.random() * 12 + 6;
      const types: Array<'confetti' | 'star' | 'coin' | 'sparkle'> = ['confetti', 'star', 'coin', 'sparkle'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: type === 'coin' ? Math.random() * 6 + 6 : Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        type,
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        gravity: type === 'coin' ? 0.35 : 0.2,
        bounce: type === 'coin' ? 0.45 : 0.2,
        decay: Math.random() * 0.008 + 0.004
      };
    };

    // Initial burst from multiple points (bottom corners and center)
    const initBurst = () => {
      const parent = containerRef.current;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const particles: Particle[] = [];

      // Center burst
      for (let i = 0; i < 80; i++) {
        particles.push(createParticle(rect.width / 2, rect.height * 0.4, true));
      }

      // Left corner launcher
      for (let i = 0; i < 40; i++) {
        const p = createParticle(0, rect.height, false);
        p.vx = Math.random() * 8 + 4;
        p.vy = -(Math.random() * 12 + 10);
        particles.push(p);
      }

      // Right corner launcher
      for (let i = 0; i < 40; i++) {
        const p = createParticle(rect.width, rect.height, false);
        p.vx = -(Math.random() * 8 + 4);
        p.vy = -(Math.random() * 12 + 10);
        particles.push(p);
      }

      particlesRef.current = particles;
    };

    initBurst();

    // Game loop
    const tick = () => {
      const parent = containerRef.current;
      if (!parent || !canvas || !ctx) return;
      const rect = parent.getBoundingClientRect();

      ctx.clearRect(0, 0, rect.width, rect.height);

      // Update and draw particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        // Bounce off bottom with friction
        if (p.y > rect.height - 10 && p.vy > 0) {
          p.y = rect.height - 10;
          p.vy = -p.vy * p.bounce;
          p.vx *= 0.8;
        }

        if (p.opacity <= 0 || p.x < -50 || p.x > rect.width + 50) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.type === 'confetti') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
        } else if (p.type === 'star') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            ctx.lineTo(0, -p.size);
            ctx.rotate(Math.PI / 5);
            ctx.lineTo(0, -p.size / 2);
            ctx.rotate(Math.PI / 5);
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'coin') {
          // Double circle gold coin effect
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = '#FFD700';
          ctx.fill();
          ctx.strokeStyle = '#D4AF37';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = '#FFDF00';
          ctx.fill();

          ctx.fillStyle = '#D4AF37';
          ctx.font = `bold ${p.size * 0.9}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('₹', 0, 0.5);
        } else {
          // Glowy sparkle
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Automatically add secondary subtle background sparkles over time
      if (particles.length < 50 && Math.random() < 0.3) {
        particles.push(createParticle(Math.random() * rect.width, rect.height * 0.3, true));
      }

      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      resizeObserver.disconnect();
    };
  }, [isOpen]);

  // Click on screen triggers custom explosive bursts
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const parent = containerRef.current;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const burstColors = ['#FFD700', '#FF4500', '#00FFFF', '#FF1493', '#32CD32'];
    const burstParticles: Particle[] = [];

    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      const types: Array<'confetti' | 'star' | 'coin' | 'sparkle'> = ['confetti', 'star', 'coin', 'sparkle'];
      const type = types[Math.floor(Math.random() * types.length)];

      burstParticles.push({
        x: clickX,
        y: clickY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: type === 'coin' ? Math.random() * 5 + 5 : Math.random() * 7 + 3,
        color: burstColors[Math.floor(Math.random() * burstColors.length)],
        type,
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        gravity: type === 'coin' ? 0.3 : 0.18,
        bounce: type === 'coin' ? 0.4 : 0.2,
        decay: Math.random() * 0.012 + 0.008
      });
    }

    particlesRef.current = [...particlesRef.current, ...burstParticles];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          ref={containerRef}
          onClick={handleCanvasClick}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md overflow-hidden cursor-pointer select-none"
        >
          {/* Canvas for rendering custom physical particles */}
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 pointer-events-none" 
          />

          {/* Glowing Ambient Spotlights */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none animate-pulse duration-1000" />

          {/* Centered Celebration Card */}
          <motion.div
            initial={{ scale: 0.3, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', damping: 15, stiffness: 100 } }}
            exit={{ scale: 0.5, y: -50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()} // Prevent clicking close button/card from launching more particles
            className="relative w-full max-w-sm bg-zinc-900 border-2 border-amber-500/30 rounded-[3rem] p-8 text-center space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden"
          >
            {/* Holographic glowing borders inside card */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-amber-500/10 via-transparent to-emerald-500/5" />

            {/* Glowing Trophy Launcher / Crown */}
            <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
              {/* Outer rotating light rays */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                className="absolute inset-0 border-2 border-dashed border-amber-500/40 rounded-full"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
                className="absolute -inset-2 border border-dashed border-emerald-500/20 rounded-full"
              />

              {/* Trophy Body with Float and Hover Animations */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="relative w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-xl shadow-amber-500/30 border border-amber-300"
              >
                <Trophy className="w-10 h-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                
                {/* Embedded Stars */}
                <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-300 animate-bounce" />
                <Star className="absolute -bottom-1 -left-1 w-5 h-5 text-emerald-400 fill-emerald-400 animate-pulse" />
              </motion.div>
            </div>

            {/* Congratulations Headline */}
            <div className="space-y-1">
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">
                {gameName} Victory
              </span>
              <h2 className="text-4xl font-black text-white tracking-tight font-display bg-clip-text bg-gradient-to-b from-white to-zinc-400 mt-2">
                {customTitle || 'YOU WON!'}
              </h2>
              <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                {customSubtext || 'Your prize is ready to claim'}
              </p>
            </div>

            {/* Massive Amount Indicator */}
            <div className="relative py-5 bg-zinc-950 rounded-[2rem] border border-zinc-800/80 shadow-inner overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                Credited Amount
              </p>
              
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="text-4xl font-black text-emerald-400 tracking-tight font-mono flex items-center justify-center gap-1"
              >
                ₹{prizeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </motion.div>

              {/* Floating ambient badge */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Instant Credited</span>
              </div>
            </div>

            {/* Prompt for tapping */}
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest animate-pulse">
              💡 Tap anywhere to launch more particles!
            </p>

            {/* Close Button with pulse effect */}
            <div className="pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="relative w-full bg-amber-500 text-zinc-950 font-black py-4.5 rounded-2xl text-xs uppercase tracking-[0.15em] shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all active:scale-95 duration-150 flex items-center justify-center gap-2 overflow-hidden group"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                Claim Winnings & Back
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

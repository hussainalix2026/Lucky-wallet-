import React, { useState } from 'react';
import { UserData, View } from '../App';
import { Wallet, Ticket, Trophy, History, Plus, ChevronRight, TrendingUp, ShieldCheck, Zap, Sparkles, ArrowUpRight, Camera, Share2, Copy, CheckCircle2, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  userData: UserData | null;
  onNavigate: (view: View) => void;
}

export default function Dashboard({ userData, onNavigate }: DashboardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!userData) return null;

  const handleShare = async () => {
    const text = `Join GrandLuck Pro and win big! Use my referral code: ${userData.referralCode}\n${window.location.origin}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'GrandLuck Pro Referral',
          text: text,
          url: window.location.origin,
        });
      } catch (err) {
        // Fallback to copy if share is cancelled or fails
        copyToClipboard(text, 'Link Copied!');
      }
    } else {
      copyToClipboard(text, 'Link Copied!');
    }
  };

  const copyToClipboard = (text: string, message: string = 'Copied!') => {
    navigator.clipboard.writeText(text);
    setCopied(message);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 space-y-8 pb-32 bg-zinc-950 min-h-full">
      {/* Premium Wallet Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative group cursor-pointer"
        onClick={() => onNavigate('wallet')}
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2.5rem] blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl text-white overflow-hidden border border-zinc-800 shimmer">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet className="w-32 h-32 rotate-12" />
          </div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em]">Portfolio Balance</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tighter font-display">₹{userData.balance.toLocaleString()}</span>
                  <span className="text-emerald-500 font-bold text-xs">INR</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); onNavigate('wallet'); }}
                className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Deposit
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onNavigate('wallet'); }}
                className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black text-sm hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700"
              >
                <ArrowUpRight className="w-5 h-5" />
                Withdraw
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Menu Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MenuButton 
          onClick={() => onNavigate('buy')}
          icon={<Ticket className="w-8 h-8" />}
          title="Play Now"
          description="Win up to ₹12,000"
          color="from-orange-500 to-rose-600"
          delay={0.1}
        />
        <MenuButton 
          onClick={() => onNavigate('results')}
          icon={<Trophy className="w-8 h-8" />}
          title="Live Draws"
          description="Daily at 4:00 PM"
          color="from-purple-500 to-indigo-600"
          delay={0.2}
        />
        <MenuButton 
          onClick={() => onNavigate('purchases')}
          icon={<History className="w-8 h-8" />}
          title="My Tickets"
          description="Check status"
          color="from-blue-500 to-cyan-600"
          delay={0.3}
        />
        <MenuButton 
          onClick={() => onNavigate('wallet')}
          icon={<Wallet className="w-8 h-8" />}
          title="Finances"
          description="History & Bank"
          color="from-zinc-700 to-zinc-900"
          delay={0.4}
        />
        <MenuButton 
          onClick={() => onNavigate('verification')}
          icon={<Camera className="w-8 h-8" />}
          title="Verify Pay"
          description="Submit Proof"
          color="from-emerald-500 to-teal-600"
          delay={0.5}
        />
        <MenuButton 
          onClick={() => onNavigate('ludo')}
          icon={<Gamepad2 className="w-8 h-8" />}
          title="Ludo Game"
          description="Play & Win Cash"
          color="from-red-500 to-orange-600"
          delay={0.6}
        />
        <MenuButton 
          onClick={() => onNavigate('cricket')}
          icon={<Trophy className="w-8 h-8" />}
          title="Cricket Fantasy"
          description="Build Team & Win"
          color="from-emerald-600 to-blue-600"
          delay={0.7}
        />
      </div>

      {/* Refer & Earn Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="relative group overflow-hidden"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
              <Sparkles className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-black text-white tracking-tight font-display">Refer & Earn</p>
              <button 
                onClick={() => copyToClipboard(userData.referralCode, 'Code Copied!')}
                className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest hover:text-purple-500 transition-colors flex items-center gap-1"
              >
                Code: <span className="text-purple-500">{userData.referralCode}</span>
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-zinc-800 rounded-xl border border-zinc-700">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{userData.referralCount} Referrals</span>
            </div>
            <button 
              onClick={handleShare}
              className="p-2 bg-purple-500 hover:bg-purple-600 rounded-xl text-white transition-colors shadow-lg shadow-purple-500/20 flex items-center gap-2"
            >
              {navigator.share ? <Share2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Copied Toast */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 z-50 border border-emerald-400/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">{copied}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Stats / Info */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-black text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Market Insights
          </h3>
          <button onClick={() => onNavigate('purchases')} className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">View All</button>
        </div>
        
        <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 group cursor-pointer hover:bg-zinc-800 transition-all">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Mega Reward Active</p>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Invest ₹100 • Win ₹12,000</p>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
        </div>
      </motion.div>

      {/* Admin Quick Access */}
      {userData.isAdmin && (
        <motion.button 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={() => onNavigate('admin')}
          className="w-full bg-zinc-900 text-white p-6 rounded-[2rem] flex items-center justify-between group hover:bg-zinc-800 transition-all border border-zinc-800"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-zinc-700 transition-all border border-zinc-700">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="font-black tracking-tight">Admin Terminal</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">System Control & Verification</p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-zinc-700 group-hover:text-emerald-500 transition-all" />
        </motion.button>
      )}
    </div>
  );
}

function MenuButton({ onClick, icon, title, description, color, delay }: { onClick: () => void; icon: React.ReactNode; title: string; description: string; color: string; delay: number }) {
  return (
    <motion.button 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay }}
      onClick={onClick}
      className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-sm hover:shadow-emerald-500/5 transition-all text-left flex flex-col gap-4 group relative overflow-hidden"
    >
      <div className={`w-14 h-14 bg-gradient-to-br ${color} text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500`}>
        {icon}
      </div>
      <div>
        <p className="font-black text-white tracking-tight leading-tight font-display">{title}</p>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{description}</p>
      </div>
      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
      </div>
    </motion.button>
  );
}

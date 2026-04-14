import React, { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Ticket, Trophy, Wallet, ChevronRight } from 'lucide-react';
import { View } from '../App';

interface HomeProps {
  onNavigate: (view: View) => void;
  key?: string;
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-zinc-900 rounded-3xl p-6 text-white overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Current Jackpot</h2>
          <div className="text-4xl font-bold mb-4">$1,250,000</div>
          <button 
            onClick={() => onNavigate('buy')}
            className="bg-white text-zinc-900 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-zinc-100 transition-colors"
          >
            Play Now
          </button>
        </div>
        <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
      </div>

      <div className="grid gap-4">
        <MenuButton 
          onClick={() => onNavigate('buy')}
          icon={<Ticket className="w-6 h-6" />}
          title="Buy Numbers"
          description="Pick your lucky numbers for the next draw"
          color="bg-emerald-50 text-emerald-600"
        />
        <MenuButton 
          onClick={() => onNavigate('results')}
          icon={<Trophy className="w-6 h-6" />}
          title="Draw Results"
          description="Check if you've won the latest jackpot"
          color="bg-amber-50 text-amber-600"
        />
        <MenuButton 
          onClick={() => onNavigate('wallet')}
          icon={<Wallet className="w-6 h-6" />}
          title="My Wallet"
          description="Manage balance and view transaction history"
          color="bg-blue-50 text-blue-600"
        />
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-4">
        <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-zinc-400">Recent Winners</h3>
        <div className="space-y-3">
          {[
            { name: 'Alex H.', prize: '$50,000', time: '2h ago' },
            { name: 'Sarah M.', prize: '$1,200', time: '5h ago' },
            { name: 'John D.', prize: '$10,000', time: '1d ago' },
          ].map((winner, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center font-bold text-xs">
                  {winner.name[0]}
                </div>
                <span className="font-medium">{winner.name}</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-600">{winner.prize}</div>
                <div className="text-[10px] text-zinc-400">{winner.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function MenuButton({ onClick, icon, title, description, color }: { onClick: () => void; icon: ReactNode; title: string; description: string; color: string }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-all active:scale-[0.98] text-left w-full group"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-zinc-900">{title}</h3>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
    </button>
  );
}

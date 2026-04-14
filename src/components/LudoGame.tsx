import React, { useState } from 'react';
import { UserData } from '../App';
import { ChevronLeft, Gamepad2, Trophy, Users, Zap, Sparkles, Play, Info, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LudoBoard from './LudoBoard';

interface LudoGameProps {
  userData: UserData | null;
  onBack: () => void;
}

export default function LudoGame({ userData, onBack }: LudoGameProps) {
  const [activeTab, setActiveTab] = useState<'play' | 'rules' | 'history'>('play');
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<typeof gameModes[0] | null>(null);

  const handleJoin = (mode: typeof gameModes[0]) => {
    setSelectedMode(mode);
    setGameStarted(true);
  };

  const gameModes = [
    { id: 1, title: 'Classic 1v1', entry: 55000, prize: 100000, players: 2, icon: <Users className="w-5 h-5" /> },
    { id: 2, title: 'Quick Ludo', entry: 100000, prize: 180000, players: 2, icon: <Zap className="w-5 h-5" /> },
    { id: 3, title: 'Mega Tournament', entry: 500000, prize: 1800000, players: 4, icon: <Trophy className="w-5 h-5" /> },
  ];

  const history = [
    { id: '1', opponent: 'Bot Alpha', outcome: 'win', prize: 90, date: '2026-03-26', mode: 'Classic 1v1' },
    { id: '2', opponent: 'Bot Beta', outcome: 'loss', prize: 0, date: '2026-03-25', mode: 'Quick Ludo' },
    { id: '3', opponent: 'Bot Gamma', outcome: 'win', prize: 180, date: '2026-03-24', mode: 'Quick Ludo' },
  ];

  if (gameStarted && selectedMode) {
    return (
      <LudoBoard 
        onGameOver={() => setGameStarted(false)} 
        onQuit={() => setGameStarted(false)} 
        playersCount={selectedMode.players}
        prize={selectedMode.prize}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-black text-white tracking-tight leading-none">Ludo Pro</h2>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Real Cash Gaming</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        {/* Balance Card */}
        <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Available Balance</p>
            <p className="text-2xl font-black text-white tracking-tight">₹{userData?.balance.toLocaleString()}</p>
          </div>
          <button className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
            Add Cash
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
          {(['play', 'rules', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'play' && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Featured Game */}
              <div className="relative group overflow-hidden rounded-[2.5rem]">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-orange-600/20 blur-xl"></div>
                <div className="relative bg-zinc-900 border border-zinc-800 p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20 w-fit">
                        <Sparkles className="w-3 h-3 text-red-500" />
                        <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Live Now</span>
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight">Classic 1v1 Battle</h3>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Winner takes ₹1,00,000 instantly</p>
                    </div>
                    <div className="w-16 h-16 bg-zinc-800 rounded-3xl flex items-center justify-center border border-zinc-700">
                      <Gamepad2 className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
 
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Entry Fee</p>
                      <p className="text-xl font-black text-white">₹55,000</p>
                    </div>
                    <div className="flex-1 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Prize Pool</p>
                      <p className="text-xl font-black text-emerald-500">₹1,00,000</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleJoin(gameModes[0])}
                    className="w-full bg-red-500 text-white py-5 rounded-2xl font-black text-lg shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-3"
                  >
                    <Play className="w-6 h-6 fill-current" />
                    Join Table
                  </button>
                </div>
              </div>

              {/* Other Modes */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Other Game Modes</h4>
                <div className="grid gap-4">
                  {gameModes.slice(1).map((mode) => (
                    <div 
                      key={mode.id} 
                      onClick={() => handleJoin(mode)}
                      className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between group hover:border-red-500/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 group-hover:bg-red-500/10 transition-all">
                          <div className="text-red-500">{mode.icon}</div>
                        </div>
                        <div>
                          <p className="font-black text-white tracking-tight">{mode.title}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Entry: ₹{mode.entry} • Prize: ₹{mode.prize}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-red-500 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'rules' && (
            <motion.div
              key="rules"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                    <Info className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">Game Rules</h3>
                </div>

                <div className="space-y-4">
                  <RuleItem number="01" text="Each player starts with 4 tokens in their house." />
                  <RuleItem number="02" text="Roll a 6 to bring a token out onto the starting square." />
                  <RuleItem number="03" text="Tokens move clockwise around the board." />
                  <RuleItem number="04" text="Capture opponent tokens by landing on the same square." />
                  <RuleItem number="05" text="First player to bring all 4 tokens home wins the prize." />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {history.length > 0 ? (
                <div className="grid gap-4">
                  {history.map((game) => (
                    <div key={game.id} className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                          game.outcome === 'win' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                            : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                          {game.outcome === 'win' ? <Trophy className="w-6 h-6" /> : <Gamepad2 className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-white tracking-tight">{game.opponent}</p>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                              game.outcome === 'win' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                              {game.outcome}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{game.mode} • {game.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black tracking-tight ${game.outcome === 'win' ? 'text-emerald-500' : 'text-zinc-500'}`}>
                          {game.outcome === 'win' ? `+₹${game.prize}` : '₹0'}
                        </p>
                        <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Prize</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-zinc-900/50 rounded-[2.5rem] border border-dashed border-zinc-800">
                  <Gamepad2 className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">No game history yet</p>
                  <button 
                    onClick={() => setActiveTab('play')}
                    className="mt-4 text-red-500 font-black text-[10px] uppercase tracking-widest"
                  >
                    Start Playing Now
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RuleItem({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex gap-4 items-start">
      <span className="text-red-500 font-black text-lg leading-none">{number}</span>
      <p className="text-zinc-400 text-sm font-medium leading-relaxed">{text}</p>
    </div>
  );
}

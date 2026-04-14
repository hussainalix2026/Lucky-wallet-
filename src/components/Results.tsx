import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Trophy, ChevronLeft, Calendar, Ticket, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface ResultsProps {
  onBack: () => void;
}

interface Result {
  id: string;
  number: number;
  drawDate: string;
  winnersCount: number;
  totalPayout: number;
  createdAt: string;
}

export default function Results({ onBack }: ResultsProps) {
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'results'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'results');
    });
  }, []);

  return (
    <div className="p-6 space-y-8 pb-32 bg-zinc-950 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-xl transition-colors border border-zinc-800">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight font-display">Draw Results</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Daily winning numbers</p>
        </div>
      </div>

      {/* Latest Result Card */}
      {results.length > 0 ? (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2.5rem] blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 text-white overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Trophy className="w-40 h-40 rotate-12" />
            </div>
            
            <div className="relative z-10 space-y-8">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em]">Latest Winner</span>
                  <p className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {results[0].drawDate}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
                  <Trophy className="w-6 h-6 text-purple-500" />
                </div>
              </div>

              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <div className="absolute -inset-4 bg-purple-500/20 blur-2xl rounded-full animate-pulse" />
                  <div className="w-28 h-28 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-6xl font-black shadow-2xl relative z-10 border border-white/10">
                    {results[0].number}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50 backdrop-blur-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Winners</p>
                  <p className="text-xl font-black tracking-tight text-white font-display">{results[0].winnersCount || 0}</p>
                </div>
                <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50 backdrop-blur-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Payout</p>
                  <p className="text-xl font-black tracking-tight text-emerald-500 font-display">₹{results[0].totalPayout?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="bg-zinc-900 p-12 rounded-[2.5rem] border border-zinc-800 shadow-xl text-center space-y-6">
          <div className="w-24 h-24 bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto border border-zinc-700">
            <Calendar className="w-12 h-12 text-zinc-600" />
          </div>
          <div className="space-y-2">
            <p className="text-zinc-500 font-black uppercase tracking-[0.2em] text-xs">Waiting for today's draw</p>
            <p className="text-[10px] text-zinc-600 font-bold italic">Daily results announced at 4:00 PM IST</p>
          </div>
        </div>
      )}

      {/* Previous Results */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-zinc-500" />
            Previous Results
          </h3>
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Last 10 Draws</span>
        </div>

        <div className="space-y-3">
          {results.slice(1).map((res, index) => (
            <motion.div 
              key={res.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center gap-5 hover:border-zinc-700 transition-colors group"
            >
              <div className="w-12 h-12 bg-zinc-800 text-zinc-300 rounded-xl flex items-center justify-center text-xl font-black border border-zinc-700 group-hover:bg-purple-500 group-hover:text-white group-hover:border-purple-400 transition-all">
                {res.number}
              </div>
              <div className="flex-1">
                <p className="font-black text-white text-sm tracking-tight">{res.drawDate}</p>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  {res.winnersCount} Winners • <span className="text-emerald-500/80">₹{res.totalPayout?.toLocaleString()} Payout</span>
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

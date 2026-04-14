import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { UserData } from '../App';
import { History, ChevronLeft, Ticket, Trophy, XCircle, Clock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface MyPurchasesProps {
  userData: UserData | null;
  onBack: () => void;
  onPlayAgain: (data: { number: number, investment: number }) => void;
}

interface Purchase {
  id: string;
  number: number;
  amount: number;
  winningAmount: number;
  status: 'Pending' | 'Won' | 'Lost';
  drawDate: string;
  createdAt: string;
}

export default function MyPurchases({ userData, onBack, onPlayAgain }: MyPurchasesProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    if (!userData) return;
    const q = query(
      collection(db, 'purchasedNumbers'),
      where('uid', '==', userData.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'purchasedNumbers');
    });
  }, [userData]);

  if (!userData) return null;

  return (
    <div className="p-6 space-y-8 pb-32 bg-zinc-950 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-xl transition-colors border border-zinc-800">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight font-display">Purchase History</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Track your lucky tickets</p>
        </div>
      </div>

      {/* Purchase List */}
      <div className="space-y-4">
        {purchases.length === 0 ? (
          <div className="text-center py-24 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-xl">
            <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-700">
              <Ticket className="w-10 h-10 text-zinc-600" />
            </div>
            <p className="text-zinc-500 font-black uppercase tracking-[0.2em] text-xs">No active tickets found</p>
            <p className="text-[10px] text-zinc-600 font-bold mt-2">Your purchased numbers will appear here</p>
          </div>
        ) : (
          purchases.map((purchase, index) => (
            <motion.div 
              key={purchase.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900 p-5 rounded-[2rem] border border-zinc-800 shadow-xl flex items-center gap-5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors" />
              
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-2xl relative z-10 ${
                purchase.status === 'Won' ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-emerald-500/20' :
                purchase.status === 'Lost' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' :
                'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/20'
              }`}>
                {purchase.number}
              </div>

              <div className="flex-1 space-y-2 relative z-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stake: ₹{purchase.amount}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    purchase.status === 'Won' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    purchase.status === 'Lost' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  }`}>
                    {purchase.status === 'Pending' && <Clock className="w-3 h-3" />}
                    {purchase.status === 'Won' && <Trophy className="w-3 h-3" />}
                    {purchase.status === 'Lost' && <XCircle className="w-3 h-3" />}
                    {purchase.status}
                  </div>
                </div>
                
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-lg font-black text-white tracking-tight font-display">
                      {purchase.status === 'Won' ? `Won ₹${purchase.winningAmount.toLocaleString()}` : 'Draw Result'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <History className="w-3 h-3 text-zinc-600" />
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{purchase.drawDate}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onPlayAgain({ number: purchase.number, investment: purchase.amount })}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-3 h-3" />
                    Play Again
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

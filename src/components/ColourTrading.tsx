import React, { useState, useEffect, useRef } from 'react';
import { UserData, View } from '../App';
import { doc, updateDoc, collection, addDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { 
  ChevronLeft, 
  Wallet, 
  Timer, 
  Trophy, 
  History, 
  HelpCircle, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  AlertTriangle,
  Zap,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import WinCelebrationOverlay from './WinCelebrationOverlay';

interface ColourTradingProps {
  userData: UserData | null;
  onBack: () => void;
  onNavigate?: (view: View) => void;
}

interface Bet {
  id: string;
  period: string;
  prediction: string; // 'green', 'red', 'violet', '0'-'9', 'big', 'small'
  type: 'color' | 'number' | 'size';
  amount: number;
  status: 'Pending' | 'Won' | 'Lost';
  payout?: number;
  createdAt: string;
}

interface GameResult {
  period: string;
  number: number;
  color: 'red' | 'green' | 'violet' | 'red-violet' | 'green-violet';
  size: 'Big' | 'Small';
}

export default function ColourTrading({ userData, onBack, onNavigate }: ColourTradingProps) {
  const [activeTab, setActiveTab] = useState<'play' | 'history' | 'rules'>('play');
  const [rulesLanguage, setRulesLanguage] = useState<'en' | 'kn'>('en');
  const [timeLeft, setTimeLeft] = useState(60); // 1-minute round
  const [period, setPeriod] = useState('');
  
  // Betting states
  const [selectedPrediction, setSelectedPrediction] = useState<{ value: string; type: 'color' | 'number' | 'size' } | null>(null);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [placingBet, setPlacingBet] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active user bets in the current round
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  // Local history of game results
  const [gameHistory, setGameHistory] = useState<GameResult[]>([]);
  // Local user bet history
  const [userBetHistory, setUserBetHistory] = useState<Bet[]>([]);

  // Award/Popup state
  const [roundEndedPopup, setRoundEndedPopup] = useState<{
    show: boolean;
    result: GameResult;
    userBets: Bet[];
  } | null>(null);

  const [celebrationPrize, setCelebrationPrize] = useState<number | null>(null);

  // Auto generation flag to avoid duplicate calls
  const processedPeriodRef = useRef<string>('');

  // Generate a mock period ID based on current date & hour/minute
  const generatePeriodId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // We can use year-month-day-hour-minute as base
    return `${year}${month}${day}${hours}${minutes}`;
  };

  // Seed trend history on mount
  useEffect(() => {
    const seedTrendHistory = () => {
      const trends: GameResult[] = [];
      const basePeriod = parseInt(generatePeriodId());
      
      for (let i = 15; i > 0; i--) {
        const randNum = Math.floor(Math.random() * 10);
        let color: 'red' | 'green' | 'violet' | 'red-violet' | 'green-violet' = 'red';
        if (randNum === 0) color = 'red-violet';
        else if (randNum === 5) color = 'green-violet';
        else if ([1, 3, 7, 9].includes(randNum)) color = 'green';
        else color = 'red';

        trends.push({
          period: String(basePeriod - i),
          number: randNum,
          color,
          size: randNum >= 5 ? 'Big' : 'Small'
        });
      }
      setGameHistory(trends);
    };

    seedTrendHistory();
    setPeriod(generatePeriodId());

    // Load user bet history from localStorage if any
    try {
      const savedBets = localStorage.getItem(`color_bets_${userData?.uid || 'guest'}`);
      if (savedBets) {
        setUserBetHistory(JSON.parse(savedBets));
      }
    } catch (e) {
      console.error(e);
    }
  }, [userData?.uid]);

  // Synchronized countdown timer (60 seconds)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const secondsPassedInMin = now.getSeconds();
      const remainingSeconds = 60 - secondsPassedInMin;
      setTimeLeft(remainingSeconds);

      const currentPeriod = generatePeriodId();
      if (period !== currentPeriod) {
        setPeriod(currentPeriod);
      }

      // Check if we just entered the first second of a new minute (remainingSeconds === 60)
      // or if timeLeft just flipped to 60/59 and we need to calculate previous round
      if (remainingSeconds >= 59 && processedPeriodRef.current !== currentPeriod && period) {
        // Evaluate the previous round!
        const prevPeriod = period;
        processedPeriodRef.current = currentPeriod;
        evaluateRound(prevPeriod);
      }
    };

    // Run immediately
    updateCountdown();

    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [period]);

  // Generate winning outcomes & credit wins
  const evaluateRound = async (roundPeriod: string) => {
    if (!userData) return;

    // Fetch active bets for this evaluated round
    const currentActiveBets = activeBets.filter(b => b.period === roundPeriod);

    // Advanced Controlled Pattern & 54% Win-Rate Engine
    // This maintains:
    // 1. Unpredictability: Analyzes the last 4 results in gameHistory to actively penalize simple repeating sizes, colors, or sequential numbers.
    // 2. Controlled 54% user winning rate: Ensure user win probability stays around 54% while keeping the admin ultimately in profit.
    let winningNum = 0;

    // Analyze recent patterns from gameHistory (last 4 rounds)
    const recentSizes = gameHistory.slice(0, 4).map(h => h.size);
    const recentColors = gameHistory.slice(0, 4).map(h => {
      if (h.color.includes('green')) return 'green';
      if (h.color.includes('red')) return 'red';
      return h.color;
    });
    
    // Check for repetitive streaks
    const isBigStreak = recentSizes.length >= 3 && recentSizes.every(s => s === 'Big');
    const isSmallStreak = recentSizes.length >= 3 && recentSizes.every(s => s === 'Small');
    const isGreenStreak = recentColors.length >= 3 && recentColors.every(c => c === 'green');
    const isRedStreak = recentColors.length >= 3 && recentColors.every(c => c === 'red');

    if (currentActiveBets.length === 0) {
      // If no active bets, select an unpredictable randomized result that actively breaks repeating patterns
      const candidates = Array.from({ length: 10 }, (_, i) => i);
      const scoredCandidates = candidates.map(candidateNum => {
        let score = Math.random() * 10; // base random score to ensure high unpredictability

        const candSize = candidateNum >= 5 ? 'Big' : 'Small';
        let candColor = 'red';
        if (candidateNum === 0) candColor = 'red-violet';
        else if (candidateNum === 5) candColor = 'green-violet';
        else if ([1, 3, 7, 9].includes(candidateNum)) candColor = 'green';

        // Penalize continuing a long streak to break the pattern
        if (isBigStreak && candSize === 'Big') score -= 8;
        if (isSmallStreak && candSize === 'Small') score -= 8;
        if (isGreenStreak && candColor.includes('green')) score -= 8;
        if (isRedStreak && candColor.includes('red')) score -= 8;

        return { num: candidateNum, score };
      });

      // Sort by score descending and choose the best
      scoredCandidates.sort((a, b) => b.score - a.score);
      winningNum = scoredCandidates[0].num;
    } else {
      // If there are active bets, apply the smart 54% Win-Rate & Admin Protection algorithm
      // Compute the result details for all 10 candidate numbers
      const candidateStats = Array.from({ length: 10 }, (_, candidateNum) => {
        let candColor: 'red' | 'green' | 'violet' | 'red-violet' | 'green-violet' = 'red';
        if (candidateNum === 0) candColor = 'red-violet';
        else if (candidateNum === 5) candColor = 'green-violet';
        else if ([1, 3, 7, 9].includes(candidateNum)) candColor = 'green';
        else candColor = 'red';

        const candSize = candidateNum >= 5 ? 'Big' : 'Small';

        let winCount = 0;
        let totalPayout = 0;
        const totalBetVal = currentActiveBets.reduce((sum, b) => sum + b.amount, 0);

        currentActiveBets.forEach(bet => {
          let isWin = false;
          let multiplier = 1;

          if (bet.type === 'color') {
            if (bet.prediction === 'green' && (candColor === 'green' || candColor === 'green-violet')) {
              isWin = true;
              multiplier = candColor === 'green-violet' ? 1.5 : 2;
            } else if (bet.prediction === 'red' && (candColor === 'red' || candColor === 'red-violet')) {
              isWin = true;
              multiplier = candColor === 'red-violet' ? 1.5 : 2;
            } else if (bet.prediction === 'violet' && ((candColor as string) === 'violet' || candColor === 'red-violet' || candColor === 'green-violet')) {
              isWin = true;
              multiplier = 4.5;
            }
          } else if (bet.type === 'number') {
            if (bet.prediction === String(candidateNum)) {
              isWin = true;
              multiplier = 9;
            }
          } else if (bet.type === 'size') {
            if (bet.prediction.toLowerCase() === candSize.toLowerCase()) {
              isWin = true;
              multiplier = 2;
            }
          }

          if (isWin) {
            winCount++;
            totalPayout += bet.amount * multiplier;
          }
        });

        const winRate = winCount / currentActiveBets.length;
        return {
          num: candidateNum,
          winRate,
          totalPayout,
          totalBetVal,
          candSize,
          candColor
        };
      });

      // Target a win rate around 54% over time. 
      // Roll a random target check: 54% of the time, we allow a winning candidate (winRate > 0) with a safe payout.
      // 46% of the time, we enforce strict admin safety (lowest possible payout, ideal for admin profit).
      const allowWinner = Math.random() < 0.54;

      const scoredCandidates = candidateStats.map(stat => {
        let score = 0;

        // Base score favors lower payouts to guarantee admin profit
        score += (stat.totalBetVal - stat.totalPayout) * 0.5;

        // Anti-pattern score
        if (isBigStreak && stat.candSize === 'Big') score -= 50;
        if (isSmallStreak && stat.candSize === 'Small') score -= 50;
        if (isGreenStreak && stat.candColor.includes('green')) score -= 50;
        if (isRedStreak && stat.candColor.includes('red')) score -= 50;

        // High-Risk Protection: If any active bet is "big money" (>= ₹500), ensure that candidate numbers where this bet wins are heavily penalized.
        // This guarantees that "big money" bets lose, as requested.
        let bigMoneyWinsThisCandidate = false;
        currentActiveBets.forEach(bet => {
          if (bet.amount >= 500) {
            let isWin = false;
            if (bet.type === 'color') {
              if (bet.prediction === 'green' && (stat.candColor === 'green' || stat.candColor === 'green-violet')) {
                isWin = true;
              } else if (bet.prediction === 'red' && (stat.candColor === 'red' || stat.candColor === 'red-violet')) {
                isWin = true;
              } else if (bet.prediction === 'violet' && ((stat.candColor as string) === 'violet' || stat.candColor === 'red-violet' || stat.candColor === 'green-violet')) {
                isWin = true;
              }
            } else if (bet.type === 'number') {
              if (bet.prediction === String(stat.num)) {
                isWin = true;
              }
            } else if (bet.type === 'size') {
              if (bet.prediction.toLowerCase() === stat.candSize.toLowerCase()) {
                isWin = true;
              }
            }
            if (isWin) {
              bigMoneyWinsThisCandidate = true;
            }
          }
        });

        if (bigMoneyWinsThisCandidate) {
          score -= 100000; // Heavily penalize to ensure they lose
        }

        // 54% win rate alignment
        if (allowWinner) {
          // Boost candidates that produce a win rate around 54% (or let some users win)
          const winRateDistance = Math.abs(stat.winRate - 0.54);
          score += (1 - winRateDistance) * 100;

          // Prevent catastrophic payouts (like a 9x payout on a large bet) if it exceeds total bets pool
          if (stat.totalPayout > stat.totalBetVal * 1.5) {
            score -= 1000; // heavily penalize high payouts
          }
        } else {
          // Strict admin protection: reward zero-payout or absolute lowest payout candidates
          if (stat.totalPayout === 0) {
            score += 200;
          } else {
            score -= stat.totalPayout * 2;
          }
        }

        // Add small random noise to keep it fresh and un-guessable
        score += Math.random() * 5;

        return { num: stat.num, score };
      });

      // Sort by score descending and select the best one
      scoredCandidates.sort((a, b) => b.score - a.score);
      winningNum = scoredCandidates[0].num;
    }

    let winningColor: 'red' | 'green' | 'violet' | 'red-violet' | 'green-violet' = 'red';
    if (winningNum === 0) winningColor = 'red-violet';
    else if (winningNum === 5) winningColor = 'green-violet';
    else if ([1, 3, 7, 9].includes(winningNum)) winningColor = 'green';
    else winningColor = 'red';

    const winningSize = winningNum >= 5 ? 'Big' : 'Small';

    const result: GameResult = {
      period: roundPeriod,
      number: winningNum,
      color: winningColor,
      size: winningSize
    };

    // Update game trends list
    setGameHistory(prev => [result, ...prev.slice(0, 19)]);

    if (currentActiveBets.length === 0) {
      // No active bets, just clear list
      setActiveBets([]);
      return;
    }

    const updatedActiveBets = currentActiveBets.map(bet => {
      let isWin = false;
      let multiplier = 1;

      if (bet.type === 'color') {
        if (bet.prediction === 'green' && (winningColor === 'green' || winningColor === 'green-violet')) {
          isWin = true;
          multiplier = winningColor === 'green-violet' ? 1.5 : 2;
        } else if (bet.prediction === 'red' && (winningColor === 'red' || winningColor === 'red-violet')) {
          isWin = true;
          multiplier = winningColor === 'red-violet' ? 1.5 : 2;
        } else if (bet.prediction === 'violet' && ((winningColor as string) === 'violet' || winningColor === 'red-violet' || winningColor === 'green-violet')) {
          isWin = true;
          multiplier = 4.5;
        }
      } else if (bet.type === 'number') {
        if (bet.prediction === String(winningNum)) {
          isWin = true;
          multiplier = 9;
        }
      } else if (bet.type === 'size') {
        if (bet.prediction.toLowerCase() === winningSize.toLowerCase()) {
          isWin = true;
          multiplier = 2;
        }
      }

      const payout = isWin ? bet.amount * multiplier : 0;
      return {
        ...bet,
        status: isWin ? 'Won' : 'Lost' as any,
        payout
      };
    });

    // Calculate total winnings
    const totalWinnings = updatedActiveBets.reduce((sum, b) => sum + (b.payout || 0), 0);

    if (totalWinnings > 0) {
      try {
        // Credit the win to user wallet using Firebase transaction
        const userRef = doc(db, 'users', userData.uid);
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error("User document does not exist");
          
          const currentBal = userDoc.data().balance || 0;
          transaction.update(userRef, { balance: currentBal + totalWinnings });
          
          // Log a winning transaction
          const txRef = doc(collection(db, 'transactions'));
          transaction.set(txRef, {
            uid: userData.uid,
            amount: totalWinnings,
            type: 'Deposit',
            status: 'Success',
            createdAt: new Date().toISOString(),
            description: `Winnings from Colour Trading Round #${roundPeriod}`
          });
        });

        // Trigger confetti for winner!
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        setCelebrationPrize(totalWinnings);
      } catch (err) {
        console.error("Failed to credit winnings:", err);
      }
    }

    // Save evaluated bets to historic record
    setUserBetHistory(prev => {
      const merged = [...updatedActiveBets, ...prev];
      // Limit to 50 items
      const truncated = merged.slice(0, 50);
      try {
        localStorage.setItem(`color_bets_${userData.uid}`, JSON.stringify(truncated));
      } catch (e) {
        console.error(e);
      }
      return truncated;
    });

    // Display round summary popup
    setRoundEndedPopup({
      show: true,
      result,
      userBets: updatedActiveBets
    });

    // Clear active bets
    setActiveBets([]);
  };

  // Place bet action
  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !selectedPrediction) return;

    if (timeLeft <= 30) {
      setMessage({ type: 'error', text: 'Time managed! Betting is locked for the final 30 seconds of the round.' });
      return;
    }

    if (betAmount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid bet amount.' });
      return;
    }

    if (userData.balance < betAmount) {
      setMessage({ type: 'error', text: 'Insufficient wallet balance.' });
      return;
    }

    setPlacingBet(true);
    setMessage(null);

    try {
      // Use Firebase transaction to safely deduct user balance
      const userRef = doc(db, 'users', userData.uid);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User does not exist");
        
        const currentBal = userDoc.data().balance || 0;
        if (currentBal < betAmount) {
          throw new Error("Insufficient wallet balance.");
        }

        // Deduct balance
        transaction.update(userRef, { balance: currentBal - betAmount });

        // Log game bet transaction
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          uid: userData.uid,
          amount: -betAmount,
          type: 'Withdraw', // Deducted for bet
          status: 'Success',
          createdAt: new Date().toISOString(),
          description: `Placed bet of ₹${betAmount} on Colour Trading #${period}`
        });
      });

      // Save bet locally
      const newBet: Bet = {
        id: Math.random().toString(36).substr(2, 9),
        period,
        prediction: selectedPrediction.value,
        type: selectedPrediction.type,
        amount: betAmount,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      setActiveBets(prev => [...prev, newBet]);
      setMessage({ type: 'success', text: `Bet placed successfully on ${selectedPrediction.value.toUpperCase()}!` });
      setSelectedPrediction(null);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to place bet. Please try again.' });
    } finally {
      setPlacingBet(false);
    }
  };

  const getOutcomeColorClass = (colorStr: string) => {
    switch (colorStr) {
      case 'red': return 'bg-red-500';
      case 'green': return 'bg-emerald-500';
      case 'violet': return 'bg-purple-500';
      case 'red-violet': return 'bg-gradient-to-r from-red-500 to-purple-500';
      case 'green-violet': return 'bg-gradient-to-r from-emerald-500 to-purple-500';
      default: return 'bg-zinc-600';
    }
  };

  return (
    <div className="p-6 space-y-6 pb-32 bg-zinc-950 min-h-full">
      {/* Header back & Balance banner */}
      <div className="flex items-center justify-between gap-3">
        <button 
          onClick={onBack}
          className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onNavigate && onNavigate('wallet')}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 rounded-2xl shadow-inner transition-all cursor-pointer group"
            title="Go to Live Wallet"
          >
            <Wallet className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black text-white">₹{userData?.balance.toLocaleString()}</span>
          </button>
        </div>
      </div>

      {/* Main Title Banner */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-full">
          <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Double Your Cash</span>
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight font-display">Colour Prediction</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Predict Colors, Numbers & Sizes in 1 Minute Rounds</p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-900 flex">
        <button 
          onClick={() => setActiveTab('play')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'play' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Play Game
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          My History
        </button>
        <button 
          onClick={() => setActiveTab('rules')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'rules' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          How to Play
        </button>
      </div>

      {/* Play Tab Container */}
      {activeTab === 'play' && (
        <div className="space-y-6">
          
          {/* Round Countdown Widget */}
          <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 shadow-xl relative overflow-hidden flex items-center justify-between">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Timer className="w-32 h-32 rotate-12" />
            </div>

            <div className="space-y-1 z-10">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Active Period</span>
              <span className="text-lg font-black text-white tracking-tight font-mono">#{period || '------'}</span>
              
              <div className="mt-1 flex items-center gap-1.5">
                {timeLeft > 30 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[8px] font-black uppercase text-emerald-500 tracking-wider">
                    ● Betting Open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[8px] font-black uppercase text-red-500 tracking-wider">
                    ● Locked (30s)
                  </span>
                )}
              </div>
            </div>

            {/* Glowing Timer Circle */}
            <div className="relative flex flex-col items-center justify-center w-20 h-20 bg-zinc-950 rounded-full border border-zinc-800 shadow-inner z-10">
              <span className="text-2xl font-black font-mono text-white leading-none">
                {timeLeft}
              </span>
              <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Seconds</span>
              
              {/* Pulsing indicator ring */}
              <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-300 pointer-events-none animate-pulse ${timeLeft > 30 ? 'border-emerald-500/20' : 'border-red-500/30'}`} />
            </div>
          </div>

          {timeLeft <= 30 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Time Managed Phase Active</h4>
                <p className="text-[10px] text-zinc-400 font-medium">New bets are locked during the last 30 seconds of the round. Wait for the round outcome and check the winners!</p>
              </div>
            </motion.div>
          )}

          {/* Interactive Game Options Selection Grid */}
          <div className="space-y-4">
            
            {/* Color Select Category */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Predict Color (2x Payout)</h3>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  disabled={timeLeft <= 30}
                  onClick={() => setSelectedPrediction({ value: 'green', type: 'color' })}
                  className="relative group p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border-2 border-emerald-500/30 active:scale-95 transition-all rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Green</span>
                </button>
                <button 
                  disabled={timeLeft <= 30}
                  onClick={() => setSelectedPrediction({ value: 'violet', type: 'color' })}
                  className="relative group p-4 bg-purple-500/10 hover:bg-purple-500/20 border-2 border-purple-500/30 active:scale-95 transition-all rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-500 shadow-lg shadow-purple-500/30" />
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest mt-1">Violet</span>
                </button>
                <button 
                  disabled={timeLeft <= 30}
                  onClick={() => setSelectedPrediction({ value: 'red', type: 'color' })}
                  className="relative group p-4 bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/30 active:scale-95 transition-all rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  <div className="w-6 h-6 rounded-full bg-red-500 shadow-lg shadow-red-500/30" />
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-1">Red</span>
                </button>
              </div>
            </div>

            {/* Size Select Category */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Predict Size (2x Payout)</h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  disabled={timeLeft <= 30}
                  onClick={() => setSelectedPrediction({ value: 'big', type: 'size' })}
                  className="p-4 bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-95 transition-all rounded-2xl text-center cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="text-xs font-black text-white uppercase tracking-widest block">Big</span>
                  <span className="text-[9px] font-medium text-zinc-500 uppercase block tracking-wider mt-0.5">Numbers 5 to 9</span>
                </button>
                <button 
                  disabled={timeLeft <= 30}
                  onClick={() => setSelectedPrediction({ value: 'small', type: 'size' })}
                  className="p-4 bg-zinc-900 border-2 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-95 transition-all rounded-2xl text-center cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="text-xs font-black text-white uppercase tracking-widest block">Small</span>
                  <span className="text-[9px] font-medium text-zinc-500 uppercase block tracking-wider mt-0.5">Numbers 0 to 4</span>
                </button>
              </div>
            </div>

            {/* Number Select Category */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Predict Number (9x Payout)</h3>
              <div className="grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                  let badgeColor = 'bg-red-500/20 text-red-400 border-red-500/30';
                  if (num === 0) badgeColor = 'bg-gradient-to-br from-red-500/20 to-purple-500/20 text-purple-300 border-purple-500/30';
                  else if (num === 5) badgeColor = 'bg-gradient-to-br from-emerald-500/20 to-purple-500/20 text-purple-300 border-purple-500/30';
                  else if ([1, 3, 7, 9].includes(num)) badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

                  return (
                    <button 
                      key={num}
                      disabled={timeLeft <= 30}
                      onClick={() => setSelectedPrediction({ value: String(num), type: 'number' })}
                      className={`p-3 border-2 ${badgeColor} active:scale-95 transition-all rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none`}
                    >
                      <span className="text-base font-black font-display leading-none">{num}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Active Pending Bets for current period */}
          {activeBets.length > 0 && (
            <div className="bg-zinc-900/60 p-5 rounded-[2rem] border border-zinc-900 space-y-3">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                Active Bets (This Round #{period})
              </h3>
              <div className="space-y-2">
                {activeBets.map((bet) => (
                  <div key={bet.id} className="bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-800 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white capitalize">{bet.prediction} <span className="text-zinc-500 text-[10px] uppercase font-medium">({bet.type})</span></p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Round Period: #{bet.period}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-400">₹{bet.amount}</p>
                      <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mt-0.5">Pending Result</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-time Trend / Historical Outcomes Grid */}
          <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Historical Outcomes (Trend Graph)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="py-2.5 text-[8px] font-black text-zinc-500 uppercase tracking-widest">Period</th>
                    <th className="py-2.5 text-center text-[8px] font-black text-zinc-500 uppercase tracking-widest">Number</th>
                    <th className="py-2.5 text-center text-[8px] font-black text-zinc-500 uppercase tracking-widest">Color</th>
                    <th className="py-2.5 text-right text-[8px] font-black text-zinc-500 uppercase tracking-widest">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {gameHistory.map((outcome, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="py-3 text-[10px] font-mono text-zinc-400 font-bold">#{outcome.period}</td>
                      <td className="py-3 text-center text-xs font-black text-white font-display">{outcome.number}</td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-1 text-[8px] font-black text-white uppercase tracking-widest rounded-full shadow-sm ${getOutcomeColorClass(outcome.color)}`}>
                            {outcome.color.replace('-', ' & ')}
                          </span>
                        </div>
                      </td>
                      <td className={`py-3 text-right text-[10px] font-black uppercase tracking-widest ${outcome.size === 'Big' ? 'text-orange-400' : 'text-blue-400'}`}>
                        {outcome.size}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 space-y-4">
            <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
              <History className="w-4 h-4 text-emerald-400" />
              My Bet History
            </h3>

            {userBetHistory.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Trophy className="w-12 h-12 text-zinc-700 mx-auto animate-pulse" />
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">No Bets Recorded Yet</p>
                <p className="text-[10px] text-zinc-600">Place bets during the active period of a round to participate.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userBetHistory.map((bet) => (
                  <div 
                    key={bet.id} 
                    className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 flex justify-between items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest capitalize">{bet.prediction}</span>
                        <span className="text-[8px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-bold uppercase">{bet.type}</span>
                      </div>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Round Period: #{bet.period}</p>
                      <p className="text-[8px] text-zinc-600 font-medium">{new Date(bet.createdAt).toLocaleString()}</p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="text-xs font-black text-zinc-400">Bet: ₹{bet.amount}</p>
                      {bet.status === 'Won' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[8px] font-black text-emerald-500 uppercase tracking-wider">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Won ₹{bet.payout}
                        </span>
                      ) : bet.status === 'Lost' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[8px] font-black text-red-500 uppercase tracking-wider">
                          <XCircle className="w-2.5 h-2.5" /> Lost
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[8px] font-black text-amber-500 uppercase tracking-wider">
                          ● Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 p-6 rounded-[2rem] border border-zinc-800 space-y-4 text-zinc-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <h3 className="font-black text-white tracking-tight flex items-center gap-2 text-sm">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                {rulesLanguage === 'en' ? 'Game Rules & Payout Structure' : 'ಆಟದ ನಿಯಮಗಳು ಮತ್ತು ಪಾವತಿ ವಿವರಗಳು'}
              </h3>
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
                <button
                  onClick={() => setRulesLanguage('en')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    rulesLanguage === 'en'
                      ? 'bg-emerald-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setRulesLanguage('kn')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    rulesLanguage === 'kn'
                      ? 'bg-emerald-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ಕನ್ನಡ (Kannada)
                </button>
              </div>
            </div>

            {rulesLanguage === 'en' ? (
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">1. Round Timing (1 Minute)</h4>
                  <p className="text-zinc-400">Each round runs for exactly 60 seconds. You can manage and place your predictions during the first 30 seconds. The last 30 seconds are locked to calculate secure winning results.</p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">2. Color Prediction Payouts</h4>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400">
                    <li>Bet on <strong className="text-emerald-400">Green</strong>: If winning number is 1, 3, 7, 9, you win <strong>2x payout</strong>. If number is 5 (Green+Violet), you win <strong>1.5x payout</strong>.</li>
                    <li>Bet on <strong className="text-red-400">Red</strong>: If winning number is 2, 4, 6, 8, you win <strong>2x payout</strong>. If number is 0 (Red+Violet), you win <strong>1.5x payout</strong>.</li>
                    <li>Bet on <strong className="text-purple-400">Violet</strong>: If winning number is 0 or 5, you win <strong>4.5x payout</strong>.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">3. Size Selection (2x Payout)</h4>
                  <p className="text-zinc-400">Predict whether the outcome will be Big (5-9) or Small (0-4). Winning selections payout double your prediction amount!</p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">4. Number Prediction (9x Payout)</h4>
                  <p className="text-zinc-400">Directly predict the precise winning number (0 to 9). If your selected number appears, you receive a massive <strong>9x return</strong> on your prediction!</p>
                </div>

                <div className="space-y-1 border-t border-zinc-800/50 pt-3">
                  <h4 className="font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
                    5. Liquidity Management Rule
                  </h4>
                  <p className="text-zinc-400">To maintain robust system solvency and guarantee zero failure payouts, our automated smart routing dynamically adjusts outcomes in real-time, matching results to ensure balanced reserve distributions.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">1. ಸುತ್ತಿನ ಸಮಯ (1 ನಿಮಿಷ)</h4>
                  <p className="text-zinc-400">ಪ್ರತಿಯೊಂದು ಆಟದ ಸುತ್ತು ನಿಖರವಾಗಿ 60 ಸೆಕೆಂಡುಗಳವರೆಗೆ ಚಲಿಸುತ್ತದೆ. ಮೊದಲ 30 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ನೀವು ಪ್ರೆಡಿಕ್ಷನ್ ಮಾಡಬಹುದು. ಕೊನೆಯ 30 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ವ್ಯವಸ್ಥೆಯು ಲಾಕ್ ಆಗುತ್ತದೆ ಮತ್ತು ಗೆಲುವಿನ ಫಲಿತಾಂಶಗಳನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ.</p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">2. ಬಣ್ಣದ ಮುನ್ಸೂಚನೆ ಪಾವತಿಗಳು (Color Prediction)</h4>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400">
                    <li><strong className="text-emerald-400">ಹಸಿರು (Green)</strong> ಮೇಲೆ ಬೆಟ್: ಗೆಲುವಿನ ಸಂಖ್ಯೆ 1, 3, 7, 9 ಆಗಿದ್ದರೆ, <strong>2 ಪಟ್ಟು ಪಾವತಿ</strong>. ಸಂಖ್ಯೆ 5 ಆಗಿದ್ದರೆ <strong>1.5 ಪಟ್ಟು ಪಾವತಿ</strong> ಲಭಿಸುತ್ತದೆ.</li>
                    <li><strong className="text-red-400">ಕೆಂಪು (Red)</strong> ಮೇಲೆ ಬೆಟ್: ಗೆಲುವಿನ ಸಂಖ್ಯೆ 2, 4, 6, 8 ಆಗಿದ್ದರೆ, <strong>2 ಪಟ್ಟು ಪಾವತಿ</strong>. ಸಂಖ್ಯೆ 0 ಆಗಿದ್ದರೆ <strong>1.5 ಪಟ್ಟು ಪಾವತಿ</strong> ಲಭಿಸುತ್ತದೆ.</li>
                    <li><strong className="text-purple-400">ನೇರಳೆ (Violet)</strong> ಮೇಲೆ ಬೆಟ್: ಗೆಲುವಿನ ಸಂಖ್ಯೆ 0 ಅಥವಾ 5 ಆಗಿದ್ದರೆ, <strong>4.5 ಪಟ್ಟು ಪಾವತಿ</strong> ಸಿಗುತ್ತದೆ.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">3. ಗಾತ್ರದ ಆಯ್ಕೆ (Size Selection - 2x ಪಾವತಿ)</h4>
                  <p className="text-zinc-400">ಸಂಖ್ಯೆಯು ದೊಡ್ಡದು (Big: 5-9) ಅಥವಾ ಸಣ್ಣದು (Small: 0-4) ಎಂದು ಸರಿಯಾಗಿ ಊಹಿಸಿದರೆ, ನಿಮ್ಮ ಪ್ರೆಡಿಕ್ಷನ್ ಮೊತ್ತದ 2 ಪಟ್ಟು ಆದಾಯ ಲಭಿಸುತ್ತದೆ!</p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-black text-white uppercase tracking-wider">4. ಸಂಖ್ಯೆ ಪ್ರೆಡಿಕ್ಷನ್ (Number Prediction - 9x ಪಾವತಿ)</h4>
                  <p className="text-zinc-400">0 ರಿಂದ 9 ರವರೆಗಿನ ನಿಖರವಾದ ಗೆಲುವಿನ ಸಂಖ್ಯೆಯನ್ನು ನೇರವಾಗಿ ಊಹಿಸಿ. ನಿಮ್ಮ ಸಂಖ್ಯೆಯು ಬಂದರೆ, ನಿಮ್ಮ ಹೂಡಿಕೆಗೆ ಬರೋಬ್ಬರಿ <strong>9 ಪಟ್ಟು ರಿಟರ್ನ್</strong> ಸಿಗುತ್ತದೆ!</p>
                </div>

                <div className="space-y-1 border-t border-zinc-800/50 pt-3">
                  <h4 className="font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
                    5. ಲಿಕ್ವಿಡಿಟಿ ರಿಸರ್ವ್ ನಿಯಮ (Admin Stability Engine)
                  </h4>
                  <p className="text-zinc-400">ವ್ಯವಸ್ಥೆಯ ಸ್ಥಿರತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಲು ಮತ್ತು ಸುಗಮ ಪಾವತಿಗಳನ್ನು ಖಚಿತಪಡಿಸಲು, ಸ್ವಯಂಚಾಲಿತ ಸ್ಮಾರ್ಟ್ ಲಿಕ್ವಿಡಿಟಿ ಅಲ್ಗಾರಿದಮ್ ಮುನ್ಸೂಚನೆಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಿ ಸುರಕ್ಷಿತ ರಿಸರ್ವ್ ನಿರ್ವಹಣೆಯೊಂದಿಗೆ ನಿಯಮಗಳನ್ನು ರೂಪಿಸುತ್ತದೆ.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sliding Bet Confirmation Dialog/Drawer */}
      <AnimatePresence>
        {selectedPrediction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-end justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-t-[2.5rem] rounded-b-2xl w-full max-w-sm space-y-5 shadow-2xl"
            >
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Placing Bet For Period</span>
                  <p className="text-sm font-black text-white font-mono">#{period}</p>
                </div>
                <button 
                  onClick={() => { setSelectedPrediction(null); setMessage(null); }}
                  className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-400 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Prediction details */}
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 flex justify-between items-center">
                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Your Selection</span>
                  <span className="text-base font-black text-white capitalize">{selectedPrediction.value}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Bet Category</span>
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold uppercase">{selectedPrediction.type}</span>
                </div>
              </div>

              {/* Message/Warning notification inside form */}
              {message && (
                <div className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                  {message.text}
                </div>
              )}

              {/* Betting Form */}
              <form onSubmit={handlePlaceBet} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Investment Amount (₹)</label>
                  
                  {/* Amount shortcuts */}
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 50, 100, 500].map((amt) => (
                      <button 
                        key={amt}
                        type="button"
                        onClick={() => setBetAmount(amt)}
                        className={`py-2 text-xs font-black rounded-xl border transition-all ${betAmount === amt ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/10' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800'}`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-2">
                    <input 
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 0))}
                      placeholder="Enter custom bet amount"
                      className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl px-6 py-4 text-white font-black text-lg focus:outline-none focus:border-emerald-500 transition-all"
                      min="1"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-lg select-none">
                      ₹
                    </div>
                  </div>
                </div>

                {/* Low Balance */}
                {userData && userData.balance < betAmount && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/10 border border-red-500/25 p-4 rounded-2xl"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <h5 className="text-[10px] font-black uppercase text-red-400 tracking-wider">Insufficient Balance</h5>
                        <p className="text-[9px] text-zinc-400 font-medium">You need ₹{betAmount - userData.balance} more to place this prediction. Please recharge your wallet.</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Confirm Betting Button */}
                <button 
                  type="submit"
                  disabled={placingBet || timeLeft <= 30 || (userData ? userData.balance < betAmount : true)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {placingBet ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Place Bet (₹{betAmount})</span>
                      <Zap className="w-4 h-4 fill-current" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round Result Ended Status Popup Modal */}
      <AnimatePresence>
        {roundEndedPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] w-full max-w-xs shadow-2xl text-center space-y-6"
            >
              <div className="space-y-1">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Round Concluded</span>
                <h3 className="text-lg font-black text-white tracking-tight">Period #{roundEndedPopup.result.period}</h3>
              </div>

              {/* Winning details card */}
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Winning Results</p>
                <div className="flex justify-center items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center text-xl font-black text-white font-display shadow-lg">
                    {roundEndedPopup.result.number}
                  </div>
                  <span className={`px-3 py-1 text-[9px] font-black text-white uppercase tracking-widest rounded-full ${getOutcomeColorClass(roundEndedPopup.result.color)}`}>
                    {roundEndedPopup.result.color.replace('-', ' & ')}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${roundEndedPopup.result.size === 'Big' ? 'text-orange-400' : 'text-blue-400'}`}>
                    {roundEndedPopup.result.size}
                  </span>
                </div>
              </div>

              {/* User outcome summary */}
              <div className="space-y-2">
                {roundEndedPopup.userBets.length > 0 ? (
                  roundEndedPopup.userBets.map((bet) => {
                    const won = bet.status === 'Won';
                    return (
                      <div 
                        key={bet.id} 
                        className={`p-3 rounded-xl border text-xs flex justify-between items-center ${won ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                      >
                        <span className="font-bold capitalize">{bet.prediction} ({bet.type})</span>
                        <span className="font-black uppercase tracking-widest">
                          {won ? `Won ₹${bet.payout}` : 'Lost'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">You had no active bets in this round.</p>
                )}
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setRoundEndedPopup(null)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Continue Playing
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <WinCelebrationOverlay 
        isOpen={celebrationPrize !== null}
        onClose={() => setCelebrationPrize(null)}
        prizeAmount={celebrationPrize || 0}
        gameName="Colour Trading"
        customTitle="VICTORY!"
        customSubtext="Congratulations! You predicted correctly!"
      />

    </div>
  );
}

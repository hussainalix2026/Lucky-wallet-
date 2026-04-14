import React, { useState } from 'react';
import { UserData } from '../App';
import { 
  ChevronLeft, 
  Trophy, 
  Calendar, 
  Users, 
  Zap, 
  Clock, 
  TrendingUp, 
  Search, 
  Bell, 
  Filter,
  LayoutGrid,
  Gamepad2,
  Dices,
  Coins,
  ArrowRight,
  Star,
  Info,
  Shirt,
  Wallet,
  Gift,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CricketFantasyProps {
  userData: UserData | null;
  onBack: () => void;
}

interface Match {
  id: string;
  league: string;
  team1: { name: string; short: string; logo: string };
  team2: { name: string; short: string; logo: string };
  time: string;
  prizePool: string;
  isLive?: boolean;
}

interface Contest {
  id: string;
  prizePool: string;
  entryFee: string;
  totalSpots: number;
  filledSpots: number;
  winners: number;
  type: string;
}

interface Player {
  id: string;
  name: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL';
  team: string;
  selBy: string;
  credits: number;
  image: string;
}

interface PlayerRowProps {
  player: Player;
  isSelected: boolean;
  onToggle: () => void;
  isRight?: boolean;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ player, isSelected, onToggle, isRight = false }) => {
  return (
    <div className={`p-4 flex items-center justify-between group transition-colors ${isSelected ? 'bg-emerald-500/5' : 'hover:bg-zinc-900/50'}`}>
      {!isRight ? (
        <>
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={player.image} alt="" className="w-10 h-10 rounded-full grayscale group-hover:grayscale-0 transition-all" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                <span className="text-[6px] font-black text-zinc-500">{player.role}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-white">{player.name}</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{player.selBy}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-white">{player.credits}</span>
            <button 
              onClick={onToggle}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-700 text-emerald-500 hover:border-emerald-500'}`}
            >
              <Plus className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-45' : ''}`} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <button 
              onClick={onToggle}
              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-700 text-emerald-500 hover:border-emerald-500'}`}
            >
              <Plus className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-45' : ''}`} />
            </button>
            <span className="text-xs font-black text-white">{player.credits}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs font-black text-white">{player.name}</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{player.selBy}</span>
            </div>
            <div className="relative">
              <img src={player.image} alt="" className="w-10 h-10 rounded-full grayscale group-hover:grayscale-0 transition-all" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                <span className="text-[6px] font-black text-zinc-500">{player.role}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CricketFantasy({ userData, onBack }: CricketFantasyProps) {
  const [activeTab, setActiveTab] = useState('Recommended');
  const [bottomTab, setBottomTab] = useState('Home');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [contestTab, setContestTab] = useState('All Contests');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [playerCategory, setPlayerCategory] = useState('All Players');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const matches: Match[] = [
    {
      id: '1',
      league: 'T20 · IPL, 2026',
      team1: { name: 'Mumbai Indians', short: 'MI', logo: 'https://picsum.photos/seed/mi/100/100' },
      team2: { name: 'Kolkata Knight Riders', short: 'KKR', logo: 'https://picsum.photos/seed/kkr/100/100' },
      time: 'Tomorrow, 7:30 PM',
      prizePool: '₹9.22 Crores',
    },
    {
      id: '2',
      league: 'ODI · SA-W in NZ, 3 ODIs, 2026',
      team1: { name: 'New Zealand Women', short: 'NZ-W', logo: 'https://picsum.photos/seed/nzw/100/100' },
      team2: { name: 'South Africa Women', short: 'SA-W', logo: 'https://picsum.photos/seed/saw/100/100' },
      time: '8h : 57m',
      prizePool: '₹49.28 Lakhs',
    },
    {
      id: '3',
      league: 'T20 · PSL, 2026',
      team1: { name: 'Quetta Gladiators', short: 'QUE', logo: 'https://picsum.photos/seed/que/100/100' },
      team2: { name: 'Peshawar Zalmi', short: 'PES', logo: 'https://picsum.photos/seed/pes/100/100' },
      time: 'Tomorrow, 8:00 PM',
      prizePool: '₹1.5 Crores',
    }
  ];

  const contests: Contest[] = [
    {
      id: 'c1',
      prizePool: '₹9.22 Crores',
      entryFee: '₹49',
      totalSpots: 2500000,
      filledSpots: 1854200,
      winners: 1500000,
      type: 'Mega Contest'
    },
    {
      id: 'c2',
      prizePool: '₹50 Lakhs',
      entryFee: '₹125',
      totalSpots: 50000,
      filledSpots: 12400,
      winners: 35000,
      type: 'Hot Contest'
    },
    {
      id: 'c3',
      prizePool: '₹10 Lakhs',
      entryFee: '₹29',
      totalSpots: 45000,
      filledSpots: 42000,
      winners: 25000,
      type: 'Discounted'
    }
  ];

  const players: Player[] = [
    // MI Players
    { id: 'p1', name: 'de Kock', role: 'WK', team: 'MI', selBy: '73.93%', credits: 9, image: 'https://picsum.photos/seed/p1/100/100' },
    { id: 'p2', name: 'H Pandya', role: 'AR', team: 'MI', selBy: '91.97%', credits: 9, image: 'https://picsum.photos/seed/p2/100/100' },
    { id: 'p3', name: 'A Ankolekar', role: 'BOWL', team: 'MI', selBy: '11.97%', credits: 8.5, image: 'https://picsum.photos/seed/p3/100/100' },
    { id: 'p4', name: 'N Dhir', role: 'AR', team: 'MI', selBy: '18.93%', credits: 8.5, image: 'https://picsum.photos/seed/p4/100/100' },
    { id: 'p5', name: 'R Rickelton', role: 'WK', team: 'MI', selBy: '45.66%', credits: 8.5, image: 'https://picsum.photos/seed/p5/100/100' },
    { id: 'p6', name: 'S Yadav', role: 'BAT', team: 'MI', selBy: '72.5%', credits: 8.5, image: 'https://picsum.photos/seed/p6/100/100' },
    { id: 'p7', name: 'J Bumrah', role: 'BOWL', team: 'MI', selBy: '80.88%', credits: 8, image: 'https://picsum.photos/seed/p7/100/100' },
    { id: 'p15', name: 'Angad Bawa', role: 'AR', team: 'MI', selBy: '2.99%', credits: 8, image: 'https://picsum.photos/seed/p15/100/100' },
    { id: 'p16', name: 'C Bosch', role: 'AR', team: 'MI', selBy: '10.1%', credits: 8, image: 'https://picsum.photos/seed/p16/100/100' },
    { id: 'p17', name: 'M Rawat', role: 'AR', team: 'MI', selBy: '2.58%', credits: 8, image: 'https://picsum.photos/seed/p17/100/100' },
    { id: 'p18', name: 'M Santner', role: 'AR', team: 'MI', selBy: '19.01%', credits: 8, image: 'https://picsum.photos/seed/p18/100/100' },
    // KKR Players
    { id: 'p8', name: 'T Seifert', role: 'WK', team: 'KKR', selBy: '73.16%', credits: 9, image: 'https://picsum.photos/seed/p8/100/100' },
    { id: 'p9', name: 'A Raghuvanshi', role: 'BAT', team: 'KKR', selBy: '47.22%', credits: 8.5, image: 'https://picsum.photos/seed/p9/100/100' },
    { id: 'p10', name: 'B Muzarabani', role: 'BOWL', team: 'KKR', selBy: '14.25%', credits: 8.5, image: 'https://picsum.photos/seed/p10/100/100' },
    { id: 'p11', name: 'F Allen', role: 'BAT', team: 'KKR', selBy: '59.87%', credits: 8.5, image: 'https://picsum.photos/seed/p11/100/100' },
    { id: 'p12', name: 'H Rana', role: 'BOWL', team: 'KKR', selBy: '39.51%', credits: 8.5, image: 'https://picsum.photos/seed/p12/100/100' },
    { id: 'p13', name: 'R Powell', role: 'BAT', team: 'KKR', selBy: '23.93%', credits: 8.5, image: 'https://picsum.photos/seed/p13/100/100' },
    { id: 'p14', name: 'S Narine', role: 'AR', team: 'KKR', selBy: '81.02%', credits: 8.5, image: 'https://picsum.photos/seed/p14/100/100' },
    { id: 'p19', name: 'R Singh', role: 'BAT', team: 'KKR', selBy: '6.28%', credits: 8.5, image: 'https://picsum.photos/seed/p19/100/100' },
    { id: 'p20', name: 'A Rahane', role: 'BAT', team: 'KKR', selBy: '24.39%', credits: 8, image: 'https://picsum.photos/seed/p20/100/100' },
    { id: 'p21', name: 'C Green', role: 'AR', team: 'KKR', selBy: '24.99%', credits: 8, image: 'https://picsum.photos/seed/p21/100/100' },
  ];

  const togglePlayer = (id: string) => {
    setSelectedPlayers(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : (prev.length < 11 ? [...prev, id] : prev)
    );
  };

  if (isCreatingTeam && selectedMatch) {
    const miPlayers = players.filter(p => p.team === 'MI' && (playerCategory === 'All Players' || p.role === playerCategory));
    const kkrPlayers = players.filter(p => p.team === 'KKR' && (playerCategory === 'All Players' || p.role === playerCategory));
    const miCount = selectedPlayers.filter(id => players.find(p => p.id === id)?.team === 'MI').length;
    const kkrCount = selectedPlayers.filter(id => players.find(p => p.id === id)?.team === 'KKR').length;

    return (
      <div className="flex flex-col min-h-full bg-zinc-950 text-white font-sans">
        {/* Create Team Header */}
        <header className="bg-zinc-900 px-4 pt-4 pb-2 sticky top-0 z-50 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setIsCreatingTeam(false)} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronLeft className="w-6 h-6 text-zinc-400" />
            </button>
            <div className="flex flex-col items-center">
              <h2 className="text-sm font-black uppercase tracking-widest">Create Team</h2>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">21h 41m left</span>
            </div>
            <button className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
              <span className="text-[8px] font-black text-zinc-400">PTS</span>
            </button>
          </div>

          <div className="flex items-center justify-between px-6 mb-4">
            <div className="flex items-center gap-3">
              <img src={selectedMatch.team1.logo} alt="" className="w-8 h-8 rounded-full" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{selectedMatch.team1.short}</span>
                <span className="text-lg font-black leading-none">{miCount}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-zinc-700 font-black">-</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{selectedMatch.team2.short}</span>
                <span className="text-lg font-black leading-none">{kkrCount}</span>
              </div>
              <img src={selectedMatch.team2.logo} alt="" className="w-8 h-8 rounded-full" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-2 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{selectedPlayers.length}/11</span>
              <button className="p-1">
                <Plus className="w-3 h-3 text-zinc-600 rotate-45" />
              </button>
            </div>
            <div className="flex gap-1 h-1.5">
              {Array.from({ length: 11 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`flex-1 rounded-full transition-colors ${i < selectedPlayers.length ? 'bg-emerald-500' : 'bg-zinc-800'}`} 
                />
              ))}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 px-2 py-2 bg-zinc-800/30 rounded-xl border border-zinc-800/50 overflow-x-auto no-scrollbar">
            <button className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-700">
              <span className="text-[10px] font-black uppercase tracking-widest">Stats</span>
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            </button>
            <div className="flex items-center gap-4 whitespace-nowrap text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
              <span className="flex items-center gap-1">Pitch: <span className="text-zinc-300">Balance</span></span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span className="flex items-center gap-1">Good For: <span className="text-zinc-300">Pacer</span></span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span className="flex items-center gap-1">Avg Score: <span className="text-zinc-300">158</span></span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-32">
          {/* Category Tabs */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-900 sticky top-0 bg-zinc-950 z-40">
            {['All Players', 'WK', 'BAT', 'AR', 'BOWL'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setPlayerCategory(tab)}
                className={`text-[10px] font-black uppercase tracking-widest relative pb-2 transition-colors ${playerCategory === tab ? 'text-emerald-500' : 'text-zinc-500'}`}
              >
                {tab}
                {playerCategory === tab && <motion.div layoutId="playerCat" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
              </button>
            ))}
          </div>

          {/* Player List Grid */}
          <div className="grid grid-cols-2 divide-x divide-zinc-900">
            {/* Team 1 Column */}
            <div className="flex flex-col">
              <div className="px-4 py-3 bg-zinc-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={selectedMatch.team1.logo} alt="" className="w-4 h-4 rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{selectedMatch.team1.short}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Credits</span>
                  <ChevronRight className="w-2 h-2 text-zinc-700 rotate-90" />
                </div>
              </div>
              <div className="divide-y divide-zinc-900">
                {miPlayers.map(player => (
                  <PlayerRow key={player.id} player={player} isSelected={selectedPlayers.includes(player.id)} onToggle={() => togglePlayer(player.id)} />
                ))}
              </div>
            </div>

            {/* Team 2 Column */}
            <div className="flex flex-col">
              <div className="px-4 py-3 bg-zinc-900/30 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Credits</span>
                  <ChevronRight className="w-2 h-2 text-zinc-700 rotate-90" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{selectedMatch.team2.short}</span>
                  <img src={selectedMatch.team2.logo} alt="" className="w-4 h-4 rounded-full" />
                </div>
              </div>
              <div className="divide-y divide-zinc-900">
                {kkrPlayers.map(player => (
                  <PlayerRow key={player.id} player={player} isSelected={selectedPlayers.includes(player.id)} onToggle={() => togglePlayer(player.id)} isRight />
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 flex gap-3 z-50">
          <button 
            onClick={() => alert('Team Preview: ' + selectedPlayers.length + ' players selected')}
            className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black text-sm hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700"
          >
            <Search className="w-5 h-5" />
            Preview
          </button>
          <button 
            disabled={selectedPlayers.length < 11}
            onClick={() => {
              alert('Team Created Successfully!');
              setIsCreatingTeam(false);
              setSelectedMatch(null);
            }}
            className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${selectedPlayers.length === 11 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (selectedMatch) {
    return (
      <div className="flex flex-col min-h-full bg-zinc-950 text-white font-sans">
        {/* Match Details Header */}
        <header className="bg-zinc-900 px-4 py-4 sticky top-0 z-50 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSelectedMatch(null)} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronLeft className="w-6 h-6 text-zinc-400" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{selectedMatch.league}</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-black text-white">{selectedMatch.team1.short}</span>
                <span className="text-[10px] font-bold text-zinc-600">vs</span>
                <span className="text-sm font-black text-white">{selectedMatch.team2.short}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">{selectedMatch.time} Left</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-32">
          {/* Contest Tabs */}
          <div className="flex items-center gap-6 px-4 py-4 border-b border-zinc-900 overflow-x-auto no-scrollbar">
            {['All Contests', 'My Contests (0)', 'My Teams (0)'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setContestTab(tab)}
                className={`whitespace-nowrap pb-2 text-[10px] font-black uppercase tracking-widest relative transition-colors ${contestTab === tab ? 'text-emerald-500' : 'text-zinc-500'}`}
              >
                {tab}
                {contestTab === tab && <motion.div layoutId="contestFilter" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
              </button>
            ))}
          </div>

          {/* Contest List */}
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Mega Contests</h3>
              <Filter className="w-4 h-4 text-zinc-500" />
            </div>

            {contests.map((contest) => (
              <motion.div 
                key={contest.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Prize Pool</span>
                      <p className="text-2xl font-black text-white tracking-tight">{contest.prizePool}</p>
                    </div>
                    <button className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">
                      {contest.entryFee}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(contest.filledSpots / contest.totalSpots) * 100}%` }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-rose-500">{(contest.totalSpots - contest.filledSpots).toLocaleString()} spots left</span>
                      <span className="text-zinc-500">{contest.totalSpots.toLocaleString()} spots</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-zinc-800/30 border-t border-zinc-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{contest.winners.toLocaleString()} Winners</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shirt className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Upto 20 Teams</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Guaranteed</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </main>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 flex gap-3 z-50">
          <button 
            onClick={() => setIsCreatingTeam(true)}
            className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black text-sm hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700"
          >
            <Users className="w-5 h-5" />
            Create Team
          </button>
          <button className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 fill-current" />
            Join Contest
          </button>
        </div>
      </div>
    );
  }

  const liveMatch = {
    team1: { name: 'Royal Challengers Bengaluru', short: 'RCB', logo: 'https://picsum.photos/seed/rcb/100/100' },
    team2: { name: 'Sunrisers Hyderabad', short: 'SRH', logo: 'https://picsum.photos/seed/srh/100/100' },
    status: 'LIVE',
    info: '1 Team • 0 Contest'
  };

  return (
    <div className="flex flex-col min-h-full bg-zinc-950 text-white font-sans">
      {/* Top Header */}
      <header className="bg-zinc-900 px-4 py-3 sticky top-0 z-50 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronLeft className="w-6 h-6 text-zinc-400" />
            </button>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight leading-none">COME</span>
              <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Fantasy Sports</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-700 flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-bold">₹{userData?.balance.toLocaleString()}</span>
            </div>
            <button className="p-2 bg-zinc-800 rounded-full border border-zinc-700 relative">
              <Bell className="w-5 h-5 text-zinc-400" />
              <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-900" />
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1">
          {['Explore', 'Fantasy', 'Casino', 'Rummy'].map((tab) => (
            <button 
              key={tab}
              className={`flex flex-col items-center gap-1 min-w-fit transition-all ${tab === 'Fantasy' ? 'text-white' : 'text-zinc-500'}`}
            >
              <div className={`p-2 rounded-xl transition-colors ${tab === 'Fantasy' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800/50'}`}>
                {tab === 'Explore' && <LayoutGrid className="w-5 h-5" />}
                {tab === 'Fantasy' && <Trophy className="w-5 h-5" />}
                {tab === 'Casino' && <Dices className="w-5 h-5" />}
                {tab === 'Rummy' && <Gamepad2 className="w-5 h-5" />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{tab}</span>
              {tab === 'Fantasy' && <motion.div layoutId="topTab" className="w-1 h-1 bg-emerald-500 rounded-full mt-0.5" />}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Banner */}
        <div className="p-4">
          <div className="relative h-32 rounded-2xl overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-800 group cursor-pointer">
            <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/cricket/800/400')] bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="relative h-full p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-yellow-500 fill-current" />
                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em]">IPL 2026 Special</span>
              </div>
              <h2 className="text-xl font-black text-white leading-tight">WIN 1 CRORE FOR ₹1</h2>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">First Contest Exclusive</p>
            </div>
          </div>
        </div>

        {/* My Matches Section */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">My Matches</h3>
            <button className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                <img src={liveMatch.team1.logo} alt="" className="w-10 h-10 rounded-full border-2 border-zinc-900" />
                <img src={liveMatch.team2.logo} alt="" className="w-10 h-10 rounded-full border-2 border-zinc-900" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{liveMatch.team1.short} vs {liveMatch.team2.short}</span>
                  <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black rounded flex items-center gap-1">
                    <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{liveMatch.info}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-700" />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 mb-4 flex items-center gap-6 border-b border-zinc-900">
          {['Recommended', 'Starting Soon', 'Popular'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-[10px] font-black uppercase tracking-widest relative transition-colors ${activeTab === tab ? 'text-emerald-500' : 'text-zinc-500'}`}
            >
              {tab}
              {activeTab === tab && <motion.div layoutId="activeFilter" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
            </button>
          ))}
        </div>

        {/* Match List */}
        <div className="px-4 space-y-4">
          {matches.map((match) => (
            <motion.div 
              key={match.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedMatch(match)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group cursor-pointer hover:border-emerald-500/30 transition-all"
            >
              <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
                    <Zap className="w-3 h-3 text-zinc-500" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{match.league}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-600" />
                </div>
                <div className="p-1.5 bg-zinc-800/50 rounded-lg">
                  <Shirt className="w-4 h-4 text-zinc-500" />
                </div>
              </div>

              <div className="p-6 flex items-center justify-between">
                <div className="flex flex-col items-center gap-2 w-24">
                  <img src={match.team1.logo} alt="" className="w-12 h-12 rounded-full shadow-lg" />
                  <span className="text-xs font-black text-white">{match.team1.short}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="px-3 py-1 bg-zinc-800/50 rounded-full border border-zinc-700/50">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">VS</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${match.time.includes('h') ? 'text-red-500' : 'text-zinc-500'}`}>
                    {match.time}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 w-24">
                  <img src={match.team2.logo} alt="" className="w-12 h-12 rounded-full shadow-lg" />
                  <span className="text-xs font-black text-white">{match.team2.short}</span>
                </div>
              </div>

              <div className="px-4 py-3 bg-zinc-800/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-yellow-500/10 rounded flex items-center justify-center">
                    <Coins className="w-3 h-3 text-yellow-500" />
                  </div>
                  <span className="text-xs font-black text-white">{match.prizePool}</span>
                  <Plus className="w-3 h-3 text-zinc-600" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-zinc-600" />
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Mega</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Info className="w-3 h-3 text-zinc-600" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 px-8 py-3 flex justify-between items-center z-50">
        <NavButton 
          active={bottomTab === 'Home'} 
          onClick={() => setBottomTab('Home')} 
          icon={<Trophy className="w-6 h-6" />} 
          label="Home" 
        />
        <NavButton 
          active={bottomTab === 'My Matches'} 
          onClick={() => setBottomTab('My Matches')} 
          icon={<Calendar className="w-6 h-6" />} 
          label="My Matches" 
        />
        <NavButton 
          active={bottomTab === 'Rewards'} 
          onClick={() => setBottomTab('Rewards')} 
          icon={<Gift className="w-6 h-6" />} 
          label="Rewards" 
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-emerald-500 scale-110' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-emerald-500/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ChevronRight(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}

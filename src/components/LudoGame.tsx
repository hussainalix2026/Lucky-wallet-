import React, { useState, useEffect } from 'react';
import { UserData } from '../App';
import { ChevronLeft, Gamepad2, Trophy, Users, Zap, Sparkles, Play, Info, ChevronRight, Loader2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LudoBoard from './LudoBoard';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';

interface LudoGameProps {
  userData: UserData | null;
  onBack: () => void;
  adminGameConfig?: { id: string, mode: 'player' | 'spectator' } | null;
}

export default function LudoGame({ userData, onBack, adminGameConfig }: LudoGameProps) {
  const [activeTab, setActiveTab] = useState<'play' | 'rules' | 'history'>('play');
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<any>(null);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [userColor, setUserColor] = useState<'red' | 'blue' | 'yellow' | 'green'>('red');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [matchFound, setMatchFound] = useState<any>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [isHost, setIsHost] = useState(true);

  useEffect(() => {
    if (adminGameConfig) {
      setGameStarted(true);
      setIsHost(false); // Admin spectators or joiners are not hosts of existing games
      setSelectedMode({
        id: 'admin',
        title: adminGameConfig.mode === 'spectator' ? 'Spectating' : 'Joining Game',
        players: 4, 
        prize: 0,
        gameId: adminGameConfig.id,
        isSpectator: adminGameConfig.mode === 'spectator'
      });
      setUserColor('red');
    }
  }, [adminGameConfig]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  const findMatch = async (mode: any, isPrivate = false) => {
    if (!userData) return;
    if (userData.balance < mode.entry) {
      alert('Insufficient balance to join this game');
      return;
    }

    setIsSearching(true);
    setSelectedMode(mode);

    try {
      if (isPrivate) {
        // Create new private game
        const myColor = 'red';
        const newGameRef = await addDoc(collection(db, 'ludoGames'), {
          entry: mode.entry,
          prizePool: mode.prize,
          status: 'waiting',
          isPrivate: true,
          maxPlayers: playerCount,
          players: [{ uid: userData.uid, name: userData.fullName, color: myColor, balance: userData.balance }],
          createdAt: serverTimestamp(),
          currentPlayer: 'red',
          mode: mode.title
        });

        setCurrentRoomCode(newGameRef.id);
        setIsHost(true);

        // Watch for opponent joining
        const unsub = onSnapshot(doc(db, 'ludoGames', newGameRef.id), (docSnap) => {
          const data = docSnap.data();
          if (data && data.players.length >= playerCount) {
            unsub();
            setCurrentRoomCode(null);
            startMatchedGame(newGameRef.id, { ...mode, players: playerCount }, myColor);
          }
        });
        return;
      }

      // 1. Search for existing games waiting for players (excluding private ones)
      const q = query(
        collection(db, 'ludoGames'),
        where('status', '==', 'waiting'),
        where('entry', '==', mode.entry),
        where('maxPlayers', '==', playerCount),
        where('isPrivate', '==', false)
      );

      const querySnapshot = await getDocs(q);
      const candidates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Similar balance matchmaking
      const balanceRange = userData.balance * 0.5;
      const suitableGame = candidates.find(game => {
        const creatorBalance = game.players[0].balance || 0;
        return Math.abs(creatorBalance - userData.balance) <= balanceRange;
      });

      if (suitableGame) {
        // Join existing game
        const myColor = suitableGame.players.length === 1 ? 'blue' : suitableGame.players.length === 2 ? 'yellow' : 'green';
        const gameRef = doc(db, 'ludoGames', suitableGame.id);
        const updatedPlayers = [
          ...suitableGame.players,
          { uid: userData.uid, name: userData.fullName, color: myColor, balance: userData.balance }
        ];

        await updateDoc(gameRef, {
          players: updatedPlayers,
          status: updatedPlayers.length >= playerCount ? 'playing' : 'waiting'
        });

        setIsHost(false);
        startMatchedGame(suitableGame.id, { ...mode, players: playerCount }, myColor as any);
      } else {
        // 3. Create new public game if none found
        const myColor = 'red';
        setIsHost(true);
        const newGameRef = await addDoc(collection(db, 'ludoGames'), {
          entry: mode.entry,
          prizePool: mode.prize,
          status: 'waiting',
          isPrivate: false,
          maxPlayers: playerCount,
          players: [{ uid: userData.uid, name: userData.fullName, color: myColor, balance: userData.balance }],
          createdAt: serverTimestamp(),
          currentPlayer: 'red',
          mode: mode.title
        });

        // Watch for opponent joining
        const unsub = onSnapshot(doc(db, 'ludoGames', newGameRef.id), (docSnap) => {
          const data = docSnap.data();
          if (data && data.players.length >= playerCount) {
            unsub();
            startMatchedGame(newGameRef.id, { ...mode, players: playerCount }, myColor);
          }
        });

        // Timeout fallback: Add bots if no player joins in 10 seconds
        setTimeout(() => {
          if (isSearching) {
            unsub();
            setCurrentRoomCode(null);
            startMatchedGame(newGameRef.id, { ...mode, players: playerCount }, myColor);
          }
        }, 10000);
      }
    } catch (error) {
      console.error('Matchmaking error:', error);
      setIsSearching(false);
    }
  };

  const joinPrivateRoom = async () => {
    if (!userData || !roomCodeInput.trim()) return;
    
    try {
      const roomCode = roomCodeInput.trim();
      const docRef = doc(db, 'ludoGames', roomCode);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const gameData = docSnap.data();
        if (gameData.status === 'waiting' && gameData.players.length < gameData.maxPlayers) {
          const myColor = gameData.players.length === 1 ? 'blue' : gameData.players.length === 2 ? 'yellow' : 'green';
          const updatedPlayers = [
            ...gameData.players,
            { uid: userData.uid, name: userData.fullName, color: myColor, balance: userData.balance }
          ];

          await updateDoc(docRef, {
            players: updatedPlayers,
            status: updatedPlayers.length >= gameData.maxPlayers ? 'playing' : 'waiting'
          });

          setIsHost(false);
          startMatchedGame(roomCode, { title: gameData.mode, players: gameData.maxPlayers, prize: gameData.prizePool }, myColor as any);
        } else {
          alert('Game is full or already started');
        }
      } else {
        alert('Invalid Room Code');
      }
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  const startMatchedGame = (gameId: string, mode: any, color: 'red' | 'blue' | 'yellow' | 'green' = 'red') => {
    setIsSearching(false);
    setUserColor(color);
    setSelectedMode({ ...mode, gameId });
    setGameStarted(true);
  };

  const gameModes = [
    { id: 1, title: 'Classic 1v1', entry: 20, prize: 50000, players: 2, icon: <Users className="w-5 h-5" /> },
    { id: 2, title: 'Quick Ludo', entry: 50, prize: 100, players: 2, icon: <Zap className="w-5 h-5" /> },
    { id: 3, title: 'Mega Tournament', entry: 100, prize: 350, players: 4, icon: <Trophy className="w-5 h-5" /> },
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
        gameId={selectedMode.gameId}
        isSpectator={selectedMode.isSpectator}
        userColor={userColor as any}
        isHost={isHost}
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
        <AnimatePresence>
          {isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="relative mb-12">
                <div className="absolute inset-0 bg-red-500/20 blur-3xl animate-pulse"></div>
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <Loader2 className="w-16 h-16 text-red-500 animate-spin" />
                  <Gamepad2 className="w-8 h-8 text-white absolute" />
                </div>
              </div>

              <div className="space-y-4 max-w-xs">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {currentRoomCode ? 'Room Created!' : 'Finding Opponent...'}
                </h3>
                <p className="text-zinc-400 text-sm font-medium">
                  {currentRoomCode 
                    ? 'Share the code below with your friends to join the game.'
                    : 'Matching you with a player of similar balance for a fair game.'}
                </p>

                {currentRoomCode && (
                  <div className="p-6 bg-zinc-900 rounded-3xl border-2 border-emerald-500/20 space-y-2">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Share this Code</span>
                    <div className="text-3xl font-black text-white tracking-widest select-all">{currentRoomCode.slice(0, 6).toUpperCase()}</div>
                    <p className="text-[10px] text-zinc-500 leading-tight">Room ID: {currentRoomCode}</p>
                  </div>
                )}
                <div className="flex flex-col gap-2 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Search Time</span>
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{searchTime}s</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-red-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 15, ease: "linear", repeat: Infinity }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
                      <User className="w-6 h-6 text-red-500" />
                    </div>
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">You</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full bg-zinc-800 animate-bounce`} style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700 border-dashed">
                      <Users className="w-6 h-6 text-zinc-600" />
                    </div>
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">?</span>
                  </div>
                </div>

                <button 
                  onClick={() => setIsSearching(false)}
                  className="text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:text-zinc-400 transition-colors"
                >
                  Cancel Matchmaking
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

        {activeTab === 'play' && (
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Number of Players</h4>
            <div className="grid grid-cols-2 gap-3 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
              <button 
                onClick={() => setPlayerCount(2)}
                className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  playerCount === 2 ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">2 Players</span>
              </button>
              <button 
                onClick={() => setPlayerCount(4)}
                className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  playerCount === 4 ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <div className="flex -space-x-2">
                  <span className="flex items-center justify-center p-0.5 bg-zinc-800 rounded-full">
                    <Users className="w-4 h-4" />
                  </span>
                  <span className="flex items-center justify-center p-0.5 bg-zinc-800 rounded-full">
                    <Users className="w-4 h-4" />
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">4 Players</span>
              </button>
            </div>

            <button 
              onClick={() => findMatch(gameModes[0], true)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-zinc-800 hover:border-zinc-700 transition-all"
            >
              <Users className="w-4 h-4 text-emerald-500" />
              Create Private Room
            </button>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-4">
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Join with Room Code</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Paste Room ID here..."
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs font-medium focus:outline-none focus:border-red-500/50 transition-all"
                />
                <button 
                  onClick={joinPrivateRoom}
                  className="bg-red-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}

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
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Winner takes ₹50,000 instantly</p>
                    </div>
                    <div className="w-16 h-16 bg-zinc-800 rounded-3xl flex items-center justify-center border border-zinc-700">
                      <Gamepad2 className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
 
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Entry Fee</p>
                      <p className="text-xl font-black text-white">₹20</p>
                    </div>
                    <div className="flex-1 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Prize Pool</p>
                      <p className="text-xl font-black text-emerald-500">₹50,000</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => findMatch(gameModes[0])}
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
                      onClick={() => findMatch(mode)}
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

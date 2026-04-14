import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, User, Bot, Sparkles, ChevronLeft } from 'lucide-react';
import Dice3D from './Dice3D';

interface LudoBoardProps {
  onGameOver: (winner: string) => void;
  onQuit: () => void;
  playersCount?: number;
  prize?: number;
}

type PlayerColor = 'red' | 'blue' | 'yellow' | 'green';

interface Piece {
  id: number;
  color: PlayerColor;
  position: number; // -1: home, 0-51: path, 52-57: home stretch, 58: finished
}

// Path coordinates (row, col) for the 52-step common path
// This is a simplified version of the Ludo path
const COMMON_PATH = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0]
];

// Home stretch coordinates for each color
const HOME_STRETCHES: Record<PlayerColor, number[][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  blue: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  green: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

// Starting index in COMMON_PATH for each color
const START_INDEX: Record<PlayerColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  green: 39,
};

export default function LudoBoard({ onGameOver, onQuit, playersCount = 4, prize = 100000 }: LudoBoardProps) {
  const [diceValue, setDiceValue] = useState<number>(1);
  const [isRolling, setIsRolling] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerColor>('red');
  const [pieces, setPieces] = useState<Piece[]>(() => {
    const initialPieces: Piece[] = [];
    const colors: PlayerColor[] = playersCount === 2 ? ['red', 'yellow'] : ['red', 'blue', 'yellow', 'green'];
    colors.forEach((color, colorIdx) => {
      for (let i = 1; i <= 4; i++) {
        initialPieces.push({ id: (playersCount === 2 && color === 'yellow' ? 2 : colorIdx) * 4 + i, color, position: -1 });
      }
    });
    return initialPieces;
  });
  const [message, setMessage] = useState('Your Turn (Red)');
  const [canRoll, setCanRoll] = useState(true);
  const [movablePieces, setMovablePieces] = useState<number[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [showEffect, setShowEffect] = useState<{ type: 'capture' | 'finish', x: number, y: number } | null>(null);

  const switchTurn = useCallback(() => {
    setCurrentPlayer(prev => {
      const order: PlayerColor[] = playersCount === 2 ? ['red', 'yellow'] : ['red', 'blue', 'yellow', 'green'];
      const nextIdx = (order.indexOf(prev) + 1) % order.length;
      const next = order[nextIdx];
      setMessage(next === 'red' ? "Your Turn (Red)" : `${next.toUpperCase()}'s Turn`);
      setCanRoll(true);
      return next;
    });
  }, [playersCount]);

  const movePiece = useCallback(async (id: number, val: number) => {
    if (winner || isRolling) return;
    setMovablePieces([]);
    setCanRoll(false);

    const pieceToMove = pieces.find(p => p.id === id);
    if (!pieceToMove) return;

    const startPos = pieceToMove.position;
    const targetPos = pieceToMove.position === -1 ? 0 : pieceToMove.position + val;

    // Animate movement step by step
    for (let i = (startPos === -1 ? 0 : startPos + 1); i <= targetPos; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setPieces(prev => prev.map(p => p.id === id ? { ...p, position: i } : p));
    }

    // After animation, check for captures, finishes, and bonus turns
    setPieces(finalPieces => {
      const p = finalPieces.find(p => p.id === id)!;
      const finalPos = p.position;
      let bonusTurn = false;
      let nextPieces = [...finalPieces];

      if (finalPos < 52) {
        const [finalR, finalC] = getPieceCoords(p);
        const isSafeSpot = (finalR === 6 && finalC === 1) || (finalR === 1 && finalC === 8) || 
                           (finalR === 8 && finalC === 13) || (finalR === 13 && finalC === 6) ||
                           (finalR === 2 && finalC === 6) || (finalR === 6 && finalC === 12) || 
                           (finalR === 12 && finalC === 8) || (finalR === 8 && finalC === 2);

        if (!isSafeSpot) {
          const capturedPiece = finalPieces.find(op => 
            op.color !== p.color && op.position !== -1 && op.position < 52 &&
            getPieceCoords(op)[0] === finalR && getPieceCoords(op)[1] === finalC
          );

          if (capturedPiece) {
            setShowEffect({ type: 'capture', x: finalC, y: finalR });
            setTimeout(() => setShowEffect(null), 1000);
            setMessage(`Captured ${capturedPiece.color.toUpperCase()}!`);
            bonusTurn = true;
            
            nextPieces = nextPieces.map(item => 
              item.id === capturedPiece.id ? { ...item, position: -1 } : item
            );
          }
        }
      }

      if (finalPos === 58) {
        const [finalR, finalC] = getPieceCoords(p);
        setShowEffect({ type: 'finish', x: finalC, y: finalR });
        setTimeout(() => setShowEffect(null), 1000);
        setMessage(`${p.color.toUpperCase()} piece finished!`);
        bonusTurn = true;

        const playerPieces = nextPieces.filter(item => item.color === p.color);
        if (playerPieces.every(item => item.position === 58)) {
          setWinner(p.color === 'red' ? 'You' : 'Bot');
          onGameOver(p.color === 'red' ? 'You' : 'Bot');
          return nextPieces;
        }
      }

      if (val === 6) bonusTurn = true;

      if (bonusTurn) {
        setCanRoll(true);
        setMessage(p.color === 'red' ? "Roll again!" : "Bot rolls again!");
      } else {
        switchTurn();
      }

      return nextPieces;
    });
  }, [winner, isRolling, switchTurn, onGameOver, pieces]);

  const getBotBestMove = useCallback((movableIds: number[], val: number, color: PlayerColor) => {
    const scores = movableIds.map(id => {
      const piece = pieces.find(p => p.id === id)!;
      let score = 0;
      const targetPos = piece.position === -1 ? 0 : piece.position + val;

      if (targetPos === 58) score += 1000;

      if (targetPos < 52) {
        const [tr, tc] = getPieceCoords({ ...piece, position: targetPos });
        const isSafe = (tr === 6 && tc === 1) || (tr === 1 && tc === 8) || 
                       (tr === 8 && tc === 13) || (tr === 13 && tc === 6);
        
        if (!isSafe) {
          const opponentPieces = pieces.filter(p => p.color !== color && p.position !== -1 && p.position < 52);
          const canCapture = opponentPieces.some(p => {
            const [or, oc] = getPieceCoords(p);
            return or === tr && oc === tc;
          });
          if (canCapture) score += 800;
        } else {
          score += 200;
        }
      }

      if (piece.position === -1 && val === 6) score += 500;
      score += targetPos * 2;

      return { id, score };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores[0].id;
  }, [pieces]);

  const checkMovablePieces = useCallback((val: number) => {
    setPieces(currentPieces => {
      const playerPieces = currentPieces.filter(p => p.color === currentPlayer);
      const movable = playerPieces.filter(p => {
        if (p.position === 58) return false;
        if (p.position === -1 && val === 6) return true;
        if (p.position !== -1 && p.position + val <= 58) return true;
        return false;
      }).map(p => p.id);

      if (movable.length === 0) {
        setMessage("No moves possible!");
        setTimeout(switchTurn, 1000);
      } else {
        setMovablePieces(movable);
        setMessage(currentPlayer === 'red' ? "Select a piece to move" : `${currentPlayer.toUpperCase()} is thinking...`);
        
        if (currentPlayer !== 'red') {
          const bestMoveId = getBotBestMove(movable, val, currentPlayer);
          setTimeout(() => movePiece(bestMoveId, val), 1000);
        }
      }
      return currentPieces;
    });
  }, [currentPlayer, switchTurn, getBotBestMove, movePiece]);

  const rollDice = useCallback(() => {
    if (!canRoll || isRolling || winner) return;
    setIsRolling(true);
    setCanRoll(false);
    
    // Simulate roll animation
    setTimeout(() => {
      const finalValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(finalValue);
      setIsRolling(false);
      checkMovablePieces(finalValue);
    }, 1000);
  }, [canRoll, isRolling, winner, checkMovablePieces]);

  // Bot Auto-Roll
  useEffect(() => {
    if (currentPlayer !== 'red' && canRoll && !isRolling && !winner) {
      const timer = setTimeout(rollDice, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, canRoll, isRolling, winner, rollDice]);

  const getPieceCoords = (piece: Piece) => {
    if (piece.position === -1) {
      // Home positions
      const baseRow = piece.color === 'red' ? 2 : piece.color === 'blue' ? 2 : piece.color === 'yellow' ? 11 : 11;
      const baseCol = piece.color === 'red' ? 2 : piece.color === 'blue' ? 11 : piece.color === 'yellow' ? 11 : 2;
      const offset = (piece.id - 1) % 4;
      return [baseRow + (offset < 2 ? 0 : 1), baseCol + (offset % 2 === 0 ? 0 : 1)];
    }
    
    if (piece.position >= 52) {
      return HOME_STRETCHES[piece.color][piece.position - 52];
    }

    const globalIndex = (START_INDEX[piece.color] + piece.position) % 52;
    return COMMON_PATH[globalIndex];
  };

  const getPieceOffset = (piece: Piece) => {
    const sameSquarePieces = pieces.filter(p => {
      if (p.id === piece.id) return false;
      const [r1, c1] = getPieceCoords(piece);
      const [r2, c2] = getPieceCoords(p);
      return r1 === r2 && c1 === c2;
    });

    // Actually, let's just find all pieces on this square and determine our index among them
    const [r, c] = getPieceCoords(piece);
    const piecesOnSquare = pieces.filter(p => {
      const [pr, pc] = getPieceCoords(p);
      return pr === r && pc === c;
    });

    if (piecesOnSquare.length <= 1) return { x: 0, y: 0 };

    const index = piecesOnSquare.findIndex(p => p.id === piece.id);
    const total = piecesOnSquare.length;
    
    // Simple grid offset for stacked pieces
    const offsetSize = 1.5;
    if (total === 2) {
      return { x: index === 0 ? -offsetSize : offsetSize, y: 0 };
    }
    if (total === 3) {
      if (index === 0) return { x: 0, y: -offsetSize };
      if (index === 1) return { x: -offsetSize, y: offsetSize };
      return { x: offsetSize, y: offsetSize };
    }
    // 4 or more
    const row = Math.floor(index / 2);
    const col = index % 2;
    return { x: col === 0 ? -offsetSize : offsetSize, y: row === 0 ? -offsetSize : offsetSize };
  };

  const renderCell = (row: number, col: number) => {
    // Home Areas (The big squares)
    const homeBaseStyle = "border-4 border-black/10 rounded-lg relative shadow-inner overflow-hidden";
    
    if (row < 6 && col < 6) return (
      <div className={`bg-red-500 ${homeBaseStyle}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-30"></div>
        <div className="absolute inset-4 bg-white/80 rounded-xl shadow-inner flex items-center justify-center">
          <div className="w-full h-full border-4 border-red-500/20 rounded-lg"></div>
        </div>
      </div>
    );
    if (row < 6 && col > 8) return (
      <div className={`bg-blue-500 ${homeBaseStyle}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-30"></div>
        <div className="absolute inset-4 bg-white/80 rounded-xl shadow-inner flex items-center justify-center">
          <div className="w-full h-full border-4 border-blue-500/20 rounded-lg"></div>
        </div>
      </div>
    );
    if (row > 8 && col < 6) return (
      <div className={`bg-green-500 ${homeBaseStyle}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-30"></div>
        <div className="absolute inset-4 bg-white/80 rounded-xl shadow-inner flex items-center justify-center">
          <div className="w-full h-full border-4 border-green-500/20 rounded-lg"></div>
        </div>
      </div>
    );
    if (row > 8 && col > 8) return (
      <div className={`bg-yellow-500 ${homeBaseStyle}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-30"></div>
        <div className="absolute inset-4 bg-white/80 rounded-xl shadow-inner flex items-center justify-center">
          <div className="w-full h-full border-4 border-yellow-500/20 rounded-lg"></div>
        </div>
      </div>
    );

    // Center (Home)
    if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
      if (row === 7 && col === 7) return (
        <div className="bg-[#f0e6d2] flex items-center justify-center border border-black/10 shadow-[inset_0_4px_12px_rgba(0,0,0,0.2)]">
          <Trophy className="w-8 h-8 text-yellow-500 animate-bounce drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]" />
        </div>
      );
      
      // Triangles pointing to center with realistic depth
      if (row === 6 && col === 7) return <div className="bg-blue-500 shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />;
      if (row === 8 && col === 7) return <div className="bg-green-500 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)]" style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }} />;
      if (row === 7 && col === 6) return <div className="bg-red-500 shadow-[inset_4px_0_8px_rgba(0,0,0,0.3)]" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />;
      if (row === 7 && col === 8) return <div className="bg-yellow-500 shadow-[inset_-4px_0_8px_rgba(0,0,0,0.3)]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 50%)' }} />;
      
      return <div className="bg-[#f0e6d2] shadow-inner" />;
    }

    // Path
    let colorClass = "bg-[#f0e6d2]";
    let content = null;

    // Home Stretches
    if (row === 7 && col > 0 && col < 7) colorClass = "bg-red-500";
    if (row === 7 && col > 7 && col < 14) colorClass = "bg-yellow-500";
    if (col === 7 && row > 0 && row < 7) colorClass = "bg-blue-500";
    if (col === 7 && row > 7 && row < 14) colorClass = "bg-green-500";

    // Starting squares
    if (row === 6 && col === 1) { colorClass = "bg-red-500"; content = <Play className="w-3 h-3 text-white rotate-0" />; }
    if (row === 1 && col === 8) { colorClass = "bg-blue-500"; content = <Play className="w-3 h-3 text-white rotate-90" />; }
    if (row === 8 && col === 13) { colorClass = "bg-yellow-500"; content = <Play className="w-3 h-3 text-white rotate-180" />; }
    if (row === 13 && col === 6) { colorClass = "bg-green-500"; content = <Play className="w-3 h-3 text-white rotate-270" />; }

    // Other safe spots
    if ((row === 2 && col === 6) || (row === 6 && col === 12) || (row === 12 && col === 8) || (row === 8 && col === 2)) {
      colorClass = "bg-gray-300";
      content = <Sparkles className="w-2 h-2 text-gray-600" />;
    }

    return (
      <div className={`${colorClass} border border-black/15 rounded-sm flex items-center justify-center relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]`}>
        {content}
        {/* Subtle printed board texture */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] opacity-15 pointer-events-none"></div>
        {/* Inner glow for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-white/5 pointer-events-none"></div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center min-h-full bg-[#3d2b1f] p-4 gap-6 relative overflow-hidden">
      {/* Wooden Table Texture */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-40 pointer-events-none"></div>
      
      {/* Header */}
      <div className="w-full max-w-[450px] flex justify-between items-center bg-[#2a1d15] p-4 rounded-2xl border border-white/10 shadow-2xl z-10">
        <button onClick={onQuit} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/60">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Ludo Classic</h2>
          <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Realistic Board</p>
        </div>
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
          <Trophy className="w-5 h-5 text-yellow-500" />
        </div>
      </div>

      {/* Message Banner */}
      <motion.div 
        key={message}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full z-10"
      >
        <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{message}</p>
      </motion.div>

      {/* The Board Container with 3D perspective */}
      <div className="relative perspective-1000 z-10">
        {/* Board Frame */}
        <div 
          className="relative aspect-square w-full max-w-[450px] bg-[#f0e6d2] rounded-2xl border-[20px] border-[#2a1d15] p-1 grid grid-cols-15 grid-rows-15 gap-0.5 overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.9),inset_0_0_30px_rgba(0,0,0,0.3)]"
          style={{ 
            transform: 'rotateX(15deg)', 
            transformStyle: 'preserve-3d',
            backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")',
          }}
        >
          {/* Board Surface Texture */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 pointer-events-none z-10"></div>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20 z-10"></div>
          <div className="absolute top-0 left-0 w-[1px] h-full bg-white/20 z-10"></div>
          
          {Array.from({ length: 15 * 15 }).map((_, i) => {
            const row = Math.floor(i / 15);
            const col = i % 15;
            return <React.Fragment key={i}>{renderCell(row, col)}</React.Fragment>;
          })}

          {/* Pieces */}
          {pieces.map(p => {
            const [r, c] = getPieceCoords(p);
            const isMovable = movablePieces.includes(p.id) && currentPlayer === 'red';
            const offset = getPieceOffset(p);
            
            const colorGradients = {
              red: 'from-red-400 via-red-600 to-red-800',
              blue: 'from-blue-400 via-blue-600 to-blue-800',
              yellow: 'from-yellow-300 via-yellow-500 to-yellow-700',
              green: 'from-green-400 via-green-600 to-green-800'
            };

            return (
              <motion.button
                key={p.id}
                layout
                disabled={!isMovable}
                onClick={() => isMovable && movePiece(p.id, diceValue)}
                animate={isMovable ? { 
                  y: [0, -15, 0],
                  scale: [1, 1.2, 1],
                  rotateZ: [0, 10, -10, 0]
                } : {}}
                transition={isMovable ? { repeat: Infinity, duration: 1.2 } : { type: "spring", stiffness: 300, damping: 20 }}
                className={`absolute w-[6%] h-[6%] z-20 transition-all ${
                  isMovable ? 'cursor-pointer z-30' : ''
                }`}
                style={{ 
                  top: `${(r / 15) * 100}%`, 
                  left: `${(c / 15) * 100}%`,
                  transform: `translate(calc(5% + ${offset.x}px), calc(5% + ${offset.y}px))`,
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* Realistic 3D Pawn (Goti) */}
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  {/* Shadow */}
                  <div className="absolute bottom-[-15%] w-[100%] h-[30%] bg-black/50 blur-md rounded-full" />
                  
                  {/* Pawn Body */}
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    {/* Base */}
                    <div className={`absolute bottom-0 w-[95%] h-[40%] rounded-full bg-gradient-to-b ${colorGradients[p.color]} shadow-[inset_0_-3px_6px_rgba(0,0,0,0.5)] border-b-2 border-black/30`} />
                    
                    {/* Neck */}
                    <div className={`absolute bottom-[30%] w-[45%] h-[30%] bg-gradient-to-r ${colorGradients[p.color]} border-x border-black/20`} />
                    
                    {/* Head */}
                    <div className={`absolute top-0 w-[80%] h-[65%] rounded-full bg-gradient-to-br ${colorGradients[p.color]} shadow-[0_6px_12px_rgba(0,0,0,0.5)] border border-white/30 overflow-hidden`}>
                      {/* Glossy Shine */}
                      <div className="absolute top-[10%] left-[20%] w-[45%] h-[45%] bg-white/50 rounded-full blur-[1px]" />
                      <div className="absolute bottom-[10%] right-[10%] w-[25%] h-[25%] bg-black/20 rounded-full blur-[1px]" />
                    </div>
                  </div>

                  {/* Movable Glow */}
                  {isMovable && (
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-[-30%] rounded-full bg-white/40 blur-xl z-[-1]"
                    />
                  )}
                </div>
              </motion.button>
            );
          })}

        {/* Effects */}
        <AnimatePresence>
          {showEffect && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute z-50 pointer-events-none flex items-center justify-center"
              style={{
                top: `${(showEffect.y / 15) * 100}%`,
                left: `${(showEffect.x / 15) * 100}%`,
                width: '6.66%',
                height: '6.66%'
              }}
            >
              <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter shadow-xl ${
                showEffect.type === 'capture' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {showEffect.type === 'capture' ? 'Captured!' : 'Finished!'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Home Bases Decorations */}
        <div className="absolute top-[10%] left-[10%] w-[20%] h-[20%] border-4 border-red-500/20 rounded-full pointer-events-none"></div>
        <div className="absolute top-[10%] right-[10%] w-[20%] h-[20%] border-4 border-blue-500/20 rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[10%] left-[10%] w-[20%] h-[20%] border-4 border-green-500/20 rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[20%] h-[20%] border-4 border-yellow-500/20 rounded-full pointer-events-none"></div>
      </div>
    </div>

    {/* Controls Area */}
    <div className="w-full max-w-[450px] bg-[#2a1d15] rounded-[2.5rem] border border-white/10 p-6 flex items-center justify-between shadow-2xl relative overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-blue-500/5 pointer-events-none"></div>
        
        {/* Player 1 */}
        <div className={`flex flex-col items-center gap-2 transition-all ${currentPlayer === 'red' ? 'scale-110 opacity-100' : 'opacity-40'}`}>
          <div className="w-14 h-14 rounded-2xl bg-red-500 border-2 border-white/20 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
            <User className="w-8 h-8" />
          </div>
          <p className="text-[10px] font-black text-white uppercase tracking-widest">You</p>
        </div>

        {/* Dice */}
        <div className="flex flex-col items-center gap-3">
          <Dice3D 
            value={diceValue} 
            isRolling={isRolling} 
            onClick={rollDice}
            disabled={!canRoll || currentPlayer !== 'red' || isRolling || !!winner}
          />
          <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em] mt-2">
            {isRolling ? 'Rolling...' : canRoll && currentPlayer === 'red' ? 'Your Turn' : 'Wait...'}
          </p>
        </div>

        {/* Next Player Indicator */}
        <div className={`flex flex-col items-center gap-2 transition-all ${currentPlayer !== 'red' ? 'scale-110 opacity-100' : 'opacity-40'}`}>
          <div className={`w-14 h-14 rounded-2xl border-2 border-white/20 flex items-center justify-center text-white shadow-lg ${
            currentPlayer === 'blue' ? 'bg-blue-500' : currentPlayer === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
          }`}>
            <Bot className="w-8 h-8" />
          </div>
          <p className="text-[10px] font-black text-white uppercase tracking-widest">{currentPlayer === 'red' ? 'Opponent' : currentPlayer.toUpperCase()}</p>
        </div>
      </div>

      {/* Winner Modal */}
      <AnimatePresence>
        {winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] text-center space-y-6 max-w-sm w-full shadow-2xl"
            >
              <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-yellow-500/50 animate-pulse">
                <Trophy className="w-12 h-12 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">{winner} Won!</h2>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-2">
                  {winner === 'You' ? `Congratulations! ₹${prize.toLocaleString()} added to wallet.` : 'Better luck next time!'}
                </p>
              </div>
              <button 
                onClick={onQuit}
                className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-100 transition-all"
              >
                Back to Lobby
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

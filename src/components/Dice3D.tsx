import React from 'react';
import { motion } from 'motion/react';

interface Dice3DProps {
  value: number;
  isRolling: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const Dice3D: React.FC<Dice3DProps> = ({ value, isRolling, onClick, disabled }) => {
  // Rotation map for each face
  const rotations: Record<number, string> = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateX(0deg) rotateY(-90deg)',
    4: 'rotateX(0deg) rotateY(90deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(180deg) rotateY(0deg)',
  };

  // More chaotic and realistic rolling animation
  const rollRotation = {
    rotateX: [0, 360, 720, 1080, 1440],
    rotateY: [0, 720, 1440, 2160, 2880],
    rotateZ: [0, 180, 360, 540, 720],
    y: [0, -80, 0, -40, 0],
    scale: [1, 1.1, 0.9, 1.05, 1],
  };

  return (
    <div 
      className={`relative w-24 h-24 perspective-1200 ${disabled ? 'opacity-50' : 'cursor-pointer group'}`}
      onClick={!disabled && !isRolling ? onClick : undefined}
    >
      {/* Glow effect when active */}
      {!disabled && !isRolling && (
        <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse group-hover:bg-emerald-500/30 transition-all" />
      )}

      <motion.div
        animate={isRolling ? rollRotation : {
          transform: rotations[value] || rotations[1],
        }}
        transition={isRolling ? {
          duration: 0.6,
          repeat: Infinity,
          ease: "linear",
        } : {
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
        style={{ transformStyle: 'preserve-3d' }}
        className="w-full h-full relative"
      >
        {/* Faces */}
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <div
            key={face}
            className="absolute inset-0 bg-white border border-zinc-200 rounded-xl flex items-center justify-center overflow-hidden"
            style={{
              transform: getFaceTransform(face),
              backfaceVisibility: 'hidden',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05), 0 0 2px rgba(0,0,0,0.1)',
              background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f4f4f5 100%)',
            }}
          >
            {/* Reflection/Sheen layer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            
            {/* Subtle highlight */}
            <div className="absolute top-1 left-1 right-1 h-1/2 bg-gradient-to-b from-white/80 to-transparent rounded-t-lg pointer-events-none" />

            <div className="grid grid-cols-3 grid-rows-3 gap-1.5 p-3 w-full h-full relative z-10">
              {getDots(face).map((dot, i) => (
                <div key={i} className={`flex items-center justify-center ${dot ? '' : 'invisible'}`}>
                  <div className="w-3.5 h-3.5 bg-zinc-900 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] relative">
                    {/* Pip highlight */}
                    <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white/20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </motion.div>
      
      {/* Dynamic Shadow */}
      <motion.div 
        animate={isRolling ? {
          scale: [1, 0.5, 1, 0.7, 1],
          opacity: [0.4, 0.1, 0.4, 0.2, 0.4],
          filter: ['blur(8px)', 'blur(16px)', 'blur(8px)', 'blur(12px)', 'blur(8px)'],
        } : { 
          scale: 1, 
          opacity: 0.3,
          filter: 'blur(8px)'
        }}
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-3 bg-black/40 rounded-full"
      />
    </div>
  );
};

function getFaceTransform(face: number): string {
  // w-24 is 96px, so half is 48px
  const offset = '48px';
  switch (face) {
    case 1: return `translateZ(${offset})`;
    case 2: return `rotateX(90deg) translateZ(${offset})`;
    case 3: return `rotateY(90deg) translateZ(${offset})`;
    case 4: return `rotateY(-90deg) translateZ(${offset})`;
    case 5: return `rotateX(-90deg) translateZ(${offset})`;
    case 6: return `rotateX(180deg) translateZ(${offset})`;
    default: return '';
  }
}

function getDots(face: number): boolean[] {
  const dots = Array(9).fill(false);
  switch (face) {
    case 1:
      dots[4] = true;
      break;
    case 2:
      dots[0] = true;
      dots[8] = true;
      break;
    case 3:
      dots[0] = true;
      dots[4] = true;
      dots[8] = true;
      break;
    case 4:
      dots[0] = true;
      dots[2] = true;
      dots[6] = true;
      dots[8] = true;
      break;
    case 5:
      dots[0] = true;
      dots[2] = true;
      dots[4] = true;
      dots[6] = true;
      dots[8] = true;
      break;
    case 6:
      dots[0] = true;
      dots[2] = true;
      dots[3] = true;
      dots[5] = true;
      dots[6] = true;
      dots[8] = true;
      break;
  }
  return dots;
}

export default Dice3D;

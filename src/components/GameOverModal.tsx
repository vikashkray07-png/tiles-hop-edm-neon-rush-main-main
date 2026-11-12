import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Home, ArrowRight, Target, Clapperboard, WifiOff } from 'lucide-react';
import { GameStats, LevelConfig } from '../types/game';

interface GameOverModalProps {
  stats: GameStats;
  currentLevel: LevelConfig;
  isVictory: boolean;
  isOnline?: boolean;
  onPlayAgain: () => void;
  onWatchAdContinue?: () => void;
  onNextLevel?: () => void;
  onGoHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  currentLevel,
  isVictory,
  isOnline = true,
  onPlayAgain,
  onWatchAdContinue,
  onNextLevel,
  onGoHome,
}) => {
  useEffect(() => {
    if (isVictory) {
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00f5ff', '#ff007f', '#ffd700', '#39ff14'],
        });
      } catch {
        // Safe fallback
      }
    }
  }, [isVictory]);

  return (
    <div className="absolute inset-0 bg-black/85 z-30 flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-md bg-gradient-to-b from-[#1b0933] to-[#0d021c] border border-pink-500/30 rounded-3xl p-6 md:p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,0,128,0.3)] animate-in fade-in zoom-in-95 duration-200">
        {/* Header Icon / Celestial Planet Destination Title */}
        {isVictory ? (
          <div className="mb-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_25px_rgba(255,200,0,0.6)] mb-3 mx-auto animate-bounce text-3xl">
              {currentLevel.planetEmoji}
            </div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 uppercase tracking-wider">
              {currentLevel.planetTarget.toUpperCase()} LEVEL COMPLETE
            </h2>
            <p className="text-xs text-white/70 mt-0.5">
              Completed {currentLevel.name}
            </p>
          </div>
        ) : (
          <div className="mb-2">
            <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-3 mx-auto">
              <Target className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-400 uppercase tracking-widest">
              GAME OVER
            </h2>
            <p className="text-xs text-white/60 mt-0.5">
              {currentLevel.name} · Target not reached
            </p>
          </div>
        )}

        {/* Real Gameplay Score Readout */}
        <div className="my-2">
          <div className="text-[11px] uppercase tracking-widest text-white/50 font-semibold">
            SCORE EARNED
          </div>
          <div className="text-5xl font-black text-white tracking-tight drop-shadow-[0_0_20px_rgba(0,240,255,0.6)] tabular-nums">
            {stats.score.toLocaleString()}
          </div>
        </div>

        {/* Breakdown Stats Grid (Pads, Coins, Gems - Streak completely removed as requested) */}
        <div className="w-full grid grid-cols-3 gap-2 my-3 bg-black/40 border border-white/5 rounded-2xl p-2.5">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-white/50 uppercase font-semibold">Pads</span>
            <span className="text-sm font-bold text-cyan-300 tabular-nums">
              {stats.targetPadsCleared}/{stats.totalTargetPads}
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-white/10">
            <span className="text-[10px] text-white/50 uppercase font-semibold">Coins</span>
            <span className="text-sm font-bold text-yellow-400 tabular-nums">
              +{stats.coinsEarnedInLevel}
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-white/10">
            <span className="text-[10px] text-white/50 uppercase font-semibold">Gems</span>
            <span className="text-sm font-bold text-cyan-300 flex items-center gap-0.5 tabular-nums">
              ◆ {Math.min(stats.totalGemsInLevel, stats.gemsCollectedInLevel)}/{stats.totalGemsInLevel}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5 mt-3">
          {isVictory && onNextLevel ? (
            <button
              onClick={onNextLevel}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 via-cyan-500 to-blue-500 hover:from-green-400 hover:via-cyan-400 hover:to-blue-400 text-white font-extrabold text-base tracking-wider shadow-[0_0_25px_rgba(0,240,255,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>NEXT TARGET</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : null}

          <button
            onClick={onPlayAgain}
            className={`w-full py-3.5 rounded-2xl text-white font-extrabold text-base tracking-wider transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
              isVictory
                ? 'bg-white/10 hover:bg-white/20 border border-white/15'
                : 'bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 hover:from-pink-400 hover:via-purple-500 hover:to-cyan-400 shadow-[0_0_25px_rgba(255,42,122,0.5)]'
            }`}
          >
            <RotateCcw className="w-5 h-5" />
            <span>{isVictory ? 'REPLAY THIS LEVEL' : 'RETRY LEVEL'}</span>
          </button>

          {/* Watch Ad To Continue / Revive Option */}
          {!isVictory && onWatchAdContinue && (
            isOnline ? (
              <button
                onClick={onWatchAdContinue}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black text-sm tracking-wider shadow-[0_0_25px_rgba(251,191,36,0.45)] transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Clapperboard className="w-5 h-5 text-black" />
                <span>WATCH AD TO CONTINUE</span>
              </button>
            ) : (
              <div className="w-full py-3 px-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed">
                <WifiOff className="w-4 h-4 text-white/30" />
                <span>NO INTERNET CONNECTION</span>
              </div>
            )
          )}

          <button
            onClick={onGoHome}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>HOME / LEVEL SELECT</span>
          </button>
        </div>
      </div>
    </div>
  );
};

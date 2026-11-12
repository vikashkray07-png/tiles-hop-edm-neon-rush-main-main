import React, { useState, useEffect } from 'react';
import { Play, Volume2, VolumeX, ChevronRight, Palette, Layers, Lock, CheckCircle2, Trophy, Coins } from 'lucide-react';
import { LEVELS } from '../data/levels';
import { LevelConfig, BallSkin, UserProfile, DailyChallengeStatus } from '../types/game';
import { soundEngine } from '../audio/SoundEngine';

interface TitleScreenProps {
  currentLevel: LevelConfig;
  maxUnlockedLevel: number;
  userProfile: UserProfile | null;
  onSelectLevel: (level: LevelConfig) => void;
  onStartGame: () => void;
  onOpenShop: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
  onOpenDailyChallenge?: () => void;
  dailyStatus?: DailyChallengeStatus | null;
  currentSkin: BallSkin;
  totalGems: number;
  totalCoins: number;
  isDailyChallenge?: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  currentLevel,
  maxUnlockedLevel,
  userProfile,
  onSelectLevel,
  onStartGame,
  onOpenShop,
  onOpenLeaderboard,
  onOpenProfile,
  onOpenDailyChallenge,
  dailyStatus,
  currentSkin,
  totalGems,
  totalCoins,
  isDailyChallenge = false,
}) => {
  const [isMuted, setIsMuted] = useState(soundEngine.getMuted());
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  useEffect(() => {
    soundEngine.init();
    soundEngine.startHomeAmbientMusic();

    const resumeOnInteraction = () => {
      soundEngine.init();
      if (!soundEngine.getMuted()) {
        soundEngine.startHomeAmbientMusic();
      }
    };

    window.addEventListener('pointerdown', resumeOnInteraction, { once: true });
    window.addEventListener('keydown', resumeOnInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
      soundEngine.stopBackgroundMusic();
    };
  }, []);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      soundEngine.startHomeAmbientMusic();
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between items-center p-3 sm:p-6 md:p-8 select-none overflow-hidden font-sans">
      {/* Top Bar: User Profile, Leaderboard, Coins, Gems, Shop & Sound */}
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-1.5 px-1 pt-1">
        <div className="flex items-center gap-1.5">
          {/* User Profile Pill */}
          <button
            onClick={onOpenProfile}
            className="px-2.5 py-1 rounded-full bg-black/60 border border-cyan-400/40 hover:border-cyan-400 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.2)] active:scale-95"
          >
            <span className="text-sm">{userProfile?.flag || '🌍'}</span>
            <span className="truncate max-w-[80px] sm:max-w-[120px]">{userProfile?.name || 'Player'}</span>
          </button>

          {/* Leaderboard Button */}
          <button
            onClick={onOpenLeaderboard}
            className="px-2.5 py-1 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/50 text-yellow-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_12px_rgba(255,200,0,0.2)] active:scale-95"
          >
            <Trophy className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/30" />
            <span className="text-[11px] font-bold">RANKS</span>
          </button>

          {/* Daily Challenge Race Button */}
          {onOpenDailyChallenge && (
            <button
              onClick={onOpenDailyChallenge}
              className={`px-2.5 py-1 rounded-full border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md active:scale-95 ${
                dailyStatus?.isClaimed
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-300'
                  : 'bg-gradient-to-r from-yellow-500/30 to-amber-500/30 hover:from-yellow-500/40 hover:to-amber-500/40 border-yellow-400/60 text-yellow-300 shadow-[0_0_12px_rgba(255,200,0,0.3)] animate-pulse'
              }`}
            >
              <span className="text-xs">🏆</span>
              <span className="text-[11px] font-extrabold">DAILY RACE</span>
              {!dailyStatus?.isClaimed && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-yellow-400 text-black font-black">
                  +50💎
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Coins Counter */}
          <div className="px-2.5 py-1 rounded-full bg-black/60 border border-yellow-500/40 text-yellow-300 text-xs font-bold flex items-center gap-1 shadow-[0_0_8px_rgba(255,200,0,0.2)]">
            <Coins className="w-3 h-3 text-yellow-400" />
            <span className="font-mono tabular-nums text-xs">{totalCoins.toLocaleString()}</span>
          </div>

          {/* Gems Counter */}
          <div className="px-2.5 py-1 rounded-full bg-black/60 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1 shadow-[0_0_8px_rgba(0,240,255,0.2)]">
            <span className="text-cyan-400 text-xs">💎</span>
            <span className="font-mono tabular-nums text-xs">{totalGems}</span>
          </div>

          {/* Ball Skin Shop */}
          <button
            onClick={onOpenShop}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-purple-500/40 hover:border-purple-400 text-purple-200 text-xs font-semibold transition-all cursor-pointer active:scale-95"
          >
            <Palette className="w-3 h-3 text-pink-400" />
            <span className="text-[11px] font-bold truncate max-w-[65px]">{currentSkin.name.split(' ')[0]}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label="Toggle Sound"
            className="w-7 h-7 rounded-full bg-black/60 border border-white/20 hover:border-white/40 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Center: Title & Level Target Selection */}
      <div className="flex flex-col items-center text-center max-w-lg my-auto">
        {/* Inline SVG Neon Title Lockup */}
        <div className="relative mb-4">
          <svg className="w-72 md:w-96 h-24 md:h-32 overflow-visible" viewBox="0 0 380 130">
            <defs>
              <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00f5ff" />
                <stop offset="50%" stopColor="#ff007f" />
                <stop offset="100%" stopColor="#ffea00" />
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <text
              x="50%"
              y="55"
              textAnchor="middle"
              className="font-black italic tracking-widest text-[44px] uppercase"
              fill="none"
              stroke="#ff007f"
              strokeWidth="8"
              opacity="0.4"
              filter="url(#neonGlow)"
            >
              GOING HOP 3D
            </text>

            <text
              x="50%"
              y="55"
              textAnchor="middle"
              className="font-black italic tracking-widest text-[44px] uppercase"
              fill="url(#neonGradient)"
              stroke="#ffffff"
              strokeWidth="1.2"
              filter="url(#neonGlow)"
            >
              GOING HOP 3D
            </text>

            <text
              x="50%"
              y="95"
              textAnchor="middle"
              className="font-extrabold tracking-[0.35em] text-[14px] uppercase"
              fill="#00f5ff"
            >
              ROLL &amp; SWIPE JUMP
            </text>
          </svg>
        </div>

        {/* Current Selected Level Pill */}
        <div className="mb-6">
          <button
            onClick={() => setShowLevelSelect(!showLevelSelect)}
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/20 transition-all text-white text-xs md:text-sm font-medium cursor-pointer shadow-lg"
          >
            <Layers className={`w-4 h-4 ${isDailyChallenge || currentLevel.id === 9999 ? 'text-yellow-400' : 'text-cyan-400'}`} />
            <span>
              {isDailyChallenge || currentLevel.id === 9999 ? 'Mode: ' : 'Target: '}
              <strong className={isDailyChallenge || currentLevel.id === 9999 ? 'text-yellow-300' : 'text-cyan-300'}>
                {isDailyChallenge || currentLevel.id === 9999 ? 'Daily Challenge Circuit 🏆' : currentLevel.name}
              </strong>
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isDailyChallenge || currentLevel.id === 9999 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
              {currentLevel.targetPadsCount} Target Pads
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>

        {/* Level Selector Dropdown: Sequential Unlocking Fixed */}
        {showLevelSelect && (
          <div className="mb-6 w-full max-w-sm bg-black/95 border border-white/15 rounded-2xl p-3 flex flex-col gap-1.5 shadow-[0_0_35px_rgba(0,0,0,0.9)] z-30 max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/50 uppercase tracking-wider px-2 py-1">
              <span>Cosmic Levels (1 - 150)</span>
              <span className="text-cyan-400">Unlocked: {maxUnlockedLevel}/150</span>
            </div>
            {LEVELS.map((lvl) => {
              // Strictly unlocked only if lvl.id <= maxUnlockedLevel
              const isUnlocked = lvl.id <= maxUnlockedLevel;
              const isSelected = currentLevel.id === lvl.id;

              return (
                <button
                  key={lvl.id}
                  disabled={!isUnlocked}
                  onClick={() => {
                    if (isUnlocked) {
                      soundEngine.playUiClick();
                      onSelectLevel(lvl);
                      setShowLevelSelect(false);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                    !isUnlocked
                      ? 'opacity-40 bg-white/5 cursor-not-allowed border border-transparent'
                      : isSelected
                      ? 'bg-gradient-to-r from-cyan-500/30 to-pink-500/30 border border-cyan-400/50 text-white cursor-pointer'
                      : 'hover:bg-white/10 text-white/80 hover:text-white border border-transparent cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isUnlocked ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-white/40 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-xs md:text-sm text-white flex items-center gap-1.5">
                        <span>{lvl.name}</span>
                        {!isUnlocked && (
                          <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded uppercase font-semibold">
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/50">{lvl.subtitle}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-cyan-300">
                      {lvl.targetPadsCount} Pads
                    </span>
                    {lvl.hasMovingPlatforms && (
                      <div className="text-[9px] text-yellow-300 mt-0.5">Moving Pads</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Daily Challenge Quick Banner */}
        {onOpenDailyChallenge && (
          <button
            onClick={onOpenDailyChallenge}
            className="w-full max-w-xs sm:max-w-sm mb-3 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-yellow-500/20 via-amber-500/15 to-purple-500/20 hover:from-yellow-500/30 hover:to-purple-500/30 border border-yellow-400/40 flex items-center justify-between text-left transition-all cursor-pointer shadow-lg active:scale-98 group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-base shadow-[0_0_12px_rgba(255,200,0,0.5)] shrink-0">
                🏆
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
                  <span>DAILY RACE</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                    CIRCUIT
                  </span>
                </div>
                <div className="text-[10px] text-white/70">
                  {dailyStatus?.isClaimed
                    ? 'Claimed today · Unlimited races'
                    : 'Win 1st Place for +50 Gems!'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  dailyStatus?.isClaimed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(255,200,0,0.6)]'
                }`}
              >
                {dailyStatus?.isClaimed ? 'CLAIMED' : '+50 💎'}
              </span>
              <ChevronRight className="w-4 h-4 text-white/50 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        )}

        {/* Clean Play CTA Button */}
        <button
          onClick={onStartGame}
          className={`group relative px-10 md:px-14 py-4 md:py-5 rounded-full font-black text-lg md:text-xl tracking-wider transition-all transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-3 ${
            isDailyChallenge || currentLevel.id === 9999
              ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black shadow-[0_0_35px_rgba(255,200,0,0.6)]'
              : 'bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 hover:from-pink-400 hover:via-purple-500 hover:to-cyan-400 text-white shadow-[0_0_35px_rgba(255,42,122,0.6)]'
          }`}
        >
          <Play
            className={`w-6 h-6 group-hover:scale-110 transition-transform ${
              isDailyChallenge || currentLevel.id === 9999 ? 'fill-black text-black' : 'fill-white text-white'
            }`}
          />
          <span>{isDailyChallenge || currentLevel.id === 9999 ? 'START RACE' : `START LEVEL ${currentLevel.id}`}</span>
        </button>
      </div>

      {/* Empty clean bottom spacer (All 3 requested bottom texts removed) */}
      <div className="h-4" />
    </div>
  );
};

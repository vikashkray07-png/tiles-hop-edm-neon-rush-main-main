import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX, Pause, Play, Home, RotateCcw, Gem, Target, Coins } from 'lucide-react';
import { GameStats, LevelConfig } from '../types/game';
import { soundEngine } from '../audio/SoundEngine';

interface GameHUDProps {
  stats: GameStats;
  currentLevel: LevelConfig;
  isPaused: boolean;
  onTogglePause: () => void;
  onRestartLevel: () => void;
  onGoHome: () => void;
  onSteerLeft?: () => void;
  onSteerRight?: () => void;
  onJump?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  currentLevel,
  isPaused,
  onTogglePause,
  onRestartLevel,
  onGoHome,
  onSteerLeft,
  onSteerRight,
  onJump,
}) => {
  const [isMuted, setIsMuted] = useState(soundEngine.getMuted());
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const holdIntervalRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const startHold = (action?: () => void) => {
    if (!action) return;
    action();
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
    }
    holdIntervalRef.current = window.setInterval(action, 45);
  };

  const stopHold = () => {
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopHold();
  }, []);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  useEffect(() => {
    if (stats.hitFeedback && stats.hitFeedback.timestamp !== lastTimestampRef.current) {
      lastTimestampRef.current = stats.hitFeedback.timestamp;
      setFeedbackVisible(true);
      const timer = setTimeout(() => setFeedbackVisible(false), 550);
      return () => clearTimeout(timer);
    }
  }, [stats.hitFeedback?.timestamp]);

  const progressPercent = Math.min(
    100,
    Math.round((stats.targetPadsCleared / Math.max(1, stats.totalTargetPads)) * 100)
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none overflow-hidden flex flex-col justify-between z-10 font-sans"
      style={{
        paddingTop: 'max(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)), 8px)',
        paddingBottom: 'max(var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)), 12px)',
        paddingLeft: 'max(var(--safe-area-inset-left, env(safe-area-inset-left, 0px)), 8px)',
        paddingRight: 'max(var(--safe-area-inset-right, env(safe-area-inset-right, 0px)), 8px)',
      }}
    >
      {/* Top Section: Header Bar and Compact Scoreboard */}
      <div className="w-full flex flex-col items-center pointer-events-none">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between gap-1 sm:gap-2">
          {/* Top-Left: Level Info & Celestial Planet Target / Race Position */}
          <div className="flex flex-col gap-0.5 sm:gap-1 pointer-events-auto min-w-0 max-w-[125px] sm:max-w-[200px] md:max-w-xs">
            {/* Level & Planetary Target Badge / Race Position */}
            <div className="flex items-center gap-1 sm:gap-2 bg-black/60 border border-white/10 px-2 sm:px-3 py-1 rounded-full text-white text-[10px] sm:text-xs md:text-sm shadow-md truncate">
              {stats.isDailyChallenge ? (
                <>
                  <span className="text-sm shrink-0">
                    {stats.racePosition === 1 ? '🥇' : stats.racePosition === 2 ? '🥈' : '🥉'}
                  </span>
                  <span className="font-extrabold text-yellow-300 truncate">
                    {stats.racePosition === 1 ? '1st Place' : stats.racePosition === 2 ? '2nd Place' : '3rd Place'}
                  </span>
                  <span className="text-white/40">|</span>
                  <span className="font-semibold text-white/90 shrink-0">
                    {stats.targetPadsCleared}/{stats.totalTargetPads}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm shrink-0">{currentLevel.planetEmoji}</span>
                  <span className="font-extrabold text-cyan-300 truncate">
                    {currentLevel.planetTarget}
                  </span>
                  <span className="text-white/40">|</span>
                  <span className="font-semibold text-white/90 shrink-0">
                    {stats.targetPadsCleared}/{stats.totalTargetPads}
                  </span>
                </>
              )}
            </div>

            {/* Level Progress Bar */}
            <div className="w-24 sm:w-36 md:w-56 h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden border border-white/10 mt-0.5">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Top-Center: Big Bubbly White Score Counter with Blue Outline */}
          <div className="flex flex-col items-center shrink-0 relative">
            <div
              className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_12px_rgba(2,132,199,0.9)] tabular-nums"
              style={{ WebkitTextStroke: '2px #0284c7' }}
            >
              {stats.score.toLocaleString()}
            </div>

            {/* Floating Landing Feedback Splash (Zero-layout-shift absolute overlay) */}
            <div
              aria-live="polite"
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap pointer-events-none font-black tracking-wider text-xs sm:text-base md:text-xl text-yellow-300 drop-shadow-[0_0_14px_rgba(255,220,0,0.9)] transition-all duration-150 ${
                feedbackVisible && stats.hitFeedback
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-1'
              }`}
            >
              {stats.hitFeedback?.type || ''}
            </div>
          </div>

          {/* Top-Right: Coins, Gems, Sound & Always-Visible MENU/PAUSE Button */}
          <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0">
            {/* Total Coins Counter */}
            <div className="flex items-center gap-1 bg-black/60 border border-yellow-500/30 px-1.5 sm:px-2.5 py-1 rounded-full text-yellow-300 text-[10px] sm:text-xs font-bold shadow-sm">
              <Coins className="w-3 h-3 text-yellow-400 shrink-0" />
              <span className="tabular-nums font-mono">
                {stats.totalCoins.toLocaleString()}
              </span>
            </div>

            {/* Level Gems counter */}
            <div className="flex items-center gap-1 bg-black/60 border border-cyan-500/30 px-1.5 sm:px-2.5 py-1 rounded-full text-cyan-300 text-[10px] sm:text-xs font-bold shadow-sm">
              <Gem className="w-3 h-3 text-cyan-400 fill-cyan-400/30 shrink-0" />
              <span className="tabular-nums">
                {Math.min(stats.totalGemsInLevel, stats.gemsCollectedInLevel)}/{stats.totalGemsInLevel}
              </span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              aria-label="Toggle Sound"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 border border-white/10 hover:border-white/30 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            </button>

            {/* Pause / Menu Button (Guaranteed 100% visible on all mobile screens!) */}
            <button
              onClick={onTogglePause}
              aria-label="Pause Menu (Resume / Restart / Home)"
              className="px-2 sm:px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-[11px] sm:text-xs flex items-center gap-1 shadow-[0_0_12px_rgba(0,240,255,0.4)] border border-cyan-300/40 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Pause className="w-3 h-3 fill-white" />
              <span className="font-bold">MENU</span>
            </button>
          </div>
        </div>

        {/* Daily Challenge Live Compact Scoreboard: Positioned immediately below Top Score! */}
        {stats.isDailyChallenge && stats.raceParticipants && stats.raceParticipants.length > 0 && (
          <div className="w-full max-w-sm sm:max-w-md mx-auto pointer-events-none select-none flex flex-col gap-1 px-1 mt-1">
            {/* 3 Racers Live Ranking Bar */}
            <div className="flex items-center justify-between gap-1 sm:gap-1.5 bg-black/80 backdrop-blur-md border border-white/15 rounded-2xl p-1.5 shadow-lg">
              {stats.raceParticipants.map((racer) => {
                const isPlayer = !racer.isBot;
                const rankColor =
                  racer.position === 1
                    ? 'bg-yellow-400 text-black'
                    : racer.position === 2
                    ? 'bg-slate-300 text-black'
                    : 'bg-amber-700 text-white';

                return (
                  <div
                    key={racer.id}
                    className={`flex-1 flex items-center justify-between gap-1 px-1.5 sm:px-2 py-1 rounded-xl transition-all ${
                      isPlayer
                        ? 'bg-cyan-500/25 border border-cyan-400/60 shadow-[0_0_10px_rgba(0,245,255,0.25)]'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0 ${rankColor}`}
                      >
                        {racer.position}
                      </span>
                      {isPlayer ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: racer.color }}
                          />
                          <span className="text-[10px] sm:text-xs font-black text-cyan-300 truncate tracking-wide">
                            YOU
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="text-sm sm:text-base leading-none select-none shrink-0"
                            title={racer.countryName || racer.countryCode}
                          >
                            {racer.flag || '🏁'}
                          </span>
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-extrabold shrink-0 ${
                        racer.isFinished
                          ? 'text-emerald-400 uppercase tracking-tighter'
                          : isPlayer
                          ? 'text-yellow-300'
                          : 'text-white/60'
                      }`}
                    >
                      {racer.isFinished ? 'FINISH' : `${racer.progressPercent}%`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mini Track 3-Ball Progress Line */}
            <div className="relative w-full h-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2 flex items-center">
              <span className="text-[8px] text-white/50 absolute left-1 select-none">🏁</span>
              <span className="text-[8px] text-yellow-400 absolute right-1 select-none">🏆</span>

              <div className="relative w-full h-1 mx-3 bg-white/15 rounded-full">
                {stats.raceParticipants.map((racer) => {
                  const isPlayer = !racer.isBot;
                  return (
                    <div
                      key={`dot-${racer.id}`}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-150 flex flex-col items-center z-10 ${
                        isPlayer ? 'scale-125 z-20' : ''
                      }`}
                      style={{ left: `${Math.max(2, Math.min(98, racer.progressPercent))}%` }}
                    >
                      <div
                        className="w-2 h-2 rounded-full border border-white shadow-md"
                        style={{
                          backgroundColor: racer.color,
                          boxShadow: `0 0 6px ${racer.color}`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Synchronized 3-2-1-GO Countdown Overlay */}
      {stats.isDailyChallenge && stats.countdown !== null && stats.countdown !== undefined && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-30">
          <div className="relative flex flex-col items-center animate-in zoom-in-75 duration-150">
            {stats.countdown > 0 ? (
              <>
                <div
                  key={stats.countdown}
                  className="text-7xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-300 to-orange-500 drop-shadow-[0_0_35px_rgba(255,200,0,0.85)] tabular-nums animate-bounce"
                >
                  {stats.countdown}
                </div>
                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white/90 bg-black/80 px-4 py-1.5 rounded-full border border-yellow-400/40 mt-3 shadow-lg">
                  Daily EDM Circuit · Synchronized Start
                </div>
              </>
            ) : (
              <div
                key="go"
                className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-400 to-yellow-300 drop-shadow-[0_0_40px_rgba(16,185,129,0.9)] tracking-wider animate-ping"
              >
                GO!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom On-Screen Touch Steering & Jump Controls */}
      {!isPaused && (
        <div className="w-full flex items-center justify-between gap-3 pointer-events-auto max-w-sm mx-auto mb-3 select-none touch-none px-2">
          {/* Swapped as requested: Right option (▶) on the LEFT side */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startHold(onSteerRight);
            }}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={(e) => e.stopPropagation()}
            aria-label="Steer Right"
            className="flex-1 py-3 px-3 rounded-2xl bg-white/25 hover:bg-white/35 active:bg-cyan-500/50 border border-white/30 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer backdrop-blur-md touch-manipulation select-none"
          >
            <span className="text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(2,132,199,0.8)]">▶</span>
          </button>

          {/* Jump / Launch - Center glowing HOP pill button (ONLY button that hops the ball!) */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (stats.isDailyChallenge && stats.countdown !== null && stats.countdown !== undefined && stats.countdown > 0) {
                return;
              }
              onJump?.();
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Jump / Hop"
            disabled={stats.isDailyChallenge && stats.countdown !== null && stats.countdown !== undefined && stats.countdown > 0}
            className={`flex-1.4 py-3.5 px-6 rounded-full font-black text-base tracking-wider transition-all cursor-pointer flex items-center justify-center touch-manipulation select-none border-2 ${
              stats.isDailyChallenge && stats.countdown !== null && stats.countdown !== undefined && stats.countdown > 0
                ? 'bg-slate-700/80 text-white/50 border-white/20 opacity-75'
                : 'bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-300 hover:opacity-95 active:scale-95 text-slate-900 shadow-[0_4px_20px_rgba(0,240,255,0.6)] border-white/60'
            }`}
          >
            <span className="text-base font-black tracking-wider text-slate-900">
              {stats.isDailyChallenge && stats.countdown !== null && stats.countdown !== undefined && stats.countdown > 0
                ? `READY... ${stats.countdown}`
                : '▲ HOP'}
            </span>
          </button>

          {/* Swapped as requested: Left option (◀) on the RIGHT side */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startHold(onSteerLeft);
            }}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={(e) => e.stopPropagation()}
            aria-label="Steer Left"
            className="flex-1 py-3 px-3 rounded-2xl bg-white/25 hover:bg-white/35 active:bg-cyan-500/50 border border-white/30 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer backdrop-blur-md touch-manipulation select-none"
          >
            <span className="text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(2,132,199,0.8)]">◀</span>
          </button>
        </div>
      )}

      {/* Paused Overlay with RESTART option */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/85 pointer-events-auto flex flex-col items-center justify-center z-50">
          <div className="text-4xl font-extrabold text-white tracking-widest mb-6">GAME PAUSED</div>
          <div className="flex flex-col gap-3 w-64">
            {/* 1. RESUME */}
            <button
              onClick={onTogglePause}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" /> RESUME
            </button>

            {/* 2. RESTART (Right under Resume) */}
            <button
              onClick={onRestartLevel}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-extrabold text-base shadow-[0_0_20px_rgba(255,200,0,0.4)] transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5 stroke-[2.5]" /> RESTART LEVEL
            </button>

            {/* 3. HOME */}
            <button
              onClick={onGoHome}
              className="w-full py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> HOME / LEVEL SELECT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

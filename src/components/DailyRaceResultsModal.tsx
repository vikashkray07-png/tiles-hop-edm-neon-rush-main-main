import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Home, Trophy, Gem, AlertCircle, XCircle } from 'lucide-react';
import { GameStats } from '../types/game';

interface DailyRaceResultsModalProps {
  stats: GameStats;
  racePosition: number; // 1, 2, or 3
  gemsAwarded: number; // 50, 15, or 0
  wasFirstRaceToday: boolean;
  playerFell?: boolean;
  onRaceAgain: () => void;
  onGoHome: () => void;
}

export const DailyRaceResultsModal: React.FC<DailyRaceResultsModalProps> = ({
  stats,
  racePosition,
  gemsAwarded,
  wasFirstRaceToday,
  playerFell = false,
  onRaceAgain,
  onGoHome,
}) => {
  useEffect(() => {
    if (!playerFell && racePosition === 1) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.55 },
          colors: ['#ffd700', '#00f5ff', '#ff007f', '#39ff14'],
          disableForReducedMotion: true,
        });
      } catch {
        // Safe fallback
      }
    }
  }, [racePosition, playerFell]);

  const isFell = Boolean(playerFell);

  const positionTitle = isFell
    ? 'GAME OVER — RACE LOST'
    : racePosition === 1
    ? 'CHAMPION — 1ST PLACE!'
    : racePosition === 2
    ? 'RUNNER-UP — 2ND PLACE!'
    : '3RD PLACE FINISH';

  const positionEmoji = isFell ? '💀' : racePosition === 1 ? '🥇' : racePosition === 2 ? '🥈' : '🥉';

  const positionBadgeColor = isFell
    ? 'from-red-600 to-rose-700 text-white border-red-500'
    : racePosition === 1
    ? 'from-yellow-400 to-amber-500 text-black border-yellow-300'
    : racePosition === 2
    ? 'from-slate-200 to-slate-400 text-black border-slate-200'
    : 'from-amber-700 to-amber-900 text-white border-amber-500';

  const handleRaceAgainClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DailyRaceResultsModal] RACE AGAIN button clicked');
    onRaceAgain();
  };

  const handleGoHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DailyRaceResultsModal] MAIN MENU button clicked');
    onGoHome();
  };

  // Build sorted final standings list
  const participants = stats.raceParticipants && stats.raceParticipants.length > 0
    ? [...stats.raceParticipants].sort((a, b) => {
        if (a.status === 'FINISHED' && b.status !== 'FINISHED') return -1;
        if (a.status !== 'FINISHED' && b.status === 'FINISHED') return 1;
        if (a.finishTimeMs && b.finishTimeMs) return a.finishTimeMs - b.finishTimeMs;
        return (b.progressPercent || 0) - (a.progressPercent || 0);
      })
    : [];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none font-sans pointer-events-auto animate-in fade-in duration-200"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`w-full max-w-md bg-gradient-to-b ${
          isFell
            ? 'from-[#2a0814] via-[#1a030b] to-[#0d0106] border-red-500/40 shadow-[0_0_60px_rgba(239,68,68,0.3)]'
            : 'from-[#1c0836] via-[#100323] to-[#0a0118] border-yellow-400/40 shadow-[0_0_60px_rgba(255,200,0,0.3)]'
        } border rounded-3xl p-5 md:p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto pointer-events-auto`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Crown / Skull Avatar */}
        <div className="relative mb-3">
          <div
            className={`w-20 h-20 rounded-3xl ${
              isFell
                ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-orange-600 shadow-[0_0_30px_rgba(239,68,68,0.6)]'
                : 'bg-gradient-to-tr from-yellow-400 via-amber-300 to-orange-500 shadow-[0_0_30px_rgba(255,200,0,0.6)]'
            } flex items-center justify-center text-4xl`}
          >
            {positionEmoji}
          </div>
          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-black/90 border border-white/30 flex items-center justify-center text-xs">
            {isFell ? (
              <XCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <Trophy className="w-4 h-4 text-yellow-400" />
            )}
          </div>
        </div>

        {/* Title & Placement */}
        <div className="mb-3">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-1 shadow-sm border bg-gradient-to-r ${positionBadgeColor}`}
          >
            {isFell
              ? '💥 Fell Into Abyss'
              : racePosition === 1
              ? '🥇 Winner'
              : racePosition === 2
              ? '🥈 2nd Place'
              : '🥉 3rd Place'}
          </span>
          <h2
            className={`text-2xl md:text-3xl font-black uppercase tracking-wide ${
              isFell
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-amber-300'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300'
            }`}
          >
            {positionTitle}
          </h2>
          <p className="text-xs text-white/60 mt-0.5">
            {isFell
              ? `Fell off pad ${stats.targetPadsCleared} of ${stats.totalTargetPads}`
              : 'Daily EDM Neon Championship Circuit'}
          </p>
        </div>

        {/* Final Race Standings with Flags & Names */}
        <div className="w-full my-2 bg-black/60 border border-white/10 rounded-2xl p-3 text-left">
          <div className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-2 border-b border-white/10 pb-1 flex items-center justify-between">
            <span>Final Race Standings</span>
            <span>Progress / Status</span>
          </div>

          {participants.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {participants.map((racer, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                const isPlayer = racer.isPlayer || racer.id === 'player';
                const isHumanParticipant = Boolean(racer.isHuman || (!racer.isBot && !isPlayer));
                const flag = racer.flag || (isPlayer ? '🇮🇳' : '🏁');
                const isFellRacer = racer.status === 'FELL';
                const isFinished = racer.status === 'FINISHED';

                return (
                  <div
                    key={racer.id || idx}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                      isPlayer
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'bg-white/5 border-white/5 text-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-sm shrink-0">{medal}</span>
                      <span className="text-base shrink-0" title={racer.countryName || racer.countryCode}>
                        {flag}
                      </span>
                      {isPlayer ? (
                        <span className="truncate max-w-[120px] sm:max-w-[160px] font-black text-cyan-300 tracking-wider text-xs">
                          YOU
                        </span>
                      ) : isHumanParticipant ? (
                        <span className="truncate max-w-[120px] sm:max-w-[160px] font-bold text-white text-xs">
                          {racer.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isFinished ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold">
                          FINISHED
                        </span>
                      ) : isFellRacer ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/30 text-rose-300 border border-rose-400/40 text-[10px] font-bold">
                          FELL ({racer.currentPad}/{racer.totalPads})
                        </span>
                      ) : (
                        <span className="text-xs text-white/60 font-mono">
                          {Math.round(racer.progressPercent || 0)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-xs text-white/40 py-2">No racer standings recorded</div>
          )}
        </div>

        {/* Gems Awarded Box (Only on 1st race when daily reward is earned and player did not fall) */}
        {!isFell && wasFirstRaceToday && gemsAwarded > 0 && (
          <div className="w-full my-2 p-3.5 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[10px] text-white/50 uppercase font-bold tracking-wider">
                Daily Reward Earned
              </div>
              <div className="text-xs text-white/80 font-medium">
                Position #{racePosition} Reward
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40">
              <Gem className="w-4 h-4 text-cyan-400 fill-cyan-400/40" />
              <span className="text-lg font-black text-white tabular-nums">
                +{gemsAwarded}
              </span>
            </div>
          </div>
        )}

        {/* Informative Banner when replaying after reward claimed */}
        {!wasFirstRaceToday && !isFell && (
          <div className="w-full p-3 rounded-2xl bg-yellow-500/15 border border-yellow-400/40 my-2 text-left flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200 font-semibold leading-relaxed">
              Today's reward claimed! You can race again, but no extra gems will be awarded today.
            </p>
          </div>
        )}

        {/* Informative Banner on Fall */}
        {isFell && (
          <div className="w-full p-3 rounded-2xl bg-rose-500/15 border border-rose-400/40 my-2 text-left flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-200 font-semibold leading-relaxed">
              You fell into the abyss before completing the course! Try again to reach the finish line.
            </p>
          </div>
        )}

        {/* Breakdown Stats Grid */}
        <div className="w-full grid grid-cols-3 gap-2 my-2 bg-black/40 border border-white/5 rounded-2xl p-2.5">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-white/50 uppercase font-semibold">Score</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {stats.score.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-white/10">
            <span className="text-[10px] text-white/50 uppercase font-semibold">Pads</span>
            <span className="text-sm font-bold text-cyan-300 tabular-nums">
              {stats.targetPadsCleared}/{stats.totalTargetPads}
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-white/10">
            <span className="text-[10px] text-white/50 uppercase font-semibold">Max Combo</span>
            <span className="text-sm font-bold text-yellow-400 tabular-nums">
              x{stats.maxCombo || 1}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2 mt-3 pointer-events-auto">
          {/* Replay Button */}
          <button
            type="button"
            onClick={handleRaceAgainClick}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black text-sm tracking-wider shadow-[0_0_25px_rgba(255,200,0,0.45)] transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2 pointer-events-auto touch-manipulation"
          >
            <RotateCcw className="w-4 h-4 text-black" />
            <span>RACE AGAIN</span>
          </button>

          <button
            type="button"
            onClick={handleGoHomeClick}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 pointer-events-auto touch-manipulation"
          >
            <Home className="w-4 h-4" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};

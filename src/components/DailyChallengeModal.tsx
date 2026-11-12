import React, { useEffect, useState } from 'react';
import { Trophy, Clock, X, Play, Gem, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getTodayUtcDateString,
  getTimeUntilNextDailyReset,
  DailyChallengeStatus,
} from '../lib/dailyChallenge';

interface DailyChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDailyRace: () => void;
  status: DailyChallengeStatus | null;
  isLoadingStatus: boolean;
}

export const DailyChallengeModal: React.FC<DailyChallengeModalProps> = ({
  isOpen,
  onClose,
  onStartDailyRace,
  status,
  isLoadingStatus,
}) => {
  const [countdown, setCountdown] = useState<string>('');
  const todayDate = getTodayUtcDateString();

  useEffect(() => {
    if (!isOpen) return;

    const updateTimer = () => {
      const { formatted } = getTimeUntilNextDailyReset();
      setCountdown(formatted);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const isClaimed = status?.isClaimed ?? false;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#1b0933] to-[#0c031c] border border-yellow-400/40 rounded-3xl p-5 md:p-7 flex flex-col shadow-[0_0_50px_rgba(255,200,0,0.25)] max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Daily Challenge"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Lockup */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(255,200,0,0.5)]">
            <Trophy className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400 uppercase tracking-wider">
                DAILY CHALLENGE
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 font-extrabold uppercase border border-yellow-400/30">
                RACE
              </span>
            </div>
            <p className="text-xs text-white/60">
              Universal UTC Circuit · {todayDate}
            </p>
          </div>
        </div>

        {/* Daily Reward Status Banner */}
        <div
          className={`p-3.5 rounded-2xl border mb-4 flex items-start gap-3 ${
            isClaimed
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-gradient-to-r from-yellow-500/15 via-orange-500/10 to-pink-500/15 border-yellow-400/40 text-yellow-200'
          }`}
        >
          {isClaimed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5 animate-pulse" />
          )}
          <div className="text-xs leading-relaxed">
            {isClaimed ? (
              <div>
                <span className="font-extrabold text-emerald-300 block text-sm mb-0.5">
                  Today's Reward Claimed!
                </span>
                <p className="text-white/80">
                  Today's reward claimed! You can race again, but no extra gems will be awarded today.
                </p>
              </div>
            ) : (
              <div>
                <span className="font-extrabold text-yellow-300 block text-sm mb-0.5">
                  Daily Reward Available!
                </span>
                <p className="text-white/80">
                  Your <strong className="text-white">first completed race</strong> of each day determines your reward. Race hard for 1st place!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reward Rules Breakdown Cards */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">
            Placement Rewards (1st Race Today)
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* 1st Place */}
            <div className="p-3 rounded-2xl bg-gradient-to-b from-yellow-500/20 to-black/40 border border-yellow-400/50 flex flex-col items-center text-center shadow-[0_0_15px_rgba(255,200,0,0.15)]">
              <span className="text-2xl mb-1">🥇</span>
              <span className="text-[11px] font-extrabold text-yellow-300 uppercase">1st Place</span>
              <span className="text-lg font-black text-white flex items-center gap-1 mt-0.5">
                50 <Gem className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/50" />
              </span>
              <span className="text-[9px] text-yellow-300/80 font-bold mt-0.5">50 GEMS</span>
            </div>

            {/* 2nd Place */}
            <div className="p-3 rounded-2xl bg-gradient-to-b from-slate-400/20 to-black/40 border border-slate-300/40 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">🥈</span>
              <span className="text-[11px] font-extrabold text-slate-200 uppercase">2nd Place</span>
              <span className="text-lg font-black text-white flex items-center gap-1 mt-0.5">
                15 <Gem className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/50" />
              </span>
              <span className="text-[9px] text-slate-300/80 font-bold mt-0.5">15 GEMS</span>
            </div>

            {/* 3rd Place */}
            <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-800/20 to-black/40 border border-amber-600/30 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">🥉</span>
              <span className="text-[11px] font-extrabold text-amber-300 uppercase">3rd Place</span>
              <span className="text-lg font-black text-white flex items-center gap-1 mt-0.5">
                0 <Gem className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/50" />
              </span>
              <span className="text-[9px] text-white/50 font-bold mt-0.5">0 GEMS</span>
            </div>
          </div>
        </div>

        {/* Race Rules & Unlimited Participation Guarantee */}
        <div className="p-3 rounded-2xl bg-black/40 border border-white/10 mb-4 text-[11px] text-white/70 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-white text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Rules &amp; Unlimited Play</span>
          </div>
          <p>
            • <strong>No race limit:</strong> You can practice and race as many times per day as you want!
          </p>
          <p>
            • Only the <strong>first completed race</strong> of each day awards gems. Subsequent races that day award 0 gems.
          </p>
          <p>
            • Rewards reset automatically each day at <strong>00:00 UTC</strong>.
          </p>
        </div>

        {/* Reset Countdown Timer */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 mb-5 text-xs">
          <div className="flex items-center gap-1.5 text-white/60">
            <Clock className="w-3.5 h-3.5 text-yellow-400" />
            <span>Next Daily Reset:</span>
          </div>
          <span className="font-mono font-bold text-yellow-300 tabular-nums">
            {countdown || 'Loading...'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              onClose();
              onStartDailyRace();
            }}
            disabled={isLoadingStatus}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black text-base tracking-wider shadow-[0_0_25px_rgba(255,200,0,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-black text-black" />
            <span>{isClaimed ? 'PRACTICE / RACE AGAIN' : 'START DAILY RACE'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold text-xs transition-all cursor-pointer text-center"
          >
            BACK TO MENU
          </button>
        </div>
      </div>
    </div>
  );
};

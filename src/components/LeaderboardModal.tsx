import React, { useEffect } from 'react';
import { Trophy, X, Medal, Flame, RefreshCw, Users, CheckCircle2 } from 'lucide-react';
import { LeaderboardEntry, UserProfile } from '../types/game';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onClose: () => void;
  userProfile?: UserProfile | null;
  currentUserGems?: number;
  onEditProfile?: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  entries,
  loading,
  error,
  onRefresh,
  onClose,
  userProfile,
  currentUserGems,
  onEditProfile,
}) => {


  const currentUserEntry = entries.find((e) => e.isCurrentUser);
  const displayRank = currentUserEntry?.rank ? `#${currentUserEntry.rank}` : '#1';
  const rawUserLevel = currentUserEntry?.level;
  const displayUserLevel = typeof rawUserLevel === 'number' && !isNaN(rawUserLevel) && rawUserLevel < 9999 && rawUserLevel <= 150
    ? Math.max(1, rawUserLevel)
    : 1;
  const displayGems = currentUserEntry
    ? (currentUserEntry.gems ?? currentUserEntry.score ?? 0)
    : (currentUserGems ?? 0);

  return (
    <div className="absolute inset-0 bg-black/85 z-40 flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-lg bg-gradient-to-b from-[#1b0933] to-[#0c031c] border border-cyan-400/40 rounded-3xl p-5 md:p-7 flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.3)] animate-in fade-in zoom-in-95 duration-150 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400 fill-yellow-400/30" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">
                GLOBAL LEADERBOARD
              </h2>
              <p className="text-[11px] text-cyan-300 font-medium">
                Ranked by Total Gems Collected · Live Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh Live Scores"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer active:rotate-180 duration-300"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Leaderboard Statement Card */}
        {userProfile ? (
          <div className="mt-3 mb-1 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-purple-950/80 to-pink-950/80 border border-cyan-400/50 shadow-[0_0_20px_rgba(0,240,255,0.25)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0">{userProfile.flag || '🇮🇳'}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-black text-white truncate max-w-[130px]">{userProfile.name}</span>
                  <span className="text-[9px] bg-cyan-400/30 text-cyan-300 font-extrabold px-1.5 py-0.5 rounded uppercase border border-cyan-400/40">
                    YOU
                  </span>
                  <span className="text-[10px] bg-purple-500/30 text-purple-200 font-bold px-1.5 py-0.5 rounded border border-purple-400/30">
                    Lv {displayUserLevel}
                  </span>
                  {onEditProfile && (
                    <button
                      onClick={onEditProfile}
                      className="text-[10px] text-yellow-300 hover:text-yellow-200 underline cursor-pointer ml-1 font-semibold"
                    >
                      Change Name/Country
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-cyan-300/90 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0"></span>
                  <span className="truncate">Statement: Live Rank <strong className="text-white">{displayRank}</strong> of {Math.max(1, entries.length)}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold text-yellow-400/80 uppercase">Your Gems</div>
              <div className="text-base font-black text-yellow-300 flex items-center justify-end gap-1 font-mono">
                <span className="text-cyan-400 text-sm">💎</span>
                <span>{displayGems.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 mb-1 p-3 rounded-2xl bg-gradient-to-r from-yellow-950/60 via-purple-950/60 to-cyan-950/60 border border-yellow-400/50 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Enter Your Name &amp; Country</div>
              <div className="text-[11px] text-white/60">Fill in your profile to rank on the live leaderboard!</div>
            </div>
            {onEditProfile && (
              <button
                onClick={onEditProfile}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-extrabold text-xs cursor-pointer shadow-md active:scale-95 transition-all"
              >
                Fill Name &amp; Country
              </button>
            )}
          </div>
        )}

        {/* Column Headers */}
        <div className="grid grid-cols-12 text-[11px] font-bold text-white/40 uppercase tracking-wider px-3 pt-2 pb-1">
          <span className="col-span-2">Rank</span>
          <span className="col-span-5">Real Gamer</span>
          <span className="col-span-2 text-center" title="Highest Unlocked Level">Unlocked Lv</span>
          <span className="col-span-3 text-right">💎 Gems</span>
        </div>

        {/* Real Players List (ZERO FAKE GAMERS) */}
        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 my-2 min-h-[160px]">
          {error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-2">
                <X className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-sm font-bold text-red-300">Firestore Connection Error</div>
              <div className="text-xs text-white/70 mt-1 font-mono bg-black/40 p-2 rounded max-w-sm break-all">
                {error}
              </div>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-white/70">
              <RefreshCw className="w-8 h-8 mb-3 animate-spin text-cyan-400" />
              <div className="text-sm font-bold text-white">Connecting to Global Leaderboard...</div>
              <div className="text-xs text-cyan-300/80 mt-1">Fetching live rankings from Firebase Cloud Firestore</div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-white/40">
              <Users className="w-10 h-10 mb-2 opacity-50" />
              <div className="text-sm font-bold text-white/70">No Real Players Recorded Yet</div>
              <div className="text-xs text-white/40 mt-1 max-w-xs">
                Collect gems in any level to rank #1 on the global leaderboard!
              </div>
            </div>
          ) : (
            entries.map((player) => {
              const isTop1 = player.rank === 1;
              const isTop2 = player.rank === 2;
              const isTop3 = player.rank === 3;
              const isCurrent = player.isCurrentUser;
              const displayGems = player.gems ?? player.score ?? 0;

              return (
                <div
                  key={player.id || `rank-${player.rank}`}
                  className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-cyan-500/25 to-pink-500/25 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.35)]'
                      : isTop1
                      ? 'bg-yellow-500/10 border-yellow-400/30 text-white'
                      : 'bg-white/5 border-white/5 text-white/80'
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-2 flex items-center gap-1 font-black text-sm">
                    {isTop1 ? (
                      <span className="text-yellow-400 flex items-center gap-0.5">
                        <Medal className="w-4 h-4" /> #1
                      </span>
                    ) : isTop2 ? (
                      <span className="text-slate-300">#2</span>
                    ) : isTop3 ? (
                      <span className="text-amber-500">#3</span>
                    ) : (
                      <span className="text-white/50 text-xs">#{player.rank}</span>
                    )}
                  </div>

                  {/* Player & Country Flag */}
                  <div className="col-span-5 flex items-center gap-2 truncate">
                    <span className="text-base shrink-0">{player.flag}</span>
                    <div className="truncate">
                      <span
                        className={`font-bold text-xs truncate ${
                          isCurrent ? 'text-cyan-300 font-extrabold' : 'text-white'
                        }`}
                      >
                        {player.name}
                      </span>
                      {isCurrent && (
                        <span className="ml-1.5 text-[9px] bg-cyan-400/25 text-cyan-300 font-extrabold px-1.5 py-0.2 rounded uppercase border border-cyan-400/40">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level */}
                  <div className="col-span-2 text-center text-xs font-semibold text-white/70">
                    Lvl {typeof player.level === 'number' && !isNaN(player.level) && player.level < 9999 && player.level <= 150 ? Math.max(1, player.level) : 1}
                  </div>

                  {/* Gems Count (Primary Rank Criteria) */}
                  <div className="col-span-3 text-right font-black text-sm tabular-nums text-yellow-300 flex items-center justify-end gap-1">
                    <span className="text-cyan-400">◆</span>
                    <span>{displayGems.toLocaleString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
          <div className="flex items-center gap-1.5 text-cyan-300/80 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Global Rankings</span>
          </div>
          <span className="text-yellow-300 font-semibold">Most Gems = Rank #1 💎</span>
        </div>
      </div>
    </div>
  );
};

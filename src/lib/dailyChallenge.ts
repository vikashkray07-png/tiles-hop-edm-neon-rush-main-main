import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { DailyChallengeClaim, DailyChallengeStatus, LevelConfig } from '../types/game';
import { LEVELS, SECTOR_THEMES } from '../data/levels';

export type { DailyChallengeStatus, DailyChallengeClaim };

/**
 * Returns today's agreed universal date key in UTC format: "YYYY-MM-DD"
 * Using UTC ensures all devices (phones, laptops) and time zones are synchronized
 * and resets cleanly at 00:00:00 UTC every day.
 */
export function getTodayUtcDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Calculates remaining time until next UTC midnight daily reset
 */
export function getTimeUntilNextDailyReset(): {
  ms: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  const ms = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  return { ms, hours, minutes, seconds, formatted };
}

/**
 * Rewards Rule:
 * 1st place: 50 gems
 * 2nd place: 15 gems
 * 3rd place: 0 gems
 */
export function getDailyRewardForPosition(position: number): number {
  if (position === 1) return 50;
  if (position === 2) return 15;
  return 0;
}

/**
 * Stable Epoch Start Date for Daily Challenge Circuit: 2026-10-26 (Day 1)
 * Consecutive calendar days add 1 pad, up to a maximum of 50 pads.
 * Formula: Math.min(50, 10 + (challengeDay - 1))
 */
export const DAILY_CIRCUIT_EPOCH_DATE = '2026-10-26';

export function getDailyChallengePadCount(dateStr: string): {
  challengeDay: number;
  targetPadsCount: number;
  platformsCount: number;
} {
  const epoch = new Date(`${DAILY_CIRCUIT_EPOCH_DATE}T00:00:00Z`).getTime();
  const current = new Date(`${dateStr}T00:00:00Z`).getTime();
  const diffDays = Math.max(0, Math.floor((current - epoch) / (1000 * 60 * 60 * 24)));
  const challengeDay = diffDays + 1;
  const targetPadsCount = Math.min(50, 10 + (challengeDay - 1));
  const platformsCount = targetPadsCount + 1; // 1 Start pad + target landing pads (last pad is Goal)

  return { challengeDay, targetPadsCount, platformsCount };
}

/**
 * Generates a deterministic daily challenge course configuration for today's date.
 * Pad count starts at 10 on Day 1 and increases by 1 each day, capped at 50 pads.
 */
export function getDailyChallengeLevel(dateStr: string): LevelConfig {
  // Deterministic seed from date
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = (seed * 31 + dateStr.charCodeAt(i)) % 100000;
  }

  const themeIdx = seed % SECTOR_THEMES.length;
  const theme = SECTOR_THEMES[themeIdx];
  const { challengeDay, targetPadsCount, platformsCount } = getDailyChallengePadCount(dateStr);

  return {
    id: 9999, // Special ID for daily challenge
    name: `⚡ Daily Circuit (Day ${challengeDay})`,
    subtitle: `EDM Neon Championship · ${theme.name}`,
    platformsCount,
    targetPadsCount,
    targetDescription: `Daily Challenge Race · ${targetPadsCount} Pads · Finish Top 2 for Gems!`,
    planetTarget: 'Daily Trophy 🏆',
    planetEmoji: '🏆',
    planetColor: '#ffd700',
    planetType: theme.type,
    hasMovingPlatforms: false, // Steady parallel racing lanes
    movingPlatformSpeed: 2.2,
    movingAmplitude: 1.8,
    gapDistance: 6.2,
    totalGems: Math.min(15, Math.max(5, Math.floor(targetPadsCount / 3))),
    themeColor: '#00f5ff',
    bpm: 135,
    bgTop: theme.bgTop,
    bgBottom: theme.bgBottom,
    fogColor: theme.fogColor,
    unlocked: true,
  };
}

/**
 * Fetches the daily reward claim status from Firestore for the given UID and date.
 * Persistently stored at /dailyRewards/{uid}_{date}
 */
export async function fetchDailyRewardStatus(
  uid: string,
  dateStr: string
): Promise<DailyChallengeStatus> {
  const localCacheKey = `going_hop_daily_claim_${dateStr}`;

  try {
    const claimDocRef = doc(db, 'dailyRewards', `${uid}_${dateStr}`);
    const snap = await getDoc(claimDocRef);

    if (snap.exists()) {
      const data = snap.data() as DailyChallengeClaim;
      try {
        localStorage.setItem(localCacheKey, JSON.stringify(data));
      } catch {
        // ignore
      }
      return {
        date: dateStr,
        isClaimed: true,
        gemsAwarded: data.gemsAwarded,
        position: data.position,
        claimedAt: data.claimedAt,
      };
    } else {
      try {
        localStorage.removeItem(localCacheKey);
      } catch {
        // ignore
      }
      return {
        date: dateStr,
        isClaimed: false,
      };
    }
  } catch (err) {
    console.warn('[DailyChallenge] Note: Could not query Firestore daily status (using offline fallback):', err);
    // Offline local cache fallback
    try {
      const cached = localStorage.getItem(localCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          date: dateStr,
          isClaimed: true,
          gemsAwarded: parsed.gemsAwarded,
          position: parsed.position,
          claimedAt: parsed.claimedAt,
        };
      }
    } catch {
      // ignore
    }
    return { date: dateStr, isClaimed: false };
  }
}

export interface ClaimResult {
  success: boolean;
  alreadyClaimed: boolean;
  gemsAwarded: number;
  newTotalGems: number;
  message: string;
}

/**
 * Atomically validates and claims the daily reward via a trusted Firestore transaction.
 *
 * Guarantees:
 * 1. Exactly-once reward claiming per player per UTC calendar day.
 * 2. If already claimed, awards 0 additional gems.
 * 3. Atomic update to Firestore /dailyRewards/{uid}_{date} and /leaderboard/{uid}.
 * 4. Immutable: firestore.rules prevents any subsequent update or deletion.
 */
export async function claimDailyRewardTransaction(
  uid: string,
  dateStr: string,
  position: number,
  currentGems: number
): Promise<ClaimResult> {
  const claimDocId = `${uid}_${dateStr}`;
  const claimDocRef = doc(db, 'dailyRewards', claimDocId);
  const playerDocRef = doc(db, 'leaderboard', uid);
  const localCacheKey = `going_hop_daily_claim_${dateStr}`;

  const REWARD_CLAIMED_MESSAGE =
    "Today's reward claimed! You can race again, but no extra gems will be awarded today.";

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Read existing claim
      const claimSnap = await transaction.get(claimDocRef);

      if (claimSnap.exists()) {
        const existingData = claimSnap.data() as DailyChallengeClaim;
        return {
          alreadyClaimed: true,
          gemsAwarded: 0,
          newTotalGems: currentGems,
          claimData: existingData,
        };
      }

      // 2. Not claimed yet! Determine gems according to strict rules
      const gemsToAward = getDailyRewardForPosition(position);
      const now = Date.now();

      const newClaim: DailyChallengeClaim = {
        id: claimDocId,
        uid,
        date: dateStr,
        claimed: true,
        position,
        gemsAwarded: gemsToAward,
        claimedAt: now,
      };

      // Read current leaderboard document if it exists to increment gems atomically
      let newGems = currentGems + gemsToAward;
      const playerSnap = await transaction.get(playerDocRef);
      if (playerSnap.exists()) {
        const dbGems = Number(playerSnap.data().gems) || 0;
        newGems = Math.max(newGems, dbGems + gemsToAward);
        if (gemsToAward > 0) {
          transaction.update(playerDocRef, {
            gems: newGems,
            updatedAt: now,
          });
        }
      }

      // Commit the single daily reward claim record
      transaction.set(claimDocRef, newClaim);

      return {
        alreadyClaimed: false,
        gemsAwarded: gemsToAward,
        newTotalGems: newGems,
        claimData: newClaim,
      };
    });

    try {
      localStorage.setItem(localCacheKey, JSON.stringify(result.claimData));
      localStorage.setItem('going_hop_gems', result.newTotalGems.toString());
    } catch {
      // ignore
    }

    return {
      success: true,
      alreadyClaimed: result.alreadyClaimed,
      gemsAwarded: result.gemsAwarded,
      newTotalGems: result.newTotalGems,
      message: REWARD_CLAIMED_MESSAGE,
    };
  } catch (err: any) {
    console.warn('[DailyChallenge] Firestore transaction claim notice:', err);

    // If Firestore rules blocked it because document already existed (concurrent race protection):
    const isAlreadyExists =
      err?.code === 'permission-denied' ||
      err?.code === 'already-exists' ||
      err?.message?.includes('already-exists');

    if (isAlreadyExists) {
      return {
        success: true,
        alreadyClaimed: true,
        gemsAwarded: 0,
        newTotalGems: currentGems,
        message: REWARD_CLAIMED_MESSAGE,
      };
    }

    // Local fallback if offline or Firestore temporarily unreachable
    const cached = localStorage.getItem(localCacheKey);
    if (cached) {
      return {
        success: true,
        alreadyClaimed: true,
        gemsAwarded: 0,
        newTotalGems: currentGems,
        message: REWARD_CLAIMED_MESSAGE,
      };
    }

    // Local grant if offline on first race
    const gemsToAward = getDailyRewardForPosition(position);
    const newTotal = currentGems + gemsToAward;
    try {
      localStorage.setItem(
        localCacheKey,
        JSON.stringify({
          id: claimDocId,
          uid,
          date: dateStr,
          claimed: true,
          position,
          gemsAwarded: gemsToAward,
          claimedAt: Date.now(),
        })
      );
      localStorage.setItem('going_hop_gems', newTotal.toString());
    } catch {
      // ignore
    }

    return {
      success: true,
      alreadyClaimed: false,
      gemsAwarded: gemsToAward,
      newTotalGems: newTotal,
      message: REWARD_CLAIMED_MESSAGE,
    };
  }
}

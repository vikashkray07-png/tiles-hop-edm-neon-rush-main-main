export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  platformsCount: number; // 1 Start Pad + targetPadsCount
  targetPadsCount: number; // Only target pads
  targetDescription: string;
  planetTarget: string; // e.g. "Moon", "Mars", "Venus", "Jupiter", "Cosmic Sun"
  planetEmoji: string;
  planetColor: string;
  planetType?: string;
  hasMovingPlatforms: boolean;
  movingPlatformSpeed: number;
  movingAmplitude: number;
  gapDistance: number;
  totalGems: number;
  themeColor: string;
  bpm?: number;
  environmentTheme?: string; // 'galaxy' | 'city' | 'samudra' | 'lava' | 'glacier' | 'sunset' | 'jungle' | 'desert' | 'storm' | 'matrix'
  bgTop?: string;
  bgBottom?: string;
  fogColor?: number;
  unlocked?: boolean;
}

export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  durationSeconds: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  scale: number[];
  colorTheme: {
    primary: string;
    secondary: string;
    backgroundTop: string;
    backgroundBottom: string;
    fogColor: number;
  };
}

export interface PlatformData {
  id: number;
  index: number;
  baseX: number;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
  colorHex: string;
  isMoving: boolean;
  moveSpeed: number;
  moveAmplitude: number;
  movePhase: number;
  hasGem: boolean;
  gemCollected?: boolean;
  isStartPad?: boolean;
  isGoal?: boolean;
  visited?: boolean;
}

export interface BallSkin {
  id: string;
  name: string;
  color: string;
  emissive: string;
  trailColor: string;
  costCoins: number; // Cost in Gold Coins to unlock (for coin skins)
  cost?: number; // Backward compatibility
  unlocked: boolean;
  unlockType?: 'coins' | 'ads'; // How skin is unlocked
  adsRequired?: number; // 2 ads required for ad skins
  adsWatched?: number; // 0, 1, or 2
}

export interface UserProfile {
  name: string;
  country: string;
  flag: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  country: string;
  flag: string;
  gems: number; // Ranked by Total Gems Collected
  score?: number;
  level: number;
  updatedAt?: number;
  isCurrentUser?: boolean;
}

export interface RaceRacerState {
  id: string;
  name: string;
  isBot: boolean;
  isHuman?: boolean;
  isPlayer?: boolean;
  color: string;
  colorName: string;
  progressPercent: number; // 0 to 100
  currentPad: number;
  totalPads: number;
  position: number; // 1, 2, or 3
  isFinished: boolean;
  finishRank?: number; // 1, 2, or 3
  finishTimeMs?: number;
  flag?: string; // e.g. 🇮🇳, 🇦🇺, 🇬🇧
  countryCode?: string;
  countryName?: string;
  status?: 'ACTIVE' | 'FINISHED' | 'FELL';
}

export interface GameStats {
  score: number; // In-run points
  totalCumulativeScore: number;
  coinsEarnedInLevel: number; // Coins collected in current run
  totalCoins: number; // Wallet coins for buying skins
  totalGems: number; // Overall Gems collected for Global Leaderboard ranking
  gemsCollectedInLevel: number;
  totalGemsInLevel: number;
  combo: number;
  maxCombo: number;
  targetPadsCleared: number; // Count of target pads actually visited
  totalTargetPads: number;
  currentLevel: number;
  perfectHits?: number;
  hitFeedback?: {
    type: string;
    bonus: number;
    timestamp: number;
  };
  isDailyChallenge?: boolean;
  racePosition?: number; // 1 = 1st place, 2 = 2nd place, 3 = 3rd place
  playerFell?: boolean;
  raceOutcome?: 'PLAYER_FELL' | 'PLAYER_FINISHED' | 'BOT_FINISHED' | 'RACE_RESULTS';
  raceParticipants?: RaceRacerState[];
  countdown?: number | null; // 3, 2, 1, 0 ("GO!"), or null
}

export interface DailyChallengeClaim {
  id: string;
  uid: string;
  date: string;
  claimed: boolean;
  position: number;
  gemsAwarded: number;
  claimedAt: number;
}

export interface DailyChallengeStatus {
  date: string;
  isClaimed: boolean;
  gemsAwarded?: number;
  position?: number;
  claimedAt?: number;
}


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameHUD } from './components/GameHUD';
import { TitleScreen } from './components/TitleScreen';
import { GameOverModal } from './components/GameOverModal';
import { SkinShopModal } from './components/SkinShopModal';
import { UserProfileModal } from './components/UserProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ReviewModal } from './components/ReviewModal';
import { DailyChallengeModal } from './components/DailyChallengeModal';
import { DailyRaceResultsModal } from './components/DailyRaceResultsModal';
import { LEVELS } from './data/levels';
import { BALL_SKINS } from './data/skins';
import { BallSkin, GamePhase, GameStats, LeaderboardEntry, LevelConfig, UserProfile, DailyChallengeStatus } from './types/game';
import { soundEngine } from './audio/SoundEngine';
import { db, auth, authReady, getCanonicalPlayerId, getAuthError } from './lib/firebase';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  getTodayUtcDateString,
  getDailyChallengeLevel,
  fetchDailyRewardStatus,
  claimDailyRewardTransaction,
} from './lib/dailyChallenge';
import {
  CURRENT_RESET_VERSION,
  RESET_VERSION_KEY,
  PROFILE_SETUP_VERSION,
  PROFILE_SETUP_KEY,
  PlayerProgressState,
  loadLocalPlayerProgress,
  saveLocalPlayerProgress,
  fetchCloudPlayerProgress,
  syncCloudPlayerProgress,
  executeOneTimeTestReset,
  getDefaultPlayerProgress,
} from './lib/playerProgress';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Online / Offline state. Android WebView can report navigator.onLine=true
  // even when mobile data/Wi-Fi has no internet, so confirm reachability too.
  const [isOnline, setIsOnline] = useState<boolean>(false);
  useEffect(() => {
    let disposed = false;
    let probeInFlight = false;
    let failedChecks = 0;

    const verifyInternet = async () => {
      if (disposed || probeInFlight) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        return;
      }

      probeInFlight = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      try {
        // A no-cors request is sufficient: success means the request reached
        // the internet; offline/DNS/network failures reject the fetch.
        await fetch('https://www.gstatic.com/generate_204', {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        failedChecks = 0;
        if (!disposed) setIsOnline(true);
      } catch {
        // One failed check can just be a slow network. Only go offline after two in a row.
        failedChecks += 1;
        if (!disposed && failedChecks >= 2) setIsOnline(false);
      } finally {
        window.clearTimeout(timeout);
        probeInFlight = false;
      }
    };

    const handleOnline = () => { void verifyInternet(); };
    const handleOffline = () => {
      failedChecks = 2;
      setIsOnline(false);
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') void verifyInternet();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleVisible);
    document.addEventListener('visibilitychange', handleVisible);

    void verifyInternet();
    // Android WebView network events are not always delivered consistently.
    const pollId = window.setInterval(() => { void verifyInternet(); }, 4000);

    return () => {
      disposed = true;
      window.clearInterval(pollId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisible);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  const [phase, setPhase] = useState<GamePhase>('title');

  // Modals
  const [showShop, setShowShop] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDailyChallengeModal, setShowDailyChallengeModal] = useState(false);
  const [showDailyRaceResultsModal, setShowDailyRaceResultsModal] = useState(false);
  const [dailyRaceResultsData, setDailyRaceResultsData] = useState<{
    stats: GameStats;
    racePosition: number;
    gemsAwarded: number;
    wasFirstRaceToday: boolean;
    playerFell?: boolean;
  } | null>(null);

  // Daily Challenge State & Universal UTC Date Tracking (Resets automatically at 00:00 UTC)
  const [currentUtcDate, setCurrentUtcDate] = useState<string>(getTodayUtcDateString);
  const [dailyStatus, setDailyStatus] = useState<DailyChallengeStatus | null>(null);
  const [isLoadingDailyStatus, setIsLoadingDailyStatus] = useState<boolean>(true);
  const [isDailyChallenge, setIsDailyChallenge] = useState<boolean>(false);
  const isDailyChallengeRef = useRef(false);
  isDailyChallengeRef.current = isDailyChallenge;

  // Cached local progress for instant first frame
  const initialProgress = useRef<PlayerProgressState>(loadLocalPlayerProgress()).current;

  // Authentication and Cloud Sync Loading State (prevents flash of Level 1 or registration modal)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Sequential Level Progression: starts at 1, restored from cloud / local
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState<number>(initialProgress.maxUnlockedLevel);

  // Current active level: auto-selected next unlocked level or restored selected level
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(
    LEVELS[initialProgress.selectedLevel - 1] || LEVELS[0]
  );
  const currentLevelRef = useRef(currentLevel);
  currentLevelRef.current = currentLevel;

  // Active ball skin
  const [currentSkin, setCurrentSkin] = useState<BallSkin>(() => {
    return BALL_SKINS.find((s) => s.id === initialProgress.selectedSkin) || BALL_SKINS[0];
  });
  const currentSkinRef = useRef(currentSkin);
  currentSkinRef.current = currentSkin;

  // Dedicated snapshots for game-over and victory modals to ensure accurate non-zero stats
  const [victoryModalData, setVictoryModalData] = useState<{
    stats: GameStats;
    level: LevelConfig;
  } | null>(null);

  const [gameOverModalData, setGameOverModalData] = useState<{
    stats: GameStats;
    level: LevelConfig;
  } | null>(null);

  // Play background sound ONLY on the home/main page as requested
  useEffect(() => {
    if (phase === 'title') {
      soundEngine.startHomeAmbientMusic();
    } else {
      soundEngine.stopBackgroundMusic();
    }
  }, [phase]);

  // Initialize sound on user's first gesture anywhere
  useEffect(() => {
    const handleFirstGesture = () => {
      soundEngine.init();
      if (phase === 'title') {
        soundEngine.startHomeAmbientMusic();
      }
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [phase]);

  // Player Profile State (starts with local cache if valid)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (initialProgress.name && initialProgress.country) {
      return {
        name: initialProgress.name,
        country: initialProgress.country,
        flag: initialProgress.flag || '🇮🇳',
      };
    }
    return null;
  });

  // Registration modal is strictly suppressed while auth/cloud is resolving
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  // Canonical Player ID derived from authenticated Firebase UID
  const [canonicalPlayerId, setCanonicalPlayerId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('going_hop_canonical_uid') || getCanonicalPlayerId();
    } catch {
      return getCanonicalPlayerId();
    }
  });

  // Persistent Player Stats initialized from authoritative progress
  const [stats, setStats] = useState<GameStats>(() => {
    const targetLvl = LEVELS[initialProgress.selectedLevel - 1] || LEVELS[0];
    return {
      score: 0,
      totalCumulativeScore: initialProgress.score,
      coinsEarnedInLevel: 0,
      totalCoins: initialProgress.coins,
      totalGems: initialProgress.gems,
      gemsCollectedInLevel: 0,
      totalGemsInLevel: targetLvl.totalGems,
      combo: 0,
      maxCombo: 0,
      targetPadsCleared: 0,
      totalTargetPads: targetLvl.targetPadsCount,
      currentLevel: targetLvl.id,
      perfectHits: 0,
    };
  });

  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // Master Startup Sync & Authoritative Versioned Migration (v4)
  useEffect(() => {
    let isMounted = true;
    let docUnsubscribe: (() => void) | undefined;

    authReady.then(async (user) => {
      if (!isMounted) return;
      const uid = user ? user.uid : getCanonicalPlayerId();
      if (!uid) {
        setIsAuthLoading(false);
        return;
      }

      setCanonicalPlayerId(uid);
      try {
        localStorage.setItem('going_hop_canonical_uid', uid);
      } catch {
        // ignore
      }

      try {
        // 1. Fetch authoritative cloud player progress from /leaderboard/{uid}
        const local = loadLocalPlayerProgress(uid);
        // A local account cache is a durable offline save. Only compare it with
        // Firestore when the cache really exists; the default fallback has a
        // fresh timestamp and must not be mistaken for earned progress.
        let hasLocalCache = false;
        try {
          const cachedRaw = localStorage.getItem(`going_hop_account_${uid}`);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            hasLocalCache = Boolean(cached && cached.resetVersion === CURRENT_RESET_VERSION);
          }
        } catch {
          hasLocalCache = false;
        }

        let cloudProgress: PlayerProgressState | null = null;
        let cloudReadSucceeded = false;
        try {
          cloudProgress = await fetchCloudPlayerProgress(uid);
          cloudReadSucceeded = true;
        } catch (cloudReadError) {
          // Keep the last locally saved progress when offline or temporarily
          // unable to reach Firestore. Never replace it with clean defaults.
          console.warn('[App] Cloud progress unavailable; retaining UID-local progress.', cloudReadError);
        }

        let activeProgress: PlayerProgressState;

        const localIsNewer = Boolean(
          hasLocalCache &&
          local.updatedAt > 0 &&
          (!cloudProgress || local.updatedAt > cloudProgress.updatedAt)
        );

        if (localIsNewer) {
          activeProgress = { ...local, resetVersion: CURRENT_RESET_VERSION, profileVersion: PROFILE_SETUP_VERSION };
          saveLocalPlayerProgress(activeProgress, uid);
          // Reconcile offline-earned progress to the same authenticated cloud
          // document when a server read succeeded or a connection is available.
          if (cloudReadSucceeded) {
            try {
              await syncCloudPlayerProgress(uid, activeProgress);
            } catch (syncError) {
              console.warn('[App] Local progress retained; cloud reconciliation will retry later.', syncError);
            }
          }
        } else if (cloudProgress) {
          console.log('[App] Authoritative cloud player progress loaded:', cloudProgress);

          if (cloudProgress.resetVersion < CURRENT_RESET_VERSION) {
            // Versioned one-time migration for legacy test accounts to clean launch v4
            console.log(`[App] Account ${uid} is on legacy resetVersion ${cloudProgress.resetVersion}. Migrating to v${CURRENT_RESET_VERSION}...`);
            activeProgress = {
              name: cloudProgress.name || local.name || '',
              country: cloudProgress.country || local.country || '',
              flag: cloudProgress.flag || local.flag || '🇮🇳',
              gems: 0,
              coins: 0,
              score: 0,
              maxUnlockedLevel: 1,
              selectedLevel: 1,
              unlockedSkins: ['earth-ball'],
              selectedSkin: 'earth-ball',
              resetVersion: CURRENT_RESET_VERSION,
              hasRegisteredProfile: Boolean(cloudProgress.hasRegisteredProfile && cloudProgress.name && cloudProgress.country),
              profileVersion: PROFILE_SETUP_VERSION,
              updatedAt: Date.now(),
            };
            await syncCloudPlayerProgress(uid, activeProgress);
            saveLocalPlayerProgress(activeProgress, uid);
          } else {
            // Authoritative server state: adopt cloud state directly without stale localStorage resurrection
            activeProgress = {
              ...cloudProgress,
              resetVersion: CURRENT_RESET_VERSION,
              profileVersion: PROFILE_SETUP_VERSION,
            };
            saveLocalPlayerProgress(activeProgress, uid);
          }
        } else {
          // No cloud record: use an existing local account save if present.
          // Only a genuinely new account receives clean defaults.
          if (hasLocalCache) {
            activeProgress = { ...local, resetVersion: CURRENT_RESET_VERSION, profileVersion: PROFILE_SETUP_VERSION };
            saveLocalPlayerProgress(activeProgress, uid);
            if (cloudReadSucceeded) {
              try {
                await syncCloudPlayerProgress(uid, activeProgress);
              } catch (syncError) {
                console.warn('[App] Could not upload local-first progress yet:', syncError);
              }
            }
          } else {
            console.log(`[App] Fresh account detected for UID ${uid}. Initializing clean progression.`);
            activeProgress = getDefaultPlayerProgress(local.hasRegisteredProfile ? local : null);
            saveLocalPlayerProgress(activeProgress, uid);
          }
        }

        // Keep the saved selection and unlock ceiling consistent. A level that
        // was successfully selected/played on this account must not appear locked
        // in the level picker after returning from offline mode.
        const normalizedSelectedLevel = Math.max(1, Math.min(LEVELS.length, Number(activeProgress.selectedLevel) || 1));
        const normalizedMaxUnlockedLevel = Math.max(
          1,
          Math.min(LEVELS.length, Math.max(Number(activeProgress.maxUnlockedLevel) || 1, normalizedSelectedLevel))
        );
        const unlockedSkinsWithoutAds = activeProgress.unlockedSkins.filter((skinId) =>
          BALL_SKINS.some((skin) => skin.id === skinId && skin.unlockType !== 'ads')
        );
        const selectedSkinWithoutAds = BALL_SKINS.some((skin) =>
          skin.id === activeProgress.selectedSkin &&
          skin.unlockType !== 'ads' &&
          unlockedSkinsWithoutAds.includes(skin.id)
        ) ? activeProgress.selectedSkin : 'earth-ball';
        const hadLegacyAdSkinProgress =
          unlockedSkinsWithoutAds.length !== activeProgress.unlockedSkins.length ||
          selectedSkinWithoutAds !== activeProgress.selectedSkin;

        activeProgress = {
          ...activeProgress,
          selectedLevel: normalizedSelectedLevel,
          maxUnlockedLevel: normalizedMaxUnlockedLevel,
          unlockedSkins: unlockedSkinsWithoutAds,
          selectedSkin: selectedSkinWithoutAds,
        };
        saveLocalPlayerProgress(activeProgress, uid);
        if (cloudReadSucceeded && hadLegacyAdSkinProgress) {
          try {
            await syncCloudPlayerProgress(uid, activeProgress);
          } catch (syncError) {
            console.warn('[App] Could not reconcile removed legacy ad-skin unlocks yet:', syncError);
          }
        }
        if (cloudReadSucceeded && normalizedMaxUnlockedLevel > (cloudProgress?.maxUnlockedLevel || 1)) {
          try {
            await syncCloudPlayerProgress(uid, activeProgress);
          } catch (syncError) {
            console.warn('[App] Could not reconcile selected/unlocked level metadata yet:', syncError);
          }
        }

        if (!isMounted) return;

        // Apply active progress to React state
        const hasValidProfile = Boolean(
          activeProgress.hasRegisteredProfile &&
          activeProgress.name &&
          activeProgress.name.trim().length >= 2 &&
          activeProgress.country
        );

        if (hasValidProfile) {
          const profile: UserProfile = {
            name: activeProgress.name,
            country: activeProgress.country,
            flag: activeProgress.flag || '🇮🇳',
          };
          setUserProfile(profile);
          userProfileRef.current = profile;
        }

        // First launch profile setup requirement:
        // Must show if account has not completed v27 profile registration with name >= 2 chars & country
        const isProfileV27Done = localStorage.getItem(PROFILE_SETUP_KEY) === 'true';
        if (!isProfileV27Done || !hasValidProfile) {
          setShowProfileModal(true);
        } else {
          setShowProfileModal(false);
        }

        setMaxUnlockedLevel(activeProgress.maxUnlockedLevel);
        const restoredLevel = LEVELS[activeProgress.selectedLevel - 1] || LEVELS[0];
        setCurrentLevel(restoredLevel);
        currentLevelRef.current = restoredLevel;
        engineRef.current?.setLevel(restoredLevel, false);

        // Update skins
        BALL_SKINS.forEach((skin) => {
          skin.unlocked = activeProgress.unlockedSkins.includes(skin.id);
        });
        const activeSkin =
          BALL_SKINS.find((s) => s.id === activeProgress.selectedSkin) || BALL_SKINS[0];
        setCurrentSkin(activeSkin);
        currentSkinRef.current = activeSkin;
        engineRef.current?.setSkin(activeSkin);

        // Update stats
        const restoredStats: GameStats = {
          score: 0,
          totalCumulativeScore: activeProgress.score,
          coinsEarnedInLevel: 0,
          totalCoins: activeProgress.coins,
          totalGems: activeProgress.gems,
          gemsCollectedInLevel: 0,
          totalGemsInLevel: restoredLevel.totalGems,
          combo: 0,
          maxCombo: 0,
          targetPadsCleared: 0,
          totalTargetPads: restoredLevel.targetPadsCount,
          currentLevel: restoredLevel.id,
          perfectHits: 0,
        };
        setStats(restoredStats);
        statsRef.current = restoredStats;
        engineRef.current?.setAuthoritativeStats(restoredStats);

        lastSyncedGemsRef.current = activeProgress.gems;
        lastSyncedLevelRef.current = activeProgress.maxUnlockedLevel;
        lastSyncedScoreRef.current = activeProgress.score;

        // 2. Real-time document listener on /leaderboard/{uid}:
        // If another device with the SAME authenticated UID earns gems, unlocks level, or resets,
        // this device automatically synchronizes and updates UI instantly!
        docUnsubscribe = onSnapshot(
          doc(db, 'leaderboard', uid),
          (docSnap) => {
            if (!isMounted || !docSnap.exists()) return;
            const remoteData = docSnap.data();
            if (!remoteData) return;

            // Only process updates from other devices (remote server commits)
            if (docSnap.metadata.hasPendingWrites) return;

            const remoteGems = typeof remoteData.gems === 'number' ? remoteData.gems : 0;
            const remoteCoins = typeof remoteData.coins === 'number' ? remoteData.coins : 0;
            const rawLvl = typeof remoteData.maxUnlockedLevel === 'number' ? remoteData.maxUnlockedLevel : typeof remoteData.level === 'number' ? remoteData.level : 1;
            const remoteSelectedLevel = Math.max(1, Math.min(LEVELS.length, Number(remoteData.selectedLevel) || 1));
            const remoteMaxLevel = Math.max(1, Math.min(LEVELS.length, Math.max(rawLvl >= 9999 ? 1 : rawLvl, remoteSelectedLevel)));
            const remoteScore = typeof remoteData.score === 'number' ? remoteData.score : 0;
            const remoteUpdatedAt = typeof remoteData.updatedAt === 'number' ? remoteData.updatedAt : 0;
            const localProgress = loadLocalPlayerProgress(uid);
            let localCacheExists = false;
            try {
              const raw = localStorage.getItem(`going_hop_account_${uid}`);
              if (raw) localCacheExists = JSON.parse(raw)?.resetVersion === CURRENT_RESET_VERSION;
            } catch {
              localCacheExists = false;
            }
            // Ignore stale cloud snapshots while this device has newer offline
            // progress. Startup reconciliation will upload that local state.
            if (localCacheExists && localProgress.updatedAt > remoteUpdatedAt) return;

            const current = statsRef.current;
            if (remoteGems !== current.totalGems || remoteCoins !== current.totalCoins || remoteMaxLevel !== maxUnlockedLevel) {
              console.log('[App] Remote cloud document update received for this UID:', remoteData);
              setMaxUnlockedLevel(remoteMaxLevel);
              const updatedStats: GameStats = {
                ...current,
                totalGems: remoteGems,
                totalCoins: remoteCoins,
                totalCumulativeScore: remoteScore,
              };
              setStats(updatedStats);
              statsRef.current = updatedStats;
              lastSyncedGemsRef.current = remoteGems;
              lastSyncedLevelRef.current = remoteMaxLevel;
              lastSyncedScoreRef.current = remoteScore;

              saveLocalPlayerProgress({
                gems: remoteGems,
                coins: remoteCoins,
                score: remoteScore,
                maxUnlockedLevel: remoteMaxLevel,
                selectedLevel: Math.max(1, Math.min(LEVELS.length, Number(remoteData.selectedLevel) || remoteMaxLevel)),
                unlockedSkins: Array.isArray(remoteData.unlockedSkins) ? remoteData.unlockedSkins : localProgress.unlockedSkins,
                selectedSkin: typeof remoteData.selectedSkin === 'string' ? remoteData.selectedSkin : localProgress.selectedSkin,
              }, uid);
            }
          },
          (err) => {
            console.warn('[App] Real-time document sync notice:', err);
          }
        );
      } catch (err) {
        console.warn('[App] Cloud startup read unavailable; restoring UID-scoped local progress:', err);
        // Offline/error is NOT the same as a new account. Keep the last local save
        // and do not write default values to Firestore from this fallback path.
        const cached = loadLocalPlayerProgress(uid);
        if (isMounted) {
          const safeLevel = LEVELS[cached.selectedLevel - 1] || LEVELS[0];
          setMaxUnlockedLevel(cached.maxUnlockedLevel);
          setCurrentLevel(safeLevel);
          currentLevelRef.current = safeLevel;
          engineRef.current?.setLevel(safeLevel, false);
          BALL_SKINS.forEach((skin) => { skin.unlocked = cached.unlockedSkins.includes(skin.id); });
          const cachedSkin = BALL_SKINS.find((skin) => skin.id === cached.selectedSkin) || BALL_SKINS[0];
          setCurrentSkin(cachedSkin);
          currentSkinRef.current = cachedSkin;
          engineRef.current?.setSkin(cachedSkin);
          const restoredStats: GameStats = {
            score: 0, totalCumulativeScore: cached.score, coinsEarnedInLevel: 0,
            totalCoins: cached.coins, totalGems: cached.gems, gemsCollectedInLevel: 0,
            totalGemsInLevel: safeLevel.totalGems, combo: 0, maxCombo: 0,
            targetPadsCleared: 0, totalTargetPads: safeLevel.targetPadsCount,
            currentLevel: safeLevel.id, perfectHits: 0,
          };
          setStats(restoredStats);
          statsRef.current = restoredStats;
          engineRef.current?.setAuthoritativeStats(restoredStats);
          if (cached.name && cached.country) {
            const profile = { name: cached.name, country: cached.country, flag: cached.flag || '🇮🇳' };
            setUserProfile(profile);
            userProfileRef.current = profile;
          }
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      if (docUnsubscribe) docUnsubscribe();
    };
  }, []);

  // Fetch daily challenge status from Firebase whenever UID or UTC date changes
  useEffect(() => {
    authReady.then((user) => {
      const uid = user ? user.uid : (canonicalPlayerId || getCanonicalPlayerId());
      if (uid) {
        setIsLoadingDailyStatus(true);
        fetchDailyRewardStatus(uid, currentUtcDate)
          .then((status) => {
            setDailyStatus(status);
          })
          .catch((err) => {
            console.warn('[DailyChallenge] Initial status load notice:', err);
          })
          .finally(() => {
            setIsLoadingDailyStatus(false);
          });
      } else {
        setIsLoadingDailyStatus(false);
      }
    });
  }, [canonicalPlayerId, currentUtcDate]);

  // Automatic Daily Reset: Checks for UTC date rollover every 10 seconds (Requirement 5)
  useEffect(() => {
    const checkDateRollover = () => {
      const today = getTodayUtcDateString();
      if (today !== currentUtcDate) {
        console.log(`[DailyChallenge] Date rollover detected: ${currentUtcDate} -> ${today}. Resetting eligibility.`);
        setCurrentUtcDate(today);
        const uid = canonicalPlayerId || getCanonicalPlayerId();
        if (uid) {
          fetchDailyRewardStatus(uid, today).then((res) => {
            setDailyStatus(res);
          });
        }
      }
    };

    const timer = setInterval(checkDateRollover, 10000);
    return () => clearInterval(timer);
  }, [currentUtcDate, canonicalPlayerId]);

  // Real Shared Multi-Device Firestore Global Leaderboard
  const [serverLeaderboard, setServerLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState<boolean>(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  // Sync locks, debounce, and high-water mark protection
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef<{ score?: number; level?: number; gems?: number; force?: boolean } | null>(null);
  const lastSyncedGemsRef = useRef<number>(-1);
  const lastSyncedLevelRef = useRef<number>(-1);
  const lastSyncedScoreRef = useRef<number>(-1);
  const lastSyncTimeRef = useRef<number>(0);

  const syncPlayerScoreToServer = useCallback(
    async (scoreToSync?: number, levelToSync?: number, gemsToSync?: number, forceSync?: boolean) => {
      const profile = userProfileRef.current;
      if (!profile || !profile.name.trim()) return;

      if (isSyncingRef.current) {
        pendingSyncRef.current = { score: scoreToSync, level: levelToSync, gems: gemsToSync, force: forceSync };
        return;
      }

      isSyncingRef.current = true;
      try {
        const user = await authReady;
        const uid = auth.currentUser?.uid || user?.uid;
        if (!uid || !auth.currentUser) {
          console.warn('[Firebase Diag] Skip sync: No authenticated canonical UID present yet.');
          return;
        }

        const curStats = statsRef.current;
        const rawGems = typeof gemsToSync === 'number' ? gemsToSync : curStats.totalGems;
        const rawScore = typeof scoreToSync === 'number' ? scoreToSync : curStats.totalCumulativeScore;
        const rawLevel = typeof levelToSync === 'number' && levelToSync < 9999 ? levelToSync : maxUnlockedLevel;

        const effectiveGems = Math.max(0, Math.min(10000000, isNaN(rawGems) ? 0 : rawGems));
        const effectiveScore = Math.max(0, Math.min(50000000, isNaN(rawScore) ? 0 : rawScore));
        const effectiveLevel = Math.max(1, Math.min(LEVELS.length, isNaN(rawLevel) ? 1 : rawLevel));

        const finalGems = forceSync ? effectiveGems : Math.max(effectiveGems, lastSyncedGemsRef.current);
        const prevLevelClean =
          lastSyncedLevelRef.current < 9999 && lastSyncedLevelRef.current <= LEVELS.length
            ? lastSyncedLevelRef.current
            : 1;
        const finalLevel = forceSync ? effectiveLevel : Math.max(effectiveLevel, prevLevelClean);
        const finalScore = forceSync ? effectiveScore : Math.max(effectiveScore, lastSyncedScoreRef.current);

        const now = Date.now();
        if (
          !forceSync &&
          finalGems === lastSyncedGemsRef.current &&
          finalLevel === lastSyncedLevelRef.current &&
          finalScore === lastSyncedScoreRef.current &&
          now - lastSyncTimeRef.current < 10000
        ) {
          return;
        }

        const selectedLvl = currentLevelRef.current.id === 9999 ? finalLevel : currentLevelRef.current.id;
        const unlockedSkinsList = BALL_SKINS.filter((s) => s.unlocked).map((s) => s.id);
        if (!unlockedSkinsList.includes('earth-ball')) unlockedSkinsList.unshift('earth-ball');

        const progressPayload: PlayerProgressState = {
          name: profile.name.trim().slice(0, 50),
          country: (profile.country || 'India').slice(0, 64),
          flag: (profile.flag || '🇮🇳').slice(0, 16),
          gems: finalGems,
          coins: Math.max(0, curStats.totalCoins),
          score: finalScore,
          maxUnlockedLevel: finalLevel,
          selectedLevel: Math.max(1, Math.min(LEVELS.length, selectedLvl)),
          unlockedSkins: unlockedSkinsList,
          selectedSkin: currentSkinRef.current.id,
          resetVersion: CURRENT_RESET_VERSION,
          updatedAt: now,
        };

        saveLocalPlayerProgress(progressPayload, uid);
        await syncCloudPlayerProgress(uid, progressPayload);

        lastSyncedGemsRef.current = finalGems;
        lastSyncedLevelRef.current = finalLevel;
        lastSyncedScoreRef.current = finalScore;
        lastSyncTimeRef.current = now;
      } catch (err) {
        console.error('[Firebase Diag] Leaderboard sync error to Firestore:', err);
      } finally {
        isSyncingRef.current = false;
        if (pendingSyncRef.current) {
          const next = pendingSyncRef.current;
          pendingSyncRef.current = null;
          syncPlayerScoreToServer(next.score, next.level, next.gems, next.force);
        }
      }
    },
    [canonicalPlayerId, maxUnlockedLevel]
  );

  const syncRef = useRef(syncPlayerScoreToServer);
  syncRef.current = syncPlayerScoreToServer;

  // Once connectivity returns, retry syncing the current UID-scoped local
  // progress. This also covers a startup where Firestore could not be read.
  useEffect(() => {
    if (!isOnline || isAuthLoading || !canonicalPlayerId || !userProfileRef.current) return;
    void syncRef.current(undefined, undefined, undefined, true);
  }, [isOnline, isAuthLoading, canonicalPlayerId]);

  // Real-time Firestore subscription with automatic deduplication & legacy consolidation
  // (only active while the leaderboard screen is open, to keep the game smooth)
  useEffect(() => {
    if (!showLeaderboard) return;

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;
    setLeaderboardError(null);
    setIsLeaderboardLoading(true);

    const timeoutTimer = setTimeout(() => {
      if (isMounted && isLeaderboardLoading) {
        console.warn('[Firebase Diag] Leaderboard loading timeout hit (6s). Clearing loading state.');
        setIsLeaderboardLoading(false);
      }
    }, 6000);

    authReady.then((user) => {
      if (!isMounted) return;

      if (!user) {
        clearTimeout(timeoutTimer);
        setIsLeaderboardLoading(false);
        const authErr = getAuthError();
        if (authErr?.code === 'auth/admin-restricted-operation' || authErr?.message?.includes('admin-restricted-operation')) {
          setLeaderboardError('Anonymous Authentication is disabled in Firebase Console.');
        } else {
          setLeaderboardError('Firebase Authentication initializing... check network connection.');
        }
        return;
      }

      setCanonicalPlayerId(user.uid);
      try {
        localStorage.setItem('going_hop_canonical_uid', user.uid);
      } catch {
        // ignore
      }

      console.log('[Firebase Diag] Subscribing to Firestore collection "leaderboard"...');
      const q = collection(db, 'leaderboard');
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          clearTimeout(timeoutTimer);

          const currentUid = user.uid;
          const currentProfile = userProfileRef.current;

          // Build canonical records map keyed strictly by authenticated UID (one entry per real account)
          const canonicalMap = new Map<string, LeaderboardEntry>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data) return;
            const docId = docSnap.id;

            // STRICTLY IGNORE legacy unauthenticated documents ('player_...') or test markers
            if (docId.startsWith('player_') || docId.includes('_legacy_')) {
              return;
            }

            const rawName = typeof data.name === 'string' ? data.name.trim() : '';
            // Only genuine players who have completed profile setup (name >= 2 chars)
            if (rawName.length < 2) return;

            const rawCountry = typeof data.country === 'string' ? data.country.trim() : '';
            if (!rawCountry) return;

            // Only include accounts on current clean launch version (v4) with registered profile
            const resetVer = typeof data.resetVersion === 'number' ? data.resetVersion : 0;
            if (resetVer < CURRENT_RESET_VERSION) {
              return;
            }

            const entryGems = typeof data.gems === 'number' && !isNaN(data.gems) ? Math.max(0, data.gems) : 0;
            const rawDocLevel =
              typeof data.maxUnlockedLevel === 'number' && !isNaN(data.maxUnlockedLevel)
                ? data.maxUnlockedLevel
                : typeof data.level === 'number' && !isNaN(data.level)
                ? data.level
                : 1;
            const entryLevel =
              rawDocLevel >= 9999 || rawDocLevel > LEVELS.length ? 1 : Math.max(1, rawDocLevel);
            const entryScore = typeof data.score === 'number' && !isNaN(data.score) ? Math.max(0, data.score) : 0;
            const entryUpdatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : 0;

            canonicalMap.set(docId, {
              id: docId,
              name: rawName.slice(0, 50),
              country: rawCountry.slice(0, 64),
              flag: typeof data.flag === 'string' && data.flag.trim() ? data.flag.trim().slice(0, 16) : '🇮🇳',
              gems: entryGems,
              score: entryScore,
              level: entryLevel,
              updatedAt: entryUpdatedAt,
              rank: 1,
              isCurrentUser: docId === currentUid,
            });
          });

          // Update current player's profile metadata in map if present
          const existingCanonical = canonicalMap.get(currentUid);
          if (existingCanonical && currentProfile?.name?.trim()) {
            existingCanonical.name = currentProfile.name.trim().slice(0, 50);
            existingCanonical.country = (currentProfile.country || existingCanonical.country).slice(0, 64);
            existingCanonical.flag = (currentProfile.flag || existingCanonical.flag).slice(0, 16);
            canonicalMap.set(currentUid, existingCanonical);
          }

          // Deterministic Sort & Tie-Breaking across canonical accounts:
          // 1. Total Gems Collected (descending)
          // 2. Max Level reached (descending)
          // 3. Cumulative Score (descending)
          // 4. Earlier achievement updatedAt (ascending)
          // 5. Stable string comparison of canonical UID (deterministic)
          const sortedList = Array.from(canonicalMap.values()).sort((a, b) => {
            const gemsDiff = (b.gems || 0) - (a.gems || 0);
            if (gemsDiff !== 0) return gemsDiff;

            const levelDiff = (b.level || 0) - (a.level || 0);
            if (levelDiff !== 0) return levelDiff;

            const scoreDiff = (b.score || 0) - (a.score || 0);
            if (scoreDiff !== 0) return scoreDiff;

            const timeDiff = (a.updatedAt || 0) - (b.updatedAt || 0);
            if (timeDiff !== 0) return timeDiff;

            return a.id.localeCompare(b.id);
          });

          // Sequentially assign ranks strictly after canonical deduplication
          const formatted: LeaderboardEntry[] = sortedList.map((item, idx) => ({
            ...item,
            rank: idx + 1,
            isCurrentUser: item.id === currentUid,
          }));

          setServerLeaderboard(formatted);
          setIsLeaderboardLoading(false);
          setLeaderboardError(null);
        },
        (error) => {
          if (!isMounted) return;
          clearTimeout(timeoutTimer);
          console.error('[Firebase Diag] Firestore Leaderboard subscription error:', error);
          setIsLeaderboardLoading(false);
          setLeaderboardError(error.message || String(error));
        }
      );
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
      if (unsubscribe) unsubscribe();
    };
  }, [showLeaderboard]);

  // First launch after update: prompt profile registration if not yet completed
  useEffect(() => {
    if (!isAuthLoading) {
      const isDone = localStorage.getItem(PROFILE_SETUP_KEY) === 'true';
      if (!isDone) {
        setShowProfileModal(true);
      }
    }
  }, [isAuthLoading]);

  // Initialize GameEngine ONCE - NEVER destroyed mid-game!
  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new GameEngine(mountRef.current, {
      onStatsUpdate: (newStats) => {
        const prevGems = statsRef.current.totalGems;
        setStats({ ...newStats });
        statsRef.current = { ...newStats };
        if (newStats.totalGems > prevGems) {
          const safeLvl = isDailyChallengeRef.current ? maxUnlockedLevel : Math.min(LEVELS.length, newStats.currentLevel);
          syncRef.current(newStats.totalCumulativeScore, safeLvl, newStats.totalGems);
        }
      },
      onGameOver: async (finalStats) => {
        const snap = { ...finalStats };
        const activeLvl = currentLevelRef.current;

        // Daily Challenge race completion branch: player fell to abyss before finishing
        if (activeLvl.id === 9999 || isDailyChallengeRef.current) {
          await handleDailyRaceFell(snap);
          return;
        }

        setGameOverModalData({ stats: snap, level: activeLvl });
        setStats(snap);
        statsRef.current = snap;
        setPhase('gameover');
        syncRef.current(finalStats.totalCumulativeScore, maxUnlockedLevel, finalStats.totalGems);
      },
      onVictory: async (finalStats) => {
        const snap = { ...finalStats };
        const completedLevel = currentLevelRef.current;

        // Daily Challenge race completion branch: player reached goal in actual finish order!
        if (completedLevel.id === 9999 || isDailyChallengeRef.current) {
          const position = snap.racePosition || 1;
          await handleCompleteDailyRace(snap, position);
          return;
        }

        setVictoryModalData({ stats: snap, level: completedLevel });
        setStats(snap);
        statsRef.current = snap;
        engineRef.current?.setAuthoritativeStats(snap);

        const nextLevelId = Math.min(LEVELS.length, completedLevel.id + 1);
        const updatedMax = Math.max(maxUnlockedLevel, nextLevelId);
        setMaxUnlockedLevel(updatedMax);

        // Auto-select the next unlocked level as active level
        const nextLevel = LEVELS[nextLevelId - 1];
        setCurrentLevel(nextLevel);
        currentLevelRef.current = nextLevel;
        engineRef.current?.setLevel(nextLevel, false);

        saveLocalPlayerProgress({
          maxUnlockedLevel: updatedMax,
          selectedLevel: nextLevelId,
          gems: snap.totalGems,
          coins: snap.totalCoins,
          score: snap.totalCumulativeScore,
        }, canonicalPlayerId);

        syncRef.current(finalStats.totalCumulativeScore, updatedMax, finalStats.totalGems);

        // When Level 2 is completed for the first time, ask user for star review!
        const shouldShowReview = completedLevel.id === 2 && !localStorage.getItem('going_hop_reviewed_v22');

        setPhase('victory');

        // Ads are temporarily disabled. Keep the existing review prompt flow.
        if (shouldShowReview) {
          window.setTimeout(() => setShowReviewModal(true), 500);
        }
      },
      onPhaseChange: (newPhase) => {
        setPhase(newPhase);
      },
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Let Three.js handle WebGL context restoration. Do not reload the whole
  // WebView after an ad closes: that can tear down the game and appear as a crash.
  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const onContextRestored = () => {
      // Recalculate the drawing size after Android returns from the native ad screen.
      window.dispatchEvent(new Event('resize'));
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        window.dispatchEvent(new Event('resize'));
      }
    };

    host.addEventListener('webglcontextrestored', onContextRestored, true);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      host.removeEventListener('webglcontextrestored', onContextRestored, true);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const handleCompleteDailyRace = (finalStats: GameStats, position: number) => {
    const todayDate = currentUtcDate;
    console.log(`[DailyChallenge] Completing race on ${todayDate}. Position: ${position}`);

    // 1. Immediately transition UI with zero delay / zero freeze on target pad!
    setStats((prev) => ({
      ...prev,
      score: finalStats.score,
      targetPadsCleared: finalStats.targetPadsCleared,
    }));

    setDailyRaceResultsData({
      stats: finalStats,
      racePosition: position,
      gemsAwarded: 0,
      wasFirstRaceToday: false,
      playerFell: false,
    });

    setPhase('victory');
    setShowDailyRaceResultsModal(true);

    // 2. Perform reward claim transaction asynchronously in the background
    authReady.then(async (user) => {
      const uid = user ? user.uid : (canonicalPlayerId || getCanonicalPlayerId() || 'anonymous');
      try {
        const claimRes = await claimDailyRewardTransaction(
          uid,
          todayDate,
          position,
          statsRef.current.totalGems
        );

        const gemsAwarded = claimRes.gemsAwarded;
        const wasFirstRaceToday = !claimRes.alreadyClaimed && gemsAwarded > 0;

        if (gemsAwarded > 0) {
          const updatedTotalGems = claimRes.newTotalGems;
          setStats((prev) => ({
            ...prev,
            totalGems: updatedTotalGems,
          }));
          statsRef.current.totalGems = updatedTotalGems;
          syncPlayerScoreToServer(finalStats.totalCumulativeScore, undefined, updatedTotalGems, true);
          soundEngine.playLevelComplete();
        }

        setDailyStatus({
          date: todayDate,
          isClaimed: true,
          gemsAwarded: claimRes.alreadyClaimed ? (dailyStatus?.gemsAwarded ?? gemsAwarded) : gemsAwarded,
          position,
          claimedAt: Date.now(),
        });

        setDailyRaceResultsData((prev) =>
          prev
            ? {
                ...prev,
                gemsAwarded,
                wasFirstRaceToday,
              }
            : null
        );
      } catch (err) {
        console.warn('[DailyChallenge] Background reward claim note:', err);
      }
    });
  };

  const handleDailyRaceFell = async (finalStats: GameStats) => {
    console.log('[DailyChallenge] Player fell in Daily Race.');
    soundEngine.playMiss();
    const position = finalStats.racePosition || 3;

    setStats((prev) => ({
      ...prev,
      score: finalStats.score,
      targetPadsCleared: finalStats.targetPadsCleared,
    }));

    setDailyRaceResultsData({
      stats: finalStats,
      racePosition: position,
      gemsAwarded: 0,
      wasFirstRaceToday: false,
      playerFell: true,
    });

    setPhase('gameover');
    setShowDailyRaceResultsModal(true);
  };

  const handleStartDailyRace = () => {
    console.log('[App] Starting Daily Challenge race...');
    setShowDailyChallengeModal(false);
    setShowDailyRaceResultsModal(false);
    setDailyRaceResultsData(null);
    setIsDailyChallenge(true);
    isDailyChallengeRef.current = true;
    setPhase('playing');
    const dailyLevel = getDailyChallengeLevel(currentUtcDate);
    setCurrentLevel(dailyLevel);
    engineRef.current?.setLevel(dailyLevel, false);
    engineRef.current?.startGame();
  };

  const handleReplayDailyRace = () => {
    console.log('[App] Replaying Daily Challenge race (Unlimited)...');
    setShowDailyRaceResultsModal(false);
    setDailyRaceResultsData(null);
    setIsDailyChallenge(true);
    isDailyChallengeRef.current = true;
    setPhase('playing');
    const dailyLevel = getDailyChallengeLevel(currentUtcDate);
    setCurrentLevel(dailyLevel);
    engineRef.current?.setLevel(dailyLevel, false);
    engineRef.current?.restartCurrentLevel();
  };

  const handleStartGame = () => {
    engineRef.current?.setAuthoritativeStats(statsRef.current);
    if (isDailyChallenge || currentLevel.id === 9999) {
      handleStartDailyRace();
    } else {
      setIsDailyChallenge(false);
      isDailyChallengeRef.current = false;
      engineRef.current?.startGame();
    }
  };

  const handlePlayAgain = () => {
    const lvl = (phase === 'victory' ? victoryModalData?.level : gameOverModalData?.level) ?? currentLevel;
    setCurrentLevel(lvl);
    engineRef.current?.setLevel(lvl, false);
    engineRef.current?.setAuthoritativeStats(statsRef.current);
    engineRef.current?.startGame();
  };

  const handleRestartLevel = () => {
    const lvl = (phase === 'victory' ? victoryModalData?.level : gameOverModalData?.level) ?? currentLevel;
    setCurrentLevel(lvl);
    engineRef.current?.setLevel(lvl, false);
    engineRef.current?.setAuthoritativeStats(statsRef.current);
    engineRef.current?.restartCurrentLevel();
  };

  const handleNextLevel = () => {
    const fromLevel = victoryModalData?.level ?? currentLevel;
    const nextIdx = fromLevel.id; // fromLevel.id is 1-indexed, next level is LEVELS[nextIdx]
    if (nextIdx < LEVELS.length) {
      const nextLvl = LEVELS[nextIdx];
      setCurrentLevel(nextLvl);
      currentLevelRef.current = nextLvl;
      saveLocalPlayerProgress({ selectedLevel: nextLvl.id }, canonicalPlayerId);
      engineRef.current?.setLevel(nextLvl, false);
      engineRef.current?.setAuthoritativeStats(statsRef.current);
      engineRef.current?.startGame();
    } else {
      handleGoHome();
    }
  };

  const handleGoHome = () => {
    console.log('[App] Navigating to Main Menu / Title screen...');
    setShowDailyChallengeModal(false);
    setShowDailyRaceResultsModal(false);
    setDailyRaceResultsData(null);
    setIsDailyChallenge(false);
    isDailyChallengeRef.current = false;

    // Restore legitimate campaign level (NEVER retain level 9999 from Daily Race)
    const local = loadLocalPlayerProgress(canonicalPlayerId);
    const targetLevelId = Math.max(1, Math.min(LEVELS.length, maxUnlockedLevel));
    saveLocalPlayerProgress({ selectedLevel: targetLevelId }, canonicalPlayerId);
    const regularLevel = LEVELS.find((l) => l.id === targetLevelId) || LEVELS[0];
    setCurrentLevel(regularLevel);
    currentLevelRef.current = regularLevel;
    engineRef.current?.setLevel(regularLevel, false);
    engineRef.current?.setAuthoritativeStats(statsRef.current);

    engineRef.current?.resetGame();
    setPhase('title');
  };

  const handleTogglePause = () => {
    engineRef.current?.togglePause();
  };

  const handleSelectLevel = (level: LevelConfig) => {
    if (level.id <= maxUnlockedLevel) {
      setIsDailyChallenge(false);
      isDailyChallengeRef.current = false;
      setCurrentLevel(level);
      currentLevelRef.current = level;
      saveLocalPlayerProgress({ selectedLevel: level.id }, canonicalPlayerId);
      engineRef.current?.setLevel(level);
      syncRef.current(stats.totalCumulativeScore, maxUnlockedLevel, stats.totalGems);
    }
  };

  const handleSelectSkin = (skin: BallSkin) => {
    setCurrentSkin(skin);
    currentSkinRef.current = skin;
    saveLocalPlayerProgress({ selectedSkin: skin.id }, canonicalPlayerId);
    engineRef.current?.setSkin(skin);
    syncRef.current(stats.totalCumulativeScore, maxUnlockedLevel, stats.totalGems);
  };

  // Unlock Skin using Gold Coins
  const handleUnlockSkin = (skin: BallSkin) => {
    const cost = skin.costCoins ?? skin.cost ?? 150;
    if (stats.totalCoins < cost) {
      soundEngine.playMiss();
      return;
    }

    const grantSkin = () => {
      skin.unlocked = true;
      const updatedCoins = stats.totalCoins - cost;
      const updatedStats = { ...stats, totalCoins: updatedCoins };
      setStats(updatedStats);
      statsRef.current = updatedStats;

      const unlockedList = BALL_SKINS.filter((s) => s.unlocked).map((s) => s.id);
      if (!unlockedList.includes(skin.id)) unlockedList.push(skin.id);
      saveLocalPlayerProgress({
        coins: updatedCoins,
        unlockedSkins: unlockedList,
        selectedSkin: skin.id,
      }, canonicalPlayerId);

      handleSelectSkin(skin);
      soundEngine.playGemCollect();
    };

    // A coin purchase is an in-game transaction, not an ad reward.
    // Do not gate it behind the fake/demo ad screen.
    grantSkin();
  };

  const handleResetProgression = useCallback(async () => {
    console.log('[App] Resetting game progression to clean fresh start...');
    const user = await authReady;
    const uid = auth.currentUser?.uid || user?.uid;
    if (uid && auth.currentUser) {
      await executeOneTimeTestReset(uid, userProfileRef.current);
    } else {
      BALL_SKINS.forEach((skin) => {
        skin.unlocked = skin.id === 'earth-ball';
        skin.adsWatched = 0;
      });
      saveLocalPlayerProgress(getDefaultPlayerProgress(userProfileRef.current));
      localStorage.setItem(RESET_VERSION_KEY, 'true');
    }

    const defaultSkin = BALL_SKINS[0];
    setCurrentSkin(defaultSkin);
    currentSkinRef.current = defaultSkin;
    engineRef.current?.setSkin(defaultSkin);

    setMaxUnlockedLevel(1);
    const firstLevel = LEVELS[0];
    setCurrentLevel(firstLevel);
    currentLevelRef.current = firstLevel;
    setIsDailyChallenge(false);
    isDailyChallengeRef.current = false;
    engineRef.current?.setLevel(firstLevel);
    engineRef.current?.resetGame();

    const resetStatsPayload: GameStats = {
      score: 0,
      totalCumulativeScore: 0,
      coinsEarnedInLevel: 0,
      totalCoins: 0,
      totalGems: 0,
      gemsCollectedInLevel: 0,
      totalGemsInLevel: firstLevel.totalGems,
      combo: 0,
      maxCombo: 0,
      targetPadsCleared: 0,
      totalTargetPads: firstLevel.targetPadsCount,
      currentLevel: 1,
      perfectHits: 0,
    };
    setStats(resetStatsPayload);
    statsRef.current = resetStatsPayload;

    lastSyncedGemsRef.current = 0;
    lastSyncedLevelRef.current = 1;
    lastSyncedScoreRef.current = 0;

    setShowProfileModal(false);
    setPhase('title');
  }, []);

  const handleSaveProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    userProfileRef.current = profile;
    setShowProfileModal(false);
    localStorage.setItem(PROFILE_SETUP_KEY, 'true');
    const user = await authReady;
    const uid = auth.currentUser?.uid || user?.uid || canonicalPlayerId;
    saveLocalPlayerProgress({
      name: profile.name,
      country: profile.country,
      flag: profile.flag,
      hasRegisteredProfile: true,
      profileVersion: PROFILE_SETUP_VERSION,
    }, uid);
    if (uid && auth.currentUser) {
      const curStats = statsRef.current;
      const progressPayload: PlayerProgressState = {
        name: profile.name,
        country: profile.country,
        flag: profile.flag,
        gems: curStats.totalGems,
        coins: curStats.totalCoins,
        score: curStats.totalCumulativeScore,
        maxUnlockedLevel: maxUnlockedLevel,
        selectedLevel: currentLevelRef.current.id === 9999 ? maxUnlockedLevel : currentLevelRef.current.id,
        unlockedSkins: BALL_SKINS.filter((s) => s.unlocked).map((s) => s.id),
        selectedSkin: currentSkinRef.current.id,
        resetVersion: CURRENT_RESET_VERSION,
        hasRegisteredProfile: true,
        profileVersion: PROFILE_SETUP_VERSION,
        updatedAt: Date.now(),
      };
      await syncCloudPlayerProgress(uid, progressPayload);
      lastSyncedGemsRef.current = curStats.totalGems;
      lastSyncedLevelRef.current = maxUnlockedLevel;
      lastSyncedScoreRef.current = curStats.totalCumulativeScore;
    }
  };

  return (
    <div 
      className="relative w-screen h-[100dvh] min-h-0 overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${currentLevel.bgTop}, ${currentLevel.bgBottom})` }}
    >
      {/* Cloud & Auth Syncing Splash Screen */}
      {isAuthLoading && (
        <div className="absolute inset-0 z-50 bg-[#0c031c] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center mb-4 shadow-[0_0_35px_rgba(0,240,255,0.4)] animate-pulse">
            <span className="text-3xl">⚡</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.25em] uppercase mb-5 drop-shadow-[0_0_16px_rgba(0,240,255,0.7)]">
            NEON RUSH
          </h2>
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      )}

      {/* Three.js Isolated Canvas Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Title Screen Overlay */}
      {phase === 'title' && (
        <TitleScreen
          currentLevel={currentLevel}
          maxUnlockedLevel={maxUnlockedLevel}
          userProfile={userProfile}
          onSelectLevel={handleSelectLevel}
          onStartGame={handleStartGame}
          onOpenShop={() => setShowShop(true)}
          onOpenLeaderboard={() => {
            setShowLeaderboard(true);
            syncPlayerScoreToServer().catch((err) => console.warn('Background sync note:', err));
          }}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenDailyChallenge={() => setShowDailyChallengeModal(true)}
          dailyStatus={dailyStatus}
          currentSkin={currentSkin}
          totalGems={stats.totalGems}
          totalCoins={stats.totalCoins}
          isDailyChallenge={isDailyChallenge || currentLevel.id === 9999}
        />
      )}

      {/* In-Game Active HUD Overlay */}
      {(phase === 'playing' || phase === 'paused') && (
        <GameHUD
          stats={stats}
          currentLevel={currentLevel}
          isPaused={phase === 'paused'}
          onTogglePause={handleTogglePause}
          onRestartLevel={handleRestartLevel}
          onGoHome={handleGoHome}
          onSteerLeft={() => engineRef.current?.steerLeft()}
          onSteerRight={() => engineRef.current?.steerRight()}
          onJump={() => engineRef.current?.jump()}
        />
      )}

      {/* Standard Game Over / Victory Modal (Only shown for non-Daily Challenge runs) */}
      {(phase === 'gameover' || phase === 'victory') && !isDailyChallenge && (
        <GameOverModal
          stats={
            phase === 'victory'
              ? victoryModalData?.stats || stats
              : gameOverModalData?.stats || stats
          }
          currentLevel={
            phase === 'victory'
              ? victoryModalData?.level || currentLevel
              : gameOverModalData?.level || currentLevel
          }
          isVictory={phase === 'victory'}
          onPlayAgain={handlePlayAgain}
          onNextLevel={
            (phase === 'victory'
              ? victoryModalData?.level || currentLevel
              : currentLevel
            ).id < LEVELS.length
              ? handleNextLevel
              : undefined
          }
          onGoHome={handleGoHome}
        />
      )}

      {/* Daily Challenge Overview Modal */}
      {showDailyChallengeModal && (
        <DailyChallengeModal
          isOpen={showDailyChallengeModal}
          onClose={() => setShowDailyChallengeModal(false)}
          onStartDailyRace={handleStartDailyRace}
          status={dailyStatus}
          isLoadingStatus={isLoadingDailyStatus}
        />
      )}

      {/* Daily Race Results Modal (Podium, Gems, and Repeat Race message) */}
      {showDailyRaceResultsModal && dailyRaceResultsData && (
        <DailyRaceResultsModal
          stats={dailyRaceResultsData.stats}
          racePosition={dailyRaceResultsData.racePosition}
          gemsAwarded={dailyRaceResultsData.gemsAwarded}
          wasFirstRaceToday={dailyRaceResultsData.wasFirstRaceToday}
          playerFell={dailyRaceResultsData.playerFell}
          onRaceAgain={handleReplayDailyRace}
          onGoHome={handleGoHome}
        />
      )}

      {/* Ball Skin Shop Modal (10 skins, 5 via ads) */}
      {showShop && (
        <SkinShopModal
          currentSkin={currentSkin}
          totalCoins={stats.totalCoins}
          onSelectSkin={handleSelectSkin}
          onUnlockSkin={handleUnlockSkin}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* Real Multi-Device Global Leaderboard Modal (ZERO Fake Gamers) */}
      {showLeaderboard && (
        <LeaderboardModal
          entries={serverLeaderboard}
          loading={isLeaderboardLoading}
          error={leaderboardError}
          userProfile={userProfile}
          currentUserGems={stats.totalGems}
          onEditProfile={() => {
            setShowLeaderboard(false);
            setShowProfileModal(true);
          }}
          onRefresh={async () => {
            await syncPlayerScoreToServer();
          }}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {/* User Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          initialProfile={userProfile || undefined}
          canClose={localStorage.getItem(PROFILE_SETUP_KEY) === 'true' && Boolean(userProfile && userProfile.name.trim().length >= 2 && userProfile.country.trim())}
          onClose={() => setShowProfileModal(false)}
          onSave={handleSaveProfile}
          onResetProgression={handleResetProgression}
          accountUid={canonicalPlayerId}
        />
      )}

      {/* Interactive 1 to 5 Star Game Review Modal (Triggered after Level 2) */}
      {showReviewModal && (
        <ReviewModal
          isOpen={showReviewModal}
          onSubmit={(rating, feedback) => {
            try {
              localStorage.setItem('going_hop_reviewed_v22', 'true');
              localStorage.setItem('going_hop_user_rating', rating.toString());
              if (feedback) localStorage.setItem('going_hop_user_feedback', feedback);
            } catch {
              // ignore
            }
            setShowReviewModal(false);
          }}
          onClose={() => {
            try {
              localStorage.setItem('going_hop_reviewed_v22', 'true');
            } catch {
              // ignore
            }
            setShowReviewModal(false);
          }}
        />
      )}
    </div>
  );
}

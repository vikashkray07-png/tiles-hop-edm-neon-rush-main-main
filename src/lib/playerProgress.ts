import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { LEVELS } from '../data/levels';
import { BALL_SKINS } from '../data/skins';

export const CURRENT_RESET_VERSION = 5;
export const RESET_VERSION_KEY = 'going_hop_reset_v5_done';
export const PROFILE_SETUP_VERSION = 28;
export const PROFILE_SETUP_KEY = 'going_hop_profile_setup_v28_done';

export interface PlayerProgressState {
  name: string;
  country: string;
  flag: string;
  gems: number;
  coins: number;
  score: number;
  maxUnlockedLevel: number;
  selectedLevel: number;
  unlockedSkins: string[];
  selectedSkin: string;
  resetVersion: number;
  hasRegisteredProfile?: boolean;
  profileVersion?: number;
  updatedAt: number;
}

export function purgeLegacyFlatKeys(): void {
  try {
    localStorage.removeItem('going_hop_gems');
    localStorage.removeItem('going_hop_coins');
    localStorage.removeItem('going_hop_cum_score');
    localStorage.removeItem('going_hop_max_level');
    localStorage.removeItem('going_hop_selected_level');
    localStorage.removeItem('going_hop_unlocked_skins');
    localStorage.removeItem('going_hop_selected_skin');
    localStorage.removeItem('going_hop_reset_v3_done');
    localStorage.removeItem('going_hop_reset_v4_done');
    localStorage.removeItem('going_hop_profile_setup_v26_done');
    localStorage.removeItem('going_hop_profile_setup_v27_done');
  } catch {
    // ignore
  }
}

export function getDefaultPlayerProgress(profile?: { name?: string; country?: string; flag?: string } | null): PlayerProgressState {
  return {
    name: profile?.name?.trim() || '',
    country: profile?.country?.trim() || '',
    flag: profile?.flag || '🇮🇳',
    gems: 0,
    coins: 0,
    score: 0,
    maxUnlockedLevel: 1,
    selectedLevel: 1,
    unlockedSkins: ['earth-ball'],
    selectedSkin: 'earth-ball',
    resetVersion: CURRENT_RESET_VERSION,
    hasRegisteredProfile: Boolean(profile?.name && profile.name.trim().length >= 2 && profile.country),
    profileVersion: PROFILE_SETUP_VERSION,
    updatedAt: Date.now(),
  };
}

/**
 * Loads current local cached progress safely from account-isolated localStorage.
 * Prevents account bleed and completely ignores old legacy keys.
 */
export function loadLocalPlayerProgress(activeUid?: string | null): PlayerProgressState {
  purgeLegacyFlatKeys();
  try {
    const key = activeUid ? `going_hop_account_${activeUid}` : 'going_hop_account_guest';
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.resetVersion === CURRENT_RESET_VERSION) {
        return {
          name: typeof parsed.name === 'string' ? parsed.name : '',
          country: typeof parsed.country === 'string' ? parsed.country : '',
          flag: typeof parsed.flag === 'string' ? parsed.flag : '🇮🇳',
          gems: typeof parsed.gems === 'number' ? Math.max(0, parsed.gems) : 0,
          coins: typeof parsed.coins === 'number' ? Math.max(0, parsed.coins) : 0,
          score: typeof parsed.score === 'number' ? Math.max(0, parsed.score) : 0,
          maxUnlockedLevel: Math.max(1, Math.min(LEVELS.length, parsed.maxUnlockedLevel || 1)),
          selectedLevel: Math.max(1, Math.min(LEVELS.length, parsed.selectedLevel || 1)),
          unlockedSkins: Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0 ? parsed.unlockedSkins : ['earth-ball'],
          selectedSkin: typeof parsed.selectedSkin === 'string' ? parsed.selectedSkin : 'earth-ball',
          resetVersion: CURRENT_RESET_VERSION,
          hasRegisteredProfile: Boolean(parsed.hasRegisteredProfile),
          profileVersion: PROFILE_SETUP_VERSION,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        };
      }
    }

    // Fallback: check profile name/country if already entered
    const savedName = (localStorage.getItem('going_hop_player_name') || '').trim();
    const savedCountry = (localStorage.getItem('going_hop_player_country') || '').trim();
    const savedFlag = localStorage.getItem('going_hop_player_flag') || '🇮🇳';
    const isProfileSetupDone = localStorage.getItem(PROFILE_SETUP_KEY) === 'true';

    return getDefaultPlayerProgress({
      name: isProfileSetupDone ? savedName : '',
      country: isProfileSetupDone ? savedCountry : '',
      flag: savedFlag,
    });
  } catch (err) {
    console.warn('[PlayerProgress] loadLocalPlayerProgress fallback:', err);
    return getDefaultPlayerProgress();
  }
}

/**
 * Saves given progress delta to account-isolated localStorage cache.
 */
export function saveLocalPlayerProgress(progress: Partial<PlayerProgressState>, activeUid?: string | null): void {
  purgeLegacyFlatKeys();
  try {
    const key = activeUid ? `going_hop_account_${activeUid}` : 'going_hop_account_guest';
    const current = loadLocalPlayerProgress(activeUid);
    const updated: PlayerProgressState = {
      ...current,
      ...progress,
      resetVersion: CURRENT_RESET_VERSION,
      updatedAt: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(updated));
    if (activeUid) {
      localStorage.setItem('going_hop_auth_uid', activeUid);
    }
    localStorage.setItem(RESET_VERSION_KEY, 'true');

    if (updated.name) localStorage.setItem('going_hop_player_name', updated.name);
    if (updated.country) localStorage.setItem('going_hop_player_country', updated.country);
    if (updated.flag) localStorage.setItem('going_hop_player_flag', updated.flag);
    if (updated.hasRegisteredProfile) {
      localStorage.setItem(PROFILE_SETUP_KEY, 'true');
    }
  } catch (err) {
    console.warn('[PlayerProgress] saveLocalPlayerProgress note:', err);
  }
}

/**
 * Reads cloud player progress from Firestore /leaderboard/{uid}.
 */
export async function fetchCloudPlayerProgress(uid: string): Promise<PlayerProgressState | null> {
  try {
    const docRef = doc(db, 'leaderboard', uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    if (!data) return null;

    const rawMaxLvl = typeof data.maxUnlockedLevel === 'number' ? data.maxUnlockedLevel : typeof data.level === 'number' ? data.level : 1;
    const safeMaxLvl = (rawMaxLvl >= 9999 || rawMaxLvl > LEVELS.length) ? 1 : Math.max(1, rawMaxLvl);

    const rawSelLvl = typeof data.selectedLevel === 'number' ? data.selectedLevel : safeMaxLvl;
    const safeSelLvl = (rawSelLvl >= 9999 || rawSelLvl > LEVELS.length) ? 1 : Math.max(1, rawSelLvl);

    let unlockedSkins = ['earth-ball'];
    if (Array.isArray(data.unlockedSkins) && data.unlockedSkins.length > 0) {
      unlockedSkins = Array.from(new Set(['earth-ball', ...data.unlockedSkins.filter((s) => typeof s === 'string')]));
    }

    const docName = typeof data.name === 'string' ? data.name.trim().slice(0, 50) : '';
    const docCountry = typeof data.country === 'string' ? data.country.trim().slice(0, 64) : '';
    const hasRegisteredProfile = Boolean(data.hasRegisteredProfile) || (docName.length >= 2 && Boolean(docCountry));
    const profileVersion = typeof data.profileVersion === 'number' ? data.profileVersion : PROFILE_SETUP_VERSION;

    return {
      name: docName,
      country: docCountry,
      flag: typeof data.flag === 'string' ? data.flag.trim().slice(0, 16) : '🇮🇳',
      gems: typeof data.gems === 'number' && !isNaN(data.gems) ? Math.max(0, data.gems) : 0,
      coins: typeof data.coins === 'number' && !isNaN(data.coins) ? Math.max(0, data.coins) : 0,
      score: typeof data.score === 'number' && !isNaN(data.score) ? Math.max(0, data.score) : 0,
      maxUnlockedLevel: safeMaxLvl,
      selectedLevel: safeSelLvl,
      unlockedSkins,
      selectedSkin: typeof data.selectedSkin === 'string' && data.selectedSkin ? data.selectedSkin : 'earth-ball',
      resetVersion: typeof data.resetVersion === 'number' ? data.resetVersion : 0,
      hasRegisteredProfile,
      profileVersion,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    };
  } catch (err) {
    // Distinguish a missing Firestore document (null) from an offline/permission error.
    // Callers must use the UID-scoped local cache on errors and must never treat
    // a failed network read as a brand-new account.
    console.warn('[PlayerProgress] Cloud read failed; caller must retain local cache:', err);
    throw err;
  }
}

/**
 * Pushes full authoritative player progress to Firestore /leaderboard/{uid}.
 */
export async function syncCloudPlayerProgress(uid: string, progress: PlayerProgressState): Promise<void> {
  // Always use the real authenticated Firebase user ID to satisfy security rules
  const effectiveUid = auth.currentUser?.uid || uid;
  if (!effectiveUid || !auth.currentUser) {
    console.warn('[PlayerProgress] Skip syncCloudPlayerProgress: No authenticated user session.');
    return;
  }

  const docRef = doc(db, 'leaderboard', effectiveUid);
  const safeName = (progress.name || 'Player').trim().slice(0, 50);
  const safeCountry = (progress.country || 'India').trim().slice(0, 64);
  const safeFlag = (progress.flag || '🇮🇳').trim().slice(0, 16);
  const safeMaxLvl = (progress.maxUnlockedLevel >= 9999 || progress.maxUnlockedLevel > LEVELS.length)
    ? 1
    : Math.max(1, progress.maxUnlockedLevel);
  const safeSelLvl = (progress.selectedLevel >= 9999 || progress.selectedLevel > LEVELS.length)
    ? 1
    : Math.max(1, progress.selectedLevel);

  const hasRegistered = progress.hasRegisteredProfile ?? (safeName.length >= 2 && Boolean(safeCountry));

  const payload = {
    id: effectiveUid,
    name: safeName,
    country: safeCountry,
    flag: safeFlag,
    gems: Math.max(0, Math.min(10000000, progress.gems)),
    coins: Math.max(0, Math.min(10000000, progress.coins)),
    score: Math.max(0, Math.min(50000000, progress.score)),
    level: safeMaxLvl,
    maxUnlockedLevel: safeMaxLvl,
    selectedLevel: safeSelLvl,
    unlockedSkins: progress.unlockedSkins.slice(0, 20),
    selectedSkin: progress.selectedSkin.slice(0, 64),
    resetVersion: CURRENT_RESET_VERSION,
    hasRegisteredProfile: hasRegistered,
    profileVersion: progress.profileVersion ?? PROFILE_SETUP_VERSION,
    updatedAt: Date.now(),
  };

  try {
    await setDoc(docRef, payload);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err).includes('permission')) {
      handleFirestoreError(err, OperationType.WRITE, `leaderboard/${effectiveUid}`);
    }
    throw err;
  }
}

/**
 * Performs explicit one-time clean reset of test account progression across localStorage and Firestore.
 */
export async function executeOneTimeTestReset(
  uid: string,
  profile?: { name?: string; country?: string; flag?: string } | null
): Promise<PlayerProgressState> {
  console.log('[PlayerProgress] Executing explicit one-time clean test data reset for UID:', uid);

  // Clear obsolete localStorage test keys that cause legacy data restoration
  try {
    localStorage.removeItem('going_hop_player_id'); // Obsolete legacy ID that carried old test scores
    localStorage.removeItem('going_hop_reviewed_v22');
    localStorage.removeItem('going_hop_user_rating');
    localStorage.removeItem('going_hop_user_feedback');
    localStorage.removeItem('going_hop_skin_ads');
  } catch {
    // ignore
  }

  const cleanState = getDefaultPlayerProgress(profile);

  // Apply to BALL_SKINS in memory
  BALL_SKINS.forEach((skin) => {
    skin.unlocked = skin.id === 'earth-ball';
    skin.adsWatched = 0;
  });

  saveLocalPlayerProgress(cleanState, uid);
  localStorage.setItem(RESET_VERSION_KEY, 'true');

  try {
    await syncCloudPlayerProgress(uid, cleanState);
    console.log('[PlayerProgress] Clean reset state committed to Firestore successfully.');
  } catch (err) {
    console.warn('[PlayerProgress] Notice: Cloud reset write pending connection:', err);
  }

  return cleanState;
}

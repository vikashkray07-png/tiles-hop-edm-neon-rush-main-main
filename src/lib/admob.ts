import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

// Official Google Android demo ad units. Never replace these during test builds.
const TEST_REWARDED_AD_UNIT = 'ca-app-pub-3940256099942544/5224354917';
const TEST_INTERSTITIAL_AD_UNIT = 'ca-app-pub-3940256099942544/1033173712';

let initialization: Promise<boolean> | null = null;

export function initializeTestAds(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        consent = await AdMob.showConsentForm();
      }
      if (!consent.canRequestAds) return false;
      await AdMob.initialize();
      return true;
    } catch (error) {
      console.warn('[AdMob] Test initialization unavailable; game will continue without ads.', error);
      initialization = null;
      return false;
    }
  })();

  return initialization;
}

export async function showRewardedTestAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !(await initializeTestAds())) return false;
  try {
    await AdMob.prepareRewardVideoAd({ adId: TEST_REWARDED_AD_UNIT });
    const reward = await AdMob.showRewardVideoAd();
    return Number(reward?.amount) > 0;
  } catch (error) {
    console.warn('[AdMob] Rewarded test ad unavailable or not completed.', error);
    return false;
  }
}

export async function showInterstitialTestAd(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !(await initializeTestAds())) return;
  try {
    await AdMob.prepareInterstitial({ adId: TEST_INTERSTITIAL_AD_UNIT });
    await AdMob.showInterstitial();
  } catch (error) {
    console.warn('[AdMob] Interstitial test ad unavailable; skipping.', error);
  }
}

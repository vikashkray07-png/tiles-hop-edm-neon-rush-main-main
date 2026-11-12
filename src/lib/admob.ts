import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

// Official Google Android demo ad units. Never replace these during test builds.
const TEST_REWARDED_AD_UNIT = 'ca-app-pub-3940256099942544/5224354917';
const TEST_INTERSTITIAL_AD_UNIT = 'ca-app-pub-3940256099942544/1033173712';

let initialization: Promise<boolean> | null = null;
let interstitialReady = false;
let interstitialLoading = false;

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

export async function prepareInterstitialTestAd(): Promise<void> {
  if (!Capacitor.isNativePlatform() || interstitialReady || interstitialLoading) return;
  if (!(await initializeTestAds())) return;

  interstitialLoading = true;
  try {
    await AdMob.prepareInterstitial({ adId: TEST_INTERSTITIAL_AD_UNIT });
    interstitialReady = true;
  } catch (error) {
    // Do not retry on every level completion. The app retries only when
    // connectivity is restored or after a previously shown ad is dismissed.
    interstitialReady = false;
    console.warn('[AdMob] Interstitial preload failed; gameplay will continue without an ad.', error);
  } finally {
    interstitialLoading = false;
  }
}

export async function showInterstitialTestAd(): Promise<void> {
  // Never load an ad from the level-complete callback. Show only an ad that
  // was successfully loaded in advance; otherwise return immediately.
  if (!Capacitor.isNativePlatform() || !interstitialReady) return;

  interstitialReady = false;
  try {
    await AdMob.showInterstitial({ adId: TEST_INTERSTITIAL_AD_UNIT });
  } catch (error) {
    console.warn('[AdMob] Prepared interstitial failed to show; skipping.', error);
  } finally {
    // Refill in the background. If the device is offline this fails safely
    // and will be retried when the app's online state changes back to true.
    void prepareInterstitialTestAd();
  }
}

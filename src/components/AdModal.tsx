import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ShieldAlert, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { showRewardedTestAd } from '../lib/admob';

export type AdType =
  | 'skin_unlock'
  | 'skin_coin_purchase'
  | 'level_complete'
  | 'continue_revive';

interface AdModalProps {
  type: AdType;
  title?: string;
  subtitle?: string;
  skinName?: string;
  adNumber?: number;
  totalAds?: number;
  onComplete: () => void;
  onClose?: () => void;
}

type AdStatus = 'ready' | 'loading' | 'error';

// Whole ad flow (load + show) must never hang the game.
const AD_FLOW_TIMEOUT_MS = 130000;

// Confirms the phone really has internet before asking Google for an ad.
// If it does not, we show our own message instead of Google's blank white page.
const hasInternet = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    await fetch('https://www.gstatic.com/generate_204', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
};

export const AdModal: React.FC<AdModalProps> = ({
  type,
  skinName,
  adNumber = 1,
  totalAds = 2,
  onComplete,
  onClose,
}) => {
  const [status, setStatus] = useState<AdStatus>('ready');
  const [error, setError] = useState('');

  const busyRef = useRef(false);
  const rewardedRef = useRef(false);

  useEffect(() => {
    soundEngine.stopBackgroundMusic();

    if (!Capacitor.isNativePlatform()) {
      setStatus('error');
      setError('Google test ads are available only in the installed Android app.');
    }
  }, []);

  const handleWatchAd = async () => {
    if (busyRef.current || rewardedRef.current) return;

    busyRef.current = true;
    setStatus('loading');
    setError('');

    let timer: number | undefined;

    try {
      if (!(await hasInternet())) {
        setStatus('error');
        setError('No internet connection. Please connect to the internet and try again.');
        return;
      }

      const timeout = new Promise<boolean>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new Error('Ad flow timed out')),
          AD_FLOW_TIMEOUT_MS
        );
      });

      const rewardEarned = await Promise.race([showRewardedTestAd(), timeout]);

      if (!rewardEarned) {
        setStatus('error');
        setError('Ad was not completed. No game reward was granted.');
        return;
      }

      rewardedRef.current = true;
      onComplete();
    } catch (err) {
      console.error('Rewarded test ad failed:', err);
      setStatus('error');
      setError('Google test ad failed. No reward was granted.');
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
      busyRef.current = false;
    }
  };

  // Every ad type now starts automatically as soon as it opens
  // (no extra "WATCH TEST AD" tap needed).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Small delay so the screen behind finishes drawing first.
    const timer = window.setTimeout(
      () => {
        void handleWatchAd();
      },
      type === 'level_complete' ? 600 : 150
    );

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (busyRef.current || rewardedRef.current) return;
    onClose?.();
  };

  // While the ad is starting we only show a plain dark screen, no card.
  if (status !== 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <p className="text-sm font-semibold tracking-widest text-cyan-300">
          Loading ad…
        </p>
      </div>
    );
  }

  const header =
    type === 'skin_unlock'
      ? 'GOOGLE TEST REWARD · SKIN (' + adNumber + '/' + totalAds + ')'
      : type === 'continue_revive'
        ? 'GOOGLE TEST REWARD · REVIVE'
        : type === 'level_complete'
          ? 'GOOGLE TEST AD · LEVEL CLEAR'
          : 'GOOGLE TEST REWARD · STORE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-[#082333] to-[#050912] p-6 text-center text-white shadow-2xl">

        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="text-left text-[10px] font-black tracking-widest text-cyan-300">
            {header}
          </span>

          {onClose && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full bg-white/10 p-2"
              aria-label="Close ad"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <ShieldAlert
          className="mx-auto mb-4 text-yellow-400"
          size={44}
        />

        <h2 className="mb-2 text-2xl font-black">
          Ad Unavailable
        </h2>

        {skinName && type === 'skin_unlock' && (
          <p className="mb-4 text-sm text-cyan-300">
            Skin: <strong className="text-white">{skinName}</strong>
            <span className="ml-2 text-yellow-400">
              ({adNumber}/{totalAds})
            </span>
          </p>
        )}

        <p role="alert" className="mb-5 text-sm text-red-300">
          {error}
        </p>

        {Capacitor.isNativePlatform() && (
          <button
            type="button"
            onClick={() => {
              void handleWatchAd();
            }}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-black text-white"
          >
            TRY AGAIN
          </button>
        )}

        <p className="mt-4 text-[10px] text-white/40">
          Rewards are granted only after the ad is completed.
          Failed or dismissed ads grant no reward.
        </p>
      </div>
    </div>
  );
};

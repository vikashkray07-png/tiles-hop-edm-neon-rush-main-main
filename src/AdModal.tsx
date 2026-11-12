
import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Volume2, VolumeX, X, ShieldAlert } from 'lucide-react';
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

export const AdModal: React.FC<AdModalProps> = ({
  type,
  skinName,
  adNumber = 1,
  totalAds = 2,
  onComplete,
  onClose,
}) => {
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>('ready');
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const completedRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    soundEngine.stopBackgroundMusic();

    if (!Capacitor.isNativePlatform()) {
      setStatus('error');
      setError('Test ads are available only in the Android app.');
    }
  }, []);

  const handleWatchAd = async () => {
    if (busyRef.current || completedRef.current) return;

    busyRef.current = true;
    setIsBusy(true);
    setStatus('loading');
    setError('');

    try {
      const rewarded = await showRewardedTestAd();

      if (!rewarded || completedRef.current) {
        setStatus('error');
        setError('No reward was confirmed. You can try again.');
        return;
      }

      completedRef.current = true;
      onComplete();
    } catch (err) {
      console.error('Ad display error:', err);
      setStatus('error');
      setError('The test ad failed. No reward was granted.');
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  };

  const handleClose = () => {
    if (busyRef.current || completedRef.current) return;
    onClose?.();
  };

  const header =
    type === 'skin_unlock'
      ? `TEST REWARD · SKIN (${adNumber}/${totalAds})`
      : type === 'continue_revive'
        ? 'TEST REWARD · REVIVE'
        : 'GOOGLE TEST REWARDED AD';

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-[#082333] to-[#050912] p-6 text-center text-white shadow-2xl">

        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] font-black tracking-widest text-cyan-300">
            {header}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted((value) => !value)}
              className="p-2 rounded-full bg-white/10"
              aria-label="Toggle sound"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {onClose && (
              <button
                onClick={handleClose}
                disabled={isBusy}
                className="p-2 rounded-full bg-white/10 disabled:opacity-40"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <ShieldAlert className="mx-auto mb-4 text-yellow-400" size={42} />

        <h2 className="text-2xl font-black mb-2">
          Google Rewarded Test Ad
        </h2>

        <p className="text-sm text-white/70 mb-4">
          This is a Google test advertisement. No real commercial ad is being served.
        </p>

        {skinName && type === 'skin_unlock' && (
          <p className="text-sm text-cyan-300 mb-4">
            Skin: <strong className="text-white">{skinName}</strong>
            <span className="ml-2 text-yellow-400">
              ({adNumber}/{totalAds})
            </span>
          </p>
        )}

        {status === 'loading' && (
          <p className="text-sm text-cyan-300 mb-4">
            {isBusy ? 'Loading or showing test ad…' : 'Preparing test ad…'}
          </p>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-300 mb-4">{error}</p>
        )}

        {status === 'ready' && (
          <p className="text-sm text-white/60 mb-4">
            Press below to load and watch the Google test ad.
          </p>
        )}

        <button
          onClick={handleWatchAd}
          disabled={isBusy || status === 'loading' || status === 'error'}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-black text-white disabled:opacity-50"
        >
          {isBusy
            ? 'PLEASE WAIT…'
            : status === 'error'
              ? 'AD UNAVAILABLE'
              : 'WATCH TEST AD'}
        </button>

        {status === 'error' && Capacitor.isNativePlatform() && (
          <button
            onClick={() => {
              setError('');
              setStatus('ready');
            }}
            className="mt-3 text-sm text-cyan-300 underline"
          >
            Try Again
          </button>
        )}

        <p className="mt-4 text-[10px] text-white/40">
          A reward is granted only after Google confirms successful completion.
          Closing or failing the ad grants nothing.
        </p>
      </div>
    </div>
  );
};

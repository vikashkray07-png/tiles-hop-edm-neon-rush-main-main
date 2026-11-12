import React from 'react';
import { X, Check, Lock, Coins, Clapperboard, WifiOff } from 'lucide-react';
import { BALL_SKINS } from '../data/skins';
import { BallSkin } from '../types/game';
import { soundEngine } from '../audio/SoundEngine';

interface SkinShopModalProps {
  currentSkin: BallSkin;
  totalCoins: number;
  isOnline?: boolean;
  onSelectSkin: (skin: BallSkin) => void;
  onUnlockSkin: (skin: BallSkin) => void;
  onWatchSkinAd: (skin: BallSkin) => void;
  onClose: () => void;
}

export const SkinShopModal: React.FC<SkinShopModalProps> = ({
  currentSkin,
  totalCoins,
  isOnline = true,
  onSelectSkin,
  onUnlockSkin,
  onWatchSkinAd,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 bg-black/85 z-40 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-gradient-to-b from-[#190a33] to-[#0d031c] border border-cyan-500/30 rounded-3xl p-5 md:p-6 flex flex-col shadow-[0_0_40px_rgba(0,240,255,0.25)] animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="text-xl font-black text-white tracking-wide">BALL SKIN SHOP (10 SKINS)</h2>
            <p className="text-xs text-white/50">Unlock via Gold Coins or Watch Rewarded Ads</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Coins Balance Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 text-xs font-bold shadow-[0_0_12px_rgba(255,200,0,0.3)]">
              <Coins className="w-3.5 h-3.5 text-yellow-400" />
              <span className="tabular-nums font-mono">{totalCoins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Skins Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 overflow-y-auto pr-1">
          {BALL_SKINS.map((skin) => {
            const isSelected = currentSkin.id === skin.id;
            const isAdSkin = skin.unlockType === 'ads';
            const price = skin.costCoins ?? skin.cost ?? 0;
            const canAfford = totalCoins >= price;
            const adsDone = skin.adsWatched || 0;
            const adsNeed = skin.adsRequired || 2;

            return (
              <div
                key={skin.id}
                onClick={() => {
                  if (skin.unlocked) {
                    soundEngine.playUiClick();
                    onSelectSkin(skin);
                  }
                }}
                className={`relative p-3 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-white/15 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {/* Badge for Ad vs Coin Skin */}
                <div className="absolute top-2 left-2">
                  {isAdSkin ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[9px] font-extrabold uppercase border border-amber-400/30">
                      AD SKIN
                    </span>
                  ) : skin.costCoins === 0 ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-cyan-400/20 text-cyan-300 text-[9px] font-extrabold uppercase border border-cyan-400/30">
                      FREE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-yellow-400/20 text-yellow-300 text-[9px] font-extrabold uppercase border border-yellow-400/30">
                      COINS
                    </span>
                  )}
                </div>

                {/* 3D Ball Sphere Preview */}
                <div
                  className="w-13 h-13 rounded-full my-2.5 flex items-center justify-center relative shadow-lg"
                  style={{
                    backgroundColor: skin.color,
                    boxShadow: `0 0 20px ${skin.trailColor}`,
                  }}
                >
                  <div className="w-4 h-4 rounded-full bg-white/60 blur-[2px] absolute top-1.5 left-1.5" />
                </div>

                <div className="font-bold text-xs text-white truncate w-full">{skin.name}</div>

                {/* Status / Button */}
                <div className="mt-2 w-full">
                  {skin.unlocked ? (
                    isSelected ? (
                      <div className="w-full py-1.5 rounded-lg bg-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center justify-center gap-1 border border-cyan-400/50">
                        <Check className="w-3 h-3" /> EQUIPPED
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundEngine.playUiClick();
                          onSelectSkin(skin);
                        }}
                        className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all cursor-pointer"
                      >
                        EQUIP
                      </button>
                    )
                  ) : isAdSkin ? (
                    /* Ad-Unlockable Skin (Requires 2 Ads) */
                    isOnline ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onWatchSkinAd(skin);
                        }}
                        className="w-full py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                      >
                        <Clapperboard className="w-3.5 h-3.5 text-black" />
                        <span>WATCH AD ({adsDone}/{adsNeed})</span>
                      </button>
                    ) : (
                      <div className="w-full py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[10px] font-bold flex items-center justify-center gap-1 cursor-not-allowed">
                        <WifiOff className="w-3 h-3 text-white/30" />
                        <span>NO INTERNET</span>
                      </div>
                    )
                  ) : (
                    /* Coin Purchase Skin */
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canAfford) {
                          onUnlockSkin(skin);
                        } else {
                          soundEngine.playMiss();
                        }
                      }}
                      disabled={!canAfford}
                      className={`w-full py-1.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all ${
                        canAfford
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black cursor-pointer shadow-[0_0_12px_rgba(255,200,0,0.5)] active:scale-95'
                          : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>{price}</span>
                      <Coins className="w-3 h-3 text-yellow-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 text-center text-[11px] text-white/40 border-t border-white/5">
          {isOnline ? (
            <span>🟢 Online mode active · Watch 2 ads to unlock premium skins for free!</span>
          ) : (
            <span>⚪ Offline mode active · Coin skins purchase directly without ads!</span>
          )}
        </div>
      </div>
    </div>
  );
};

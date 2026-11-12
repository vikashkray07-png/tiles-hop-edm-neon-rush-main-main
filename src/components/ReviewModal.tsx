import React, { useState } from 'react';
import { Star, X, Sparkles, Heart, CheckCircle2 } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onSubmit: (rating: number, feedback: string) => void;
  onClose: () => void;
}

const RATING_DESCRIPTIONS = [
  'Tap a star to rate!',
  '1 Star - Needs Improvement ⚡',
  '2 Stars - Fair Rhythm & Beats 🎵',
  '3 Stars - Good Game! 👍',
  '4 Stars - Very Fun & Addictive! 🔥',
  '5 Stars - Masterpiece! 5 Stars! 🌟',
];

const QUICK_TAGS = [
  '🎮 Smooth Controls',
  '🪐 Awesome Planet Skins',
  '🎵 Neon Beats & Sound',
  '🔥 Thrilling Challenge',
  '💎 Addictive Gameplay',
];

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onSubmit,
  onClose,
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['🎮 Smooth Controls', '🪐 Awesome Planet Skins']);
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentHoverOrSelected = hoverRating || selectedRating;

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      onSubmit(selectedRating, selectedTags.join(', '));
    }, 1200);
  };

  return (
    <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-[#1e0836] via-[#120524] to-[#080214] border-2 border-yellow-400/50 rounded-3xl p-6 flex flex-col shadow-[0_0_50px_rgba(250,204,21,0.35)] relative overflow-hidden">
        {/* Neon Glow Accents */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-yellow-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="py-10 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center mb-4 text-green-400">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Thank You, Gamer! 🎉</h3>
            <p className="text-sm text-yellow-300 font-semibold max-w-xs">
              Your {selectedRating}-Star rating helps us make Tiles Hop Neon Rush even better!
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center pt-2 pb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-xs font-black tracking-wider uppercase mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Level 2 Cleared!</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-wide">
                RATE YOUR EXPERIENCE
              </h2>
              <p className="text-sm text-cyan-300/90 font-medium mt-1">
                Aap game ko kitna star denge?
              </p>
            </div>

            {/* 5 Interactive Golden Stars */}
            <div className="flex items-center justify-center gap-2.5 my-4">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = star <= currentHoverOrSelected;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setSelectedRating(star)}
                    className={`transition-all transform active:scale-125 hover:scale-115 p-1 rounded-xl cursor-pointer ${
                      isLit ? 'text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)]' : 'text-white/20 hover:text-yellow-400/50'
                    }`}
                  >
                    <Star
                      className={`w-9 h-9 sm:w-11 sm:h-11 transition-all ${
                        isLit ? 'fill-yellow-400 stroke-yellow-300' : 'stroke-white/30'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Star Rating Label */}
            <div className="text-center font-bold text-xs text-yellow-300/95 tracking-wide mb-4 min-h-[20px]">
              {RATING_DESCRIPTIONS[currentHoverOrSelected]}
            </div>

            {/* Quick Feedback Chips */}
            <div className="mb-5">
              <div className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider mb-2 text-center">
                What did you like most?
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {QUICK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300 shadow-md scale-105'
                          : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={selectedRating === 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-black font-black text-sm tracking-wide shadow-[0_0_25px_rgba(250,204,21,0.5)] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-black" />
                <span>SUBMIT REVIEW ({selectedRating} ⭐)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 text-xs text-white/50 hover:text-white/80 font-bold transition-colors cursor-pointer text-center"
              >
                Maybe Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Globe, Sparkles, X, Check, Search, ChevronDown, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types/game';
import { COUNTRIES, CountryItem } from '../data/countries';

interface UserProfileModalProps {
  onSave: (profile: UserProfile) => Promise<void> | void;
  initialProfile?: UserProfile | null;
  canClose?: boolean;
  onClose?: () => void;
  onResetProgression?: () => void;
  isSaving?: boolean;
  accountUid?: string | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  onSave,
  initialProfile,
  canClose = false,
  onClose,
  onResetProgression,
  isSaving = false,
  accountUid,
}) => {
  const [name, setName] = useState(initialProfile?.name || '');
  const [selectedCountry, setSelectedCountry] = useState(initialProfile?.country || '');
  const [selectedFlag, setSelectedFlag] = useState(initialProfile?.flag || '');

  useEffect(() => {
    if (initialProfile) {
      if (initialProfile.name) setName(initialProfile.name);
      if (initialProfile.country) {
        setSelectedCountry(initialProfile.country);
        const matched = COUNTRIES.find(
          (c) => c.name.toLowerCase() === initialProfile.country?.toLowerCase()
        );
        setSelectedFlag(initialProfile.flag || matched?.flag || '🇮🇳');
      }
    }
  }, [initialProfile]);

  // Searchable Country Selector State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [internalSaving, setInternalSaving] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opening dropdown
  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setCountrySearch('');
    }
  }, [isDropdownOpen]);

  // Filter countries by query
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const handleSelectCountry = (country: CountryItem) => {
    setSelectedCountry(country.name);
    setSelectedFlag(country.flag);
    setIsDropdownOpen(false);
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (trimmed.length < 2) {
      setValidationError('Name must be at least 2 characters long.');
      return;
    }
    if (trimmed.length > 30) {
      setValidationError('Name cannot exceed 30 characters.');
      return;
    }
    if (!selectedCountry) {
      setValidationError('Please select your country.');
      return;
    }

    setValidationError(null);
    setInternalSaving(true);
    try {
      await onSave({
        name: trimmed,
        country: selectedCountry,
        flag: selectedFlag || '🌐',
      });
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setInternalSaving(false);
    }
  };


  const saving = isSaving || internalSaving;
  const isNameValid = name.trim().length >= 2 && name.trim().length <= 30;
  const isFormValid = isNameValid && Boolean(selectedCountry);

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-sans">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#1c0836] via-[#120426] to-[#070114] border border-cyan-400/40 rounded-3xl p-6 md:p-8 flex flex-col items-center text-center shadow-[0_0_60px_rgba(0,240,255,0.35)] animate-in fade-in zoom-in-95 duration-200">
        {canClose && onClose && !saving && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(0,240,255,0.4)]">
          <Sparkles className="w-7 h-7 text-cyan-300" />
        </div>

        <h2 className="text-2xl font-black text-white tracking-wider uppercase mb-1 drop-shadow-[0_0_12px_rgba(0,240,255,0.6)]">
          PLAYER REGISTRATION
        </h2>
        <p className="text-xs text-cyan-200/90 font-medium mb-5">
          Enter your name and country to join the live global leaderboard and start hopping!
        </p>

        {validationError && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/60 flex items-center gap-2.5 text-left text-xs text-red-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 text-left">
          {/* Name Input */}
          <div>
            <label className="text-xs font-bold text-white/90 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" /> Player Name
              </span>
              <span className="text-[10px] text-white/50 font-normal">
                {name.trim().length}/30
              </span>
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={30}
              placeholder="e.g. NeonHopper"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={saving}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-cyan-400 focus:outline-none text-white text-base font-semibold placeholder:text-white/30 transition-all shadow-inner disabled:opacity-50"
            />
          </div>

          {/* Searchable Country Selector */}
          <div className="relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-white/90 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-pink-400" /> Select Country
            </label>

            {/* Selector Trigger Button */}
            <button
              type="button"
              disabled={saving}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="w-full px-4 py-3 rounded-xl bg-[#1a0a33] border border-white/20 hover:border-cyan-400/60 focus:border-cyan-400 focus:outline-none text-white text-base font-semibold transition-all flex items-center justify-between cursor-pointer disabled:opacity-50 shadow-inner"
            >
              <div className="flex items-center gap-2.5 truncate">
                {selectedCountry ? (
                  <>
                    <span className="text-2xl leading-none">{selectedFlag}</span>
                    <span className="truncate">{selectedCountry}</span>
                  </>
                ) : (
                  <span className="text-white/40 font-normal">Choose your country...</span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 shrink-0 ${
                  isDropdownOpen ? 'rotate-180 text-cyan-400' : ''
                }`}
              />
            </button>

            {/* Dropdown Popover */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-[#120426] border border-cyan-500/50 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] z-50 overflow-hidden flex flex-col max-h-64 animate-in fade-in zoom-in-95 duration-150">
                {/* Search Field inside Dropdown */}
                <div className="p-2.5 border-b border-white/10 bg-[#1c0836]">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-cyan-400 absolute left-3 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search country..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/15 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Country List */}
                <div className="overflow-y-auto flex-1 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-cyan-500/30">
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((c) => {
                      const isSelected = selectedCountry === c.name;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleSelectCountry(c)}
                          className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                              : 'text-white hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="text-xl leading-none">{c.flag}</span>
                            <span className="text-sm truncate">{c.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-white/50">
                      No matching countries found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid || saving}
            className="w-full mt-2 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-white font-black text-base tracking-wider shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transform active:scale-95 flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                SAVING PROGRESS...
              </span>
            ) : (
              <span>SAVE &amp; START PLAYING</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

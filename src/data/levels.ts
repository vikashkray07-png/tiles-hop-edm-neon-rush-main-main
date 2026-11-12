import { LevelConfig } from '../types/game';

interface TargetTheme {
  name: string;
  emoji: string;
  color: string;
  type: string;
  bgTop: string;
  bgBottom: string;
  fogColor: number;
}

export const SECTOR_THEMES: TargetTheme[] = [
  // 1. Sky Castle Islands (Daylight fantasy floating castles, hot air balloons - Matches Reference Image 2!)
  { name: 'Sky Castle Islands', emoji: '🏰', color: '#10b981', type: 'sky_islands', bgTop: '#38bdf8', bgBottom: '#bae6fd', fogColor: 0xbae6fd },
  // 2. Orbital Space Station (Cosmic Space Theme 1: Planet Earth from orbit, rotating ISS, satellites, solar wings)
  { name: 'Orbital Space Station', emoji: '🛰️', color: '#00f5ff', type: 'space_station', bgTop: '#020617', bgBottom: '#0b1120', fogColor: 0x020617 },
  // 3. Deep Space Nebula (Cosmic Space Theme 2: Majestic Saturn-like ringed planet, asteroid belt, glowing gas nebula)
  { name: 'Deep Space Nebula', emoji: '🪐', color: '#d946ef', type: 'space_nebula', bgTop: '#030014', bgBottom: '#1e0836', fogColor: 0x06011a },
  // 4. Coastal City (Skyscrapers, suspension bridge, yachts - Matches Reference Image 1!)
  { name: 'Coastal City', emoji: '🏙️', color: '#0284c7', type: 'coastal_city', bgTop: '#0284c7', bgBottom: '#7dd3fc', fogColor: 0x7dd3fc },
  // 5. Tropical Beach
  { name: 'Tropical Beach', emoji: '🏖️', color: '#06b6d4', type: 'tropical_beach', bgTop: '#0ea5e9', bgBottom: '#a5f3fc', fogColor: 0xa5f3fc },
  // 6. Forest Temple
  { name: 'Forest Temple', emoji: '🌳', color: '#22c55e', type: 'forest_temple', bgTop: '#047857', bgBottom: '#10b981', fogColor: 0x065f46 },
  // 7. Snowy Mountain
  { name: 'Snowy Mountain', emoji: '🏔️', color: '#38bdf8', type: 'snowy_mountain', bgTop: '#60a5fa', bgBottom: '#e0f2fe', fogColor: 0xdbeafe },
  // 8. Tokyo Neon City
  { name: 'Tokyo Neon City', emoji: '🌆', color: '#a855f7', type: 'tokyo_city', bgTop: '#1e1b4b', bgBottom: '#4338ca', fogColor: 0x1e1b4b },
  // 9. Red Desert
  { name: 'Red Desert', emoji: '🏜️', color: '#f97316', type: 'red_desert', bgTop: '#ea580c', bgBottom: '#fed7aa', fogColor: 0xfdba74 },
  // 10. Andromeda Galaxy (Cosmic Space Theme 3: Deep space spiral galaxy core, twin alien exoplanets)
  { name: 'Andromeda Galaxy', emoji: '🌌', color: '#c084fc', type: 'andromeda_galaxy', bgTop: '#020617', bgBottom: '#31104b', fogColor: 0x0f172a },
  // 11. Crystal Islands
  { name: 'Crystal Islands', emoji: '✨', color: '#ec4899', type: 'crystal_islands', bgTop: '#581c87', bgBottom: '#a21caf', fogColor: 0x581c87 },
  // 12. Deep Sea
  { name: 'Deep Sea', emoji: '🐠', color: '#00f5ff', type: 'deep_sea', bgTop: '#082f49', bgBottom: '#0284c7', fogColor: 0x075985 },
  // 13. Bamboo Pagoda Valley
  { name: 'Bamboo Valley', emoji: '🎋', color: '#84cc16', type: 'bamboo_valley', bgTop: '#15803d', bgBottom: '#bbf7d0', fogColor: 0xdcfce7 },
  // 14. Venice Canals
  { name: 'Venice Canals', emoji: '🛶', color: '#0ea5e9', type: 'venice_canals', bgTop: '#0284c7', bgBottom: '#bae6fd', fogColor: 0xe0f2fe },
  // 15. Volcano Caldera
  { name: 'Volcano Caldera', emoji: '🌋', color: '#ef4444', type: 'volcano_caldera', bgTop: '#450a0a', bgBottom: '#dc2626', fogColor: 0x7f1d1d },
  // 16. Autumn Highlands
  { name: 'Autumn Highlands', emoji: '🍁', color: '#d97706', type: 'autumn_highlands', bgTop: '#b45309', bgBottom: '#fef3c7', fogColor: 0xfef3c7 },
  // 17. Aurora Glacier
  { name: 'Aurora Glacier', emoji: '❄️', color: '#2dd4bf', type: 'aurora_glacier', bgTop: '#042f2e', bgBottom: '#14b8a6', fogColor: 0x0f766e },
];

const TIME_OF_DAY_MODIFIERS = [
  { label: 'DAWN GLOW', topTint: '#fdba74', botTint: '#fed7aa', fog: 0xfed7aa },
  { label: 'BRIGHT NOON', topTint: '#38bdf8', botTint: '#bae6fd', fog: 0xbae6fd },
  { label: 'GOLDEN HOUR', topTint: '#f59e0b', botTint: '#fde68a', fog: 0xfef3c7 },
  { label: 'AMBER SUNSET', topTint: '#ea580c', botTint: '#fdba74', fog: 0xfdba74 },
  { label: 'TWILIGHT DUSK', topTint: '#4c1d95', botTint: '#c084fc', fog: 0x581c87 },
  { label: 'STARRY NIGHT', topTint: '#030712', botTint: '#1e1b4b', fog: 0x0f172a },
];

export const LEVELS: LevelConfig[] = Array.from({ length: 150 }, (_, i) => {
  const levelNum = i + 1;
  const theme = SECTOR_THEMES[i % SECTOR_THEMES.length];
  const tod = TIME_OF_DAY_MODIFIERS[Math.floor(i / SECTOR_THEMES.length) % TIME_OF_DAY_MODIFIERS.length];

  // Strictly non-decreasing pads count: Level 1 = 15 pads, smoothly scaling up to exactly 90 pads at Level 150
  // Formula guarantees: level(N+1) >= level(N) at all times, never decreases, and max is 90
  const totalPads = Math.min(90, 15 + Math.floor((i * 75) / 149));
  const platformsCount = totalPads;
  const targetPadsCount = totalPads;

  // Carefully tuned 3-tier difficulty curve:
  // Tier 1 (Levels 1 - 50): Low to mild medium (gentle winding, wide pads, very few moving pads)
  // Tier 2 (Levels 51 - 100): Tricky / puzzling rhythm ("ulghane type", alternating timing & winding)
  // Tier 3 (Levels 101 - 150): Farther gaps with exhilarating jumps, yet perfectly balanced and 100% beatable
  let gapDistance: number;
  let hasMovingPlatforms: boolean;
  let movingPlatformSpeed: number;
  let movingAmplitude: number;

  if (levelNum <= 50) {
    // Level 1-50: Medium difficulty (earlier moving platforms from level 4, tighter hopping distance)
    gapDistance = Number((6.2 + (i / 50) * 0.8).toFixed(2)); // 6.2 to 7.0
    hasMovingPlatforms = levelNum >= 4;
    movingPlatformSpeed = Number((1.4 + (i / 50) * 0.8).toFixed(2)); // 1.4 to 2.2
    movingAmplitude = Number((1.5 + (i / 50) * 0.6).toFixed(2)); // 1.5 to 2.1
  } else if (levelNum <= 100) {
    // Level 51-100: High difficulty (puzzling rhythm, fast-moving platforms, challenging gap precision)
    const p = (i - 50) / 50;
    gapDistance = Number((7.0 + p * 0.8).toFixed(2)); // 7.0 to 7.8
    hasMovingPlatforms = true;
    movingPlatformSpeed = Number((2.0 + p * 0.8).toFixed(2)); // 2.0 to 2.8
    movingAmplitude = Number((1.9 + p * 0.7).toFixed(2)); // 1.9 to 2.6
  } else {
    // Level 101-150: Master tier (dynamic aerial hops, high-speed moving pads, expert timing)
    const p = (i - 100) / 50;
    gapDistance = Number((7.6 + p * 0.6).toFixed(2)); // 7.6 to 8.2
    hasMovingPlatforms = true;
    movingPlatformSpeed = Number((2.4 + p * 0.6).toFixed(2)); // 2.4 to 3.0
    movingAmplitude = Number((2.2 + p * 0.6).toFixed(2)); // 2.2 to 2.8
  }

  // Exactly half the number of total pads as requested ("jitna pad hoga uske aadha gems hona chahiye")
  const totalGems = Math.floor(totalPads / 2);

  // Dynamic sky & fog coloring with time of day nuances (space themes always retain deep cosmic colors)
  const isSpaceTheme = theme.type.includes('space') || theme.type.includes('galaxy') || theme.type.includes('orbital');
  const bgTop = isSpaceTheme ? theme.bgTop : (i < 2 ? theme.bgTop : (i % 2 === 0 ? theme.bgTop : tod.topTint));
  const bgBottom = isSpaceTheme ? theme.bgBottom : (i < 2 ? theme.bgBottom : (i % 2 === 0 ? theme.bgBottom : tod.botTint));
  const fogColor = isSpaceTheme ? theme.fogColor : (i < 2 ? theme.fogColor : (i % 2 === 0 ? theme.fogColor : tod.fog));

  return {
    id: levelNum,
    name: `Level ${levelNum}: ${theme.name}`,
    subtitle: `${theme.name.toUpperCase()} · ${isSpaceTheme ? 'DEEP COSMOS' : tod.label} · ${totalPads} PADS`,
    platformsCount,
    targetPadsCount,
    planetTarget: theme.name,
    planetEmoji: theme.emoji,
    planetColor: theme.color,
    planetType: theme.type,
    targetDescription: `Hop to ${theme.name} · ${totalPads} Aerial Pads`,
    hasMovingPlatforms,
    movingPlatformSpeed,
    movingAmplitude,
    gapDistance,
    totalGems,
    themeColor: theme.color,
    bgTop,
    bgBottom,
    fogColor,
    unlocked: true, // All levels accessible for player testing
  };
});

import { BallSkin } from '../types/game';

export const BALL_SKINS: BallSkin[] = [
  // 1. Default (Free) - Earth Planet (Oceanic Blue, Lush Green Continents, White Cloud Swirls)
  {
    id: 'earth-ball',
    name: 'Earth Planet (Default)',
    color: '#0284c7', // Vivid Ocean Blue
    emissive: '#0369a1',
    trailColor: '#38bdf8',
    costCoins: 0,
    cost: 0,
    unlockType: 'coins',
    unlocked: true,
  },

  // 2. Coin Skin 1 - Venus Planet (Sulfur Acid Gold & Toxic Atmospheric Swirls)
  {
    id: 'venus-ball',
    name: 'Venus Planet',
    color: '#eab308', // Acid Sulfur Gold
    emissive: '#a16207',
    trailColor: '#fde047',
    costCoins: 150,
    cost: 150,
    unlockType: 'coins',
    unlocked: false,
  },

  // 3. Coin Skin 2 - Mars Planet (Fiery Martian Rust Crimson with White Polar Ice Caps)
  {
    id: 'mars-ball',
    name: 'Mars Planet',
    color: '#dc2626', // Fiery Rust Crimson
    emissive: '#991b1b',
    trailColor: '#ef4444',
    costCoins: 300,
    cost: 300,
    unlockType: 'coins',
    unlocked: false,
  },

  // 4. Coin Skin 3 - Jupiter Planet (Deep Caramel Mocha Belts & Great Red Spot)
  {
    id: 'jupiter-ball',
    name: 'Jupiter Planet',
    color: '#78350f', // Mocha Caramel Gas Belt
    emissive: '#451a03',
    trailColor: '#d97706',
    costCoins: 500,
    cost: 500,
    unlockType: 'coins',
    unlocked: false,
  },

  // 5. Coin Skin 4 - Saturn Planet (Butterscotch Gold Giant with 3D Orbital Rings)
  {
    id: 'saturn-ball',
    name: 'Saturn Planet',
    color: '#f59e0b', // Butterscotch Warm Gold
    emissive: '#b45309',
    trailColor: '#fef08a',
    costCoins: 800,
    cost: 800,
    unlockType: 'coins',
    unlocked: false,
  },

  // --- 5 REWARDED AD-UNLOCKABLE PLANET SKINS (Requires 2 Ads Each) ---

  // 6. Ad Skin 1 - Sun Star Core (Blazing Solar Corona Plasma Flame with Magnetic Flares)
  {
    id: 'sun-ball',
    name: 'Sun Star Core',
    color: '#ff4500', // Blazing Solar Plasma Orange-Red
    emissive: '#ea580c',
    trailColor: '#ffedd5',
    costCoins: 0,
    cost: 0,
    unlockType: 'ads',
    adsRequired: 2,
    adsWatched: 0,
    unlocked: false,
  },

  // 7. Ad Skin 2 - Neptune Planet (Deep Midnight Royal Sapphire with Cyan Cryo-Storms)
  {
    id: 'neptune-ball',
    name: 'Neptune Planet',
    color: '#1d4ed8', // Royal Sapphire Cobalt Blue
    emissive: '#1e3a8a',
    trailColor: '#60a5fa',
    costCoins: 0,
    cost: 0,
    unlockType: 'ads',
    adsRequired: 2,
    adsWatched: 0,
    unlocked: false,
  },

  // 8. Ad Skin 3 - Moon Lunar Ball (Pure Silvery Moonlight Chrome with Dark Basalt Maria)
  {
    id: 'moon-ball',
    name: 'Moon Lunar Ball',
    color: '#f1f5f9', // Silvery Pearlescent White
    emissive: '#64748b',
    trailColor: '#ffffff',
    costCoins: 0,
    cost: 0,
    unlockType: 'ads',
    adsRequired: 2,
    adsWatched: 0,
    unlocked: false,
  },

  // 9. Ad Skin 4 - Mercury Planet (Dark Metallic Gunmetal Charcoal Basalt)
  {
    id: 'mercury-ball',
    name: 'Mercury Planet',
    color: '#3f3f46', // Dark Charcoal Gunmetal Zinc
    emissive: '#18181b',
    trailColor: '#a1a1aa',
    costCoins: 0,
    cost: 0,
    unlockType: 'ads',
    adsRequired: 2,
    adsWatched: 0,
    unlocked: false,
  },

  // 10. Ad Skin 5 - Cosmic Galaxy Ball (Radiant Electric Magenta & Neon Violet Nebula)
  {
    id: 'galaxy-ball',
    name: 'Cosmic Galaxy Ball',
    color: '#c026d3', // Electric Nebula Magenta-Purple
    emissive: '#701a75',
    trailColor: '#f472b6',
    costCoins: 0,
    cost: 0,
    unlockType: 'ads',
    adsRequired: 2,
    adsWatched: 0,
    unlocked: false,
  },
];

// Premium ad skins remain locked until a new Ads system is integrated.

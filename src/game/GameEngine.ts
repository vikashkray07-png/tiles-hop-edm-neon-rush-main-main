import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/SoundEngine';
import { BALL_SKINS } from '../data/skins';
import { LEVELS } from '../data/levels';
import { BallSkin, GamePhase, GameStats, LevelConfig, PlatformData, RaceRacerState } from '../types/game';
import { EnvironmentBuilder } from './EnvironmentBuilder';

interface BotRacerData {
  id: string;
  name: string;
  flag: string;
  countryCode: string;
  countryName: string;
  status: 'ACTIVE' | 'FINISHED' | 'FELL';
  colorHex: string;
  colorName: string;
  skinId: string;
  emissiveHex: string;
  group: THREE.Group;
  sphereMesh: THREE.Mesh;
  light: THREE.PointLight;
  labelSprite: THREE.Sprite;
  currentPadIndex: number;
  isGrounded: boolean;
  groundTime: number;
  hopDelay: number;
  baseJumpDuration: number;
  baseHopDelay: number;
  jumpProgress: number;
  jumpDuration: number;
  jumpStartPos: THREE.Vector3;
  lateralOffset: number;
  isFinished: boolean;
  finishRank?: number;
  squash: { x: number; y: number; z: number };
}

interface FictionalRacerProfile {
  name: string;
  countryCode: string;
  flag: string;
  countryName: string;
}

const FICTIONAL_RACER_ROSTER: FictionalRacerProfile[] = [
  { name: 'NeonRider', countryCode: 'IN', flag: '🇮🇳', countryName: 'India' },
  { name: 'TurboBeat', countryCode: 'AU', flag: '🇦🇺', countryName: 'Australia' },
  { name: 'StarHop', countryCode: 'GB', flag: '🇬🇧', countryName: 'United Kingdom' },
  { name: 'EchoRush', countryCode: 'GH', flag: '🇬🇭', countryName: 'Ghana' },
  { name: 'PixelDash', countryCode: 'GT', flag: '🇬🇹', countryName: 'Guatemala' },
  { name: 'NovaSprint', countryCode: 'GA', flag: '🇬🇦', countryName: 'Gabon' },
  { name: 'RhythmFox', countryCode: 'GD', flag: '🇬🇩', countryName: 'Grenada' },
  { name: 'SkyPulse', countryCode: 'GI', flag: '🇬🇮', countryName: 'Gibraltar' },
  { name: 'OrbitDash', countryCode: 'GS', flag: '🇬🇸', countryName: 'South Georgia' },
  { name: 'BeatRunner', countryCode: 'GN', flag: '🇬🇳', countryName: 'Guinea' },
  { name: 'HyperVibe', countryCode: 'JP', flag: '🇯🇵', countryName: 'Japan' },
  { name: 'AeroGlide', countryCode: 'BR', flag: '🇧🇷', countryName: 'Brazil' },
  { name: 'SonicShift', countryCode: 'CA', flag: '🇨🇦', countryName: 'Canada' },
  { name: 'SolarDrift', countryCode: 'SE', flag: '🇸🇪', countryName: 'Sweden' },
  { name: 'PulseMatrix', countryCode: 'DE', flag: '🇩🇪', countryName: 'Germany' },
  { name: 'VortexHop', countryCode: 'FR', flag: '🇫🇷', countryName: 'France' },
];

interface PlatformMeshItem {
  data: PlatformData;
  mesh: THREE.Group;
  topMesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  gemGroup?: THREE.Group;
  planetBeacon?: THREE.Group;
  targetY: number;
  currentY: number;
  velocity: number;
  previousX: number;
  laneIndex?: number; // -1 = Left, 0 = Center, 1 = Right
}

const PLATFORM_COLORS = [
  '#00f5ff', // Electric Cyan
  '#ff007f', // Vivid Hot Pink
  '#39ff14', // Acid Neon Green
  '#9d4edd', // Deep Purple / Violet
  '#ffb703', // Golden Amber
  '#ff6b35', // Warm Tangerine
  '#06d6a0', // Bright Aquamarine
  '#ec4899', // Bright Magenta
  '#38bdf8', // Sky Blue
  '#a855f7', // Electric Lilac
  '#f43f5e', // Hot Coral Rose
  '#eab308', // Radiant Yellow
];

interface GameEngineCallbacks {
  onStatsUpdate: (stats: GameStats) => void;
  onGameOver: (finalStats: GameStats) => void;
  onVictory: (finalStats: GameStats) => void;
  onPhaseChange: (phase: GamePhase) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;

  // Three.js Core
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private animFrameId: number | null = null;

  // Lighting & Environment
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private environmentGroup!: THREE.Group;

  // Scene Objects
  private ballMesh!: THREE.Group;
  private ballSphere!: THREE.Mesh;
  private ballLight!: THREE.PointLight;
  private starParticles!: THREE.Points;
  private shockwavePool: THREE.Mesh[] = [];
  private activeShockwaves: Array<{ mesh: THREE.Mesh; startTime: number; duration: number }> = [];

  // Daily Challenge & Opponents (Synchronized 3-Racer Competition)
  private isDailyChallengeMode = false;
  private botRacers: BotRacerData[] = [];
  private raceCountdownTimer = 0;
  private currentCountdownNum: number | null = null;
  private raceFinishCount = 0;
  private playerFinished = false;
  private playerFinishRank = 0;
  private currentLane: number = 0; // -1 = Left, 0 = Center, 1 = Right
  private isGameOverHandled = false;
  private previousBotCountryCodes: string[] = [];
  private cachedPlayerFlag: string = '🇮🇳';
  private cachedPlayerCountry: string = 'India';
  private lastLeaderboardUpdateTime: number = 0;

  // Platform Management
  private platformGroup: THREE.Group;
  private botExtraPlatformMeshes: THREE.Group[] = [];
  private platforms: PlatformMeshItem[] = []; // Center Lane (or standard level path)
  private leftPlatforms: PlatformMeshItem[] = []; // Left Lane (in Daily Challenge)
  private rightPlatforms: PlatformMeshItem[] = []; // Right Lane (in Daily Challenge)

  // Game & Level State
  private phase: GamePhase = 'title';
  private currentLevelConfig: LevelConfig = LEVELS[0];
  private currentSkin: BallSkin = BALL_SKINS[0];

  // Ball Physics State (Direct, intuitive hand control)
  private ballPos = new THREE.Vector3(0, 0.7, 0);
  private ballVel = new THREE.Vector3(0, 0, 0);
  private isGrounded = true;
  private currentPlatformIndex = 0;
  private ignorePlatformIndex = -1; // Never re-land on the pad we just hopped from
  private groundTimer = 0;
  private activeSteerDir = 0; // Pure player lateral hop direction (NO pad magnet!)
  private ballBaseRadius = 0.65;
  private ballSquash = { x: 1, y: 1, z: 1 };
  private gravity = 25.0;

  // Relative offset on current platform
  private platformRelPos = { x: 0, z: 0 };
  private targetPlatformRelX: number = 0;

  // Pointer tracking
  private isPointerDown = false;
  private pointerStartPos = { x: 0, y: 0 };
  private lastPointerPos = { x: 0, y: 0 };
  private pointerStartTime = 0;
  private totalDragDistance = 0;

  // Keyboard controls
  private keysHeld = { left: false, right: false, up: false, down: false };

  // Stats
  private stats: GameStats = {
    score: 0,
    totalCumulativeScore: 0,
    coinsEarnedInLevel: 0,
    totalCoins: 0,
    totalGems: 0,
    gemsCollectedInLevel: 0,
    totalGemsInLevel: LEVELS[0].totalGems,
    combo: 0,
    maxCombo: 0,
    targetPadsCleared: 0,
    totalTargetPads: LEVELS[0].targetPadsCount,
    currentLevel: 1,
  };

  private cameraShake = 0;
  private onPointerDownHandler: ((e: PointerEvent) => void) | null = null;
  private onPointerMoveHandler: ((e: PointerEvent) => void) | null = null;
  private onPointerUpHandler: (() => void) | null = null;
  private onKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private onKeyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private onBlurHandler: (() => void) | null = null;

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.currentLevelConfig.bgTop || 0x38bdf8);
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 160);
    this.updateCameraProjection(width, height);
    this.camera.position.set(0, 5.5, -6.5);
    this.camera.lookAt(0, 2.0, 5.0);

    this.clock = new THREE.Clock();

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.setupLighting();
    this.createBackgroundCosmicDust();

    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);

    this.platformGroup = new THREE.Group();
    this.scene.add(this.platformGroup);

    this.createBall();
    this.createBotRacers();
    this.initShockwaves();

    this.buildEnvironment(this.currentLevelConfig);
    this.generateLevelPlatforms();
    this.setupEventListeners();
    this.startLoop();
  }

  private buildEnvironment(cfg: LevelConfig) {
    if (!this.environmentGroup) {
      this.environmentGroup = new THREE.Group();
      this.scene.add(this.environmentGroup);
    }

    EnvironmentBuilder.build(
      this.scene,
      this.environmentGroup,
      cfg,
      this.hemiLight,
      this.dirLight
    );

    // Cosmic stars should only be visible in space/galaxy themes, not daylight beach/mountain/city/sky islands
    if (this.starParticles) {
      const isSpace =
        cfg.planetType?.includes('space') ||
        cfg.planetType?.includes('galaxy') ||
        cfg.planetType?.includes('orbital');
      this.starParticles.visible = Boolean(isSpace);
    }
  }

  /**
   * Sets authoritative baseline stats from the React/Firebase single source of truth.
   * GameEngine never reads or writes raw localStorage directly.
   */
  public setAuthoritativeStats(stats: Partial<GameStats>) {
    if (typeof stats.totalGems === 'number') this.stats.totalGems = Math.max(0, stats.totalGems);
    if (typeof stats.totalCoins === 'number') this.stats.totalCoins = Math.max(0, stats.totalCoins);
    if (typeof stats.totalCumulativeScore === 'number') this.stats.totalCumulativeScore = Math.max(0, stats.totalCumulativeScore);
    if (typeof stats.currentLevel === 'number') this.stats.currentLevel = stats.currentLevel;
  }

  private setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    this.dirLight.position.set(20, 35, 15);
    this.dirLight.castShadow = false;
    this.scene.add(this.dirLight);

    const rimLight = new THREE.DirectionalLight(0x00f5ff, 0.6);
    rimLight.position.set(-6, 8, 22);
    this.scene.add(rimLight);
  }

  private createBackgroundCosmicDust() {
    const starCount = 380;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colorA = new THREE.Color('#903bfb');
    const colorB = new THREE.Color('#00f5ff');
    const colorC = new THREE.Color('#ff2a7a');

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.2) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.2) * 200;

      const pick = Math.random();
      const col = pick < 0.4 ? colorA : pick < 0.7 ? colorB : colorC;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const starTexture = new THREE.CanvasTexture(canvas);
    starTexture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.PointsMaterial({
      size: 0.95,
      map: starTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.starParticles = new THREE.Points(geometry, material);
    this.scene.add(this.starParticles);
  }

  private saturnRingMesh?: THREE.Mesh;

  private createPlanetTexture(skinId: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, 512, 256);

    const isEarth = skinId.includes('earth') || skinId === 'cyber-cyan';
    const isVenus = skinId.includes('venus') || skinId === 'plasma-magenta';
    const isMars = skinId.includes('mars') || skinId === 'solar-crimson';
    const isJupiter = skinId.includes('jupiter') || skinId === 'hyper-lime';
    const isSaturn = skinId.includes('saturn') || skinId === 'midnight-navy';
    const isSun = skinId.includes('sun') || skinId === 'magma-orange';
    const isNeptune = skinId.includes('neptune') || skinId === 'mystic-teal';
    const isMoon = skinId.includes('moon') || skinId === 'diamond-frost';
    const isMercury = skinId.includes('mercury');
    const isGalaxy = skinId.includes('galaxy') || skinId === 'cosmic-purple' || skinId === 'golden-legend';

    if (isEarth) {
      // 1. Earth: Deep ocean blue, lush emerald continents, white atmospheric clouds
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 512, 256);

      // Continents (Green landmasses)
      ctx.fillStyle = '#10b981';
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        const cx = (i * 32 + 15) % 512;
        const cy = 40 + ((i * 22) % 170);
        ctx.arc(cx, cy, 35 + (i * 7) % 30, 0, Math.PI * 2);
        ctx.fill();
      }

      // Coastal shelves (Shallow turquoise water)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc((i * 45) % 512, 50 + (i * 18) % 150, 45, 0, Math.PI * 2);
        ctx.fill();
      }

      // Swirling white clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.ellipse((i * 55) % 512, 30 + (i * 24) % 190, 80, 14, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isVenus) {
      // 2. Venus: Bright sulfuric acid golden-yellow & lime-amber atmospheric swirls (NOT red/orange)
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#ca8a04');
      grad.addColorStop(0.3, '#facc15');
      grad.addColorStop(0.6, '#fde047');
      grad.addColorStop(0.85, '#eab308');
      grad.addColorStop(1, '#854d0e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = 'rgba(254, 240, 138, 0.6)';
      for (let i = 0; i < 16; i++) {
        ctx.fillRect(0, i * 16, 512, 8);
      }
      ctx.fillStyle = 'rgba(163, 230, 53, 0.25)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc((i * 65) % 512, 40 + i * 22, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isMars) {
      // 3. Mars: Fiery Martian iron rust crimson with dark canyons & bright white polar ice caps
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 512, 256);

      // Dark volcanic basalt canyons
      ctx.fillStyle = '#7f1d1d';
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.arc((i * 35 + 10) % 512, 45 + (i * 20) % 160, 36, 0, Math.PI * 2);
        ctx.fill();
      }

      // Craters
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc((i * 42) % 512, 50 + (i * 18) % 150, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Brilliant North and South polar ice caps
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 26);
      ctx.fillRect(0, 230, 512, 26);
    } else if (isJupiter) {
      // 4. Jupiter: Swirling mocha chocolate & rich caramel bands with giant Great Red Spot
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#451a03');
      grad.addColorStop(0.2, '#92400e');
      grad.addColorStop(0.35, '#fde68a');
      grad.addColorStop(0.55, '#78350f');
      grad.addColorStop(0.75, '#b45309');
      grad.addColorStop(1, '#451a03');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Gas turbulence stripes
      ctx.fillStyle = 'rgba(255, 247, 237, 0.4)';
      for (let i = 0; i < 14; i++) {
        ctx.fillRect(0, i * 18, 512, 9);
      }

      // The Great Red Spot
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.ellipse(320, 160, 54, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (isSaturn) {
      // 5. Saturn: Butterscotch golden gas giant bands
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#78350f');
      grad.addColorStop(0.25, '#d97706');
      grad.addColorStop(0.5, '#fef08a');
      grad.addColorStop(0.75, '#b45309');
      grad.addColorStop(1, '#451a03');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(0, i * 25, 512, 12);
      }
    } else if (isSun) {
      // 6. Sun: Blazing scorching solar plasma orange-yellow with solar flares
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#ff4500');
      grad.addColorStop(0.4, '#fb923c');
      grad.addColorStop(0.7, '#facc15');
      grad.addColorStop(1, '#ff4500');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Nuclear prominence flares
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 24; i++) {
        ctx.beginPath();
        ctx.arc((i * 24) % 512, 20 + (i * 15) % 210, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isNeptune) {
      // 7. Neptune: Deep midnight royal sapphire blue with electric cyan storm wisps
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.3, '#1e3a8a');
      grad.addColorStop(0.65, '#2563eb');
      grad.addColorStop(1, '#0284c7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Electric cyan methane storm streaks
      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(0, 30 + i * 22, 512, 6);
      }
    } else if (isMoon) {
      // 8. Moon: Silvery white lunar surface with dark basalt maria basins
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 512, 256);

      // Lunar Maria (Dark basalt seas)
      ctx.fillStyle = '#334155';
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.arc((i * 38) % 512, 35 + (i * 20) % 180, 42, 0, Math.PI * 2);
        ctx.fill();
      }

      // White crater rims
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc((i * 30 + 10) % 512, 25 + (i * 16) % 210, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (isMercury) {
      // 9. Mercury: Dark metallic gunmetal charcoal basalt
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = '#3f3f46';
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc((i * 32) % 512, 25 + (i * 16) % 200, 26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc((i * 44) % 512, 40 + (i * 18) % 170, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // 10. Cosmic Galaxy: Radiant electric magenta & violet nebula with starlight dust
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(0, 0, 512, 256);

      const grad = ctx.createRadialGradient(256, 128, 10, 256, 128, 220);
      grad.addColorStop(0, '#f472b6');
      grad.addColorStop(0.4, '#c026d3');
      grad.addColorStop(0.8, '#701a75');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.arc((i * 11) % 512, (i * 19) % 256, (i % 3) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createBall() {
    this.ballMesh = new THREE.Group();

    const sphereGeo = new THREE.SphereGeometry(this.ballBaseRadius, 32, 32);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      map: this.createPlanetTexture(this.currentSkin.id),
      color: new THREE.Color(0xffffff), // Pure white allows vibrant planet textures to display authentically!
      emissive: new THREE.Color(this.currentSkin.emissive),
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.15,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    });
    this.ballSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.ballSphere.castShadow = true;
    this.ballMesh.add(this.ballSphere);

    this.ballLight = new THREE.PointLight(new THREE.Color(this.currentSkin.color), 2.4, 8);
    this.ballMesh.add(this.ballLight);

    this.ballPos.set(0, 0.7, 0);
    this.ballMesh.position.copy(this.ballPos);
    this.scene.add(this.ballMesh);
  }

  public setSkin(skin: BallSkin) {
    this.currentSkin = skin;
    if (this.ballSphere) {
      const mat = this.ballSphere.material as THREE.MeshPhysicalMaterial;
      mat.map = this.createPlanetTexture(skin.id);
      mat.color.set(0xffffff); // Pure white allows vibrant planet textures to display authentically!
      mat.emissive.set(skin.emissive);
      mat.needsUpdate = true;
    }
    if (this.ballLight) {
      this.ballLight.color.set(skin.color);
    }
  }

  private createTextSprite(text: string, colorHex: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    // Rounded tag box with dark backdrop
    ctx.fillStyle = 'rgba(8, 12, 28, 0.92)';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;

    const x = 6, y = 6, w = 268, h = 60, r = 16;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text with emoji support
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 140, 36);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.62, 1);
    sprite.position.set(0, 1.45, 0);
    return sprite;
  }

  private createBotRacers() {
    const botConfigs = [
      {
        id: 'bot_nova',
        name: 'NeonRider',
        flag: '🇮🇳',
        countryCode: 'IN',
        countryName: 'India',
        colorHex: '#ff007f', // Vivid Hot Magenta / Pink
        emissiveHex: '#f43f5e',
        skinId: 'plasma-magenta',
        colorName: 'Pink',
        lateralOffset: -3.2, // Left parallel lane
      },
      {
        id: 'bot_pulse',
        name: 'TurboBeat',
        flag: '🇦🇺',
        countryCode: 'AU',
        countryName: 'Australia',
        colorHex: '#ffb703', // Radiant Golden Amber
        emissiveHex: '#f59e0b',
        skinId: 'golden-legend',
        colorName: 'Gold',
        lateralOffset: 3.2, // Right parallel lane
      },
    ];

    const sphereGeo = new THREE.SphereGeometry(this.ballBaseRadius, 32, 32);

    this.botRacers = botConfigs.map((cfg) => {
      const group = new THREE.Group();

      const mat = new THREE.MeshPhysicalMaterial({
        map: this.createPlanetTexture(cfg.skinId),
        color: new THREE.Color(0xffffff),
        emissive: new THREE.Color(cfg.emissiveHex),
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.15,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
      });

      const sphereMesh = new THREE.Mesh(sphereGeo, mat);
      sphereMesh.castShadow = true;
      group.add(sphereMesh);

      const light = new THREE.PointLight(new THREE.Color(cfg.colorHex), 2.2, 8);
      group.add(light);

      const labelSprite = this.createTextSprite(`${cfg.flag}`, cfg.colorHex);
      group.add(labelSprite);

      group.visible = false;
      this.scene.add(group);

      return {
        id: cfg.id,
        name: cfg.name,
        flag: cfg.flag,
        countryCode: cfg.countryCode,
        countryName: cfg.countryName,
        status: 'ACTIVE' as const,
        colorHex: cfg.colorHex,
        colorName: cfg.colorName,
        skinId: cfg.skinId,
        emissiveHex: cfg.emissiveHex,
        group,
        sphereMesh,
        light,
        labelSprite,
        currentPadIndex: 0,
        isGrounded: true,
        groundTime: 0,
        hopDelay: 0.14,
        baseJumpDuration: 0.54,
        baseHopDelay: 0.10,
        jumpProgress: 0,
        jumpDuration: 0.54,
        jumpStartPos: new THREE.Vector3(),
        lateralOffset: cfg.lateralOffset,
        isFinished: false,
        finishRank: undefined,
        squash: { x: 1, y: 1, z: 1 },
      };
    });
  }

  private setupDailyRaceRacers() {
    this.isDailyChallengeMode = this.currentLevelConfig.id === 9999;
    const startP = this.platforms[0];

    if (!this.isDailyChallengeMode) {
      this.botRacers.forEach((bot) => {
        bot.group.visible = false;
      });
      this.currentCountdownNum = null;
      this.raceCountdownTimer = 0;
      return;
    }

    this.raceFinishCount = 0;
    this.playerFinished = false;
    this.playerFinishRank = 0;
    this.raceCountdownTimer = 3.6;
    this.currentCountdownNum = 3;
    this.currentLane = 0;
    this.isGameOverHandled = false;
    this.stats.playerFell = false;
    this.stats.raceOutcome = undefined;

    // Cache player identity for the race (eliminates synchronous localStorage reads per frame)
    try {
      this.cachedPlayerFlag = localStorage.getItem('going_hop_player_flag') || '🇮🇳';
      this.cachedPlayerCountry = localStorage.getItem('going_hop_player_country') || 'India';
    } catch {
      // ignore
    }

    // Pick two distinct fictional opponents from FICTIONAL_RACER_ROSTER,
    // avoiding repeating the exact same pair of countries in consecutive races
    let availableRoster = FICTIONAL_RACER_ROSTER.filter(
      (r) => !this.previousBotCountryCodes.includes(r.countryCode)
    );
    if (availableRoster.length < 2) {
      availableRoster = [...FICTIONAL_RACER_ROSTER];
    }
    const shuffled = [...availableRoster].sort(() => Math.random() - 0.5);
    const assignedRacers = [shuffled[0], shuffled[1]];
    this.previousBotCountryCodes = [assignedRacers[0].countryCode, assignedRacers[1].countryCode];

    // Center player on center start pad (x = 0)
    if (startP) {
      this.platformRelPos = { x: 0, z: 0 };
      this.targetPlatformRelX = 0;
      this.ballPos.set(startP.data.x, 0.68, startP.data.z);
      this.ballMesh.position.copy(this.ballPos);
    }

    // Both opponents start on their own dedicated start pad in their own parallel lane!
    this.botRacers.forEach((bot, index) => {
      const profile = assignedRacers[index];
      bot.name = profile.name;
      bot.flag = profile.flag;
      bot.countryCode = profile.countryCode;
      bot.countryName = profile.countryName;
      bot.status = 'ACTIVE';

      // Refresh 3D name sprite with country flag only
      if (bot.labelSprite) {
        bot.group.remove(bot.labelSprite);
        if (bot.labelSprite.material && bot.labelSprite.material.map) {
          bot.labelSprite.material.map.dispose();
          bot.labelSprite.material.dispose();
        }
      }
      bot.labelSprite = this.createTextSprite(`${bot.flag}`, bot.colorHex);
      bot.group.add(bot.labelSprite);

      bot.group.visible = true;
      bot.isFinished = false;
      bot.finishRank = undefined;
      bot.squash = { x: 1, y: 1, z: 1 };
      bot.group.scale.set(1, 1, 1);

      bot.currentPadIndex = 0;
      bot.isGrounded = true;
      bot.groundTime = 0;
      bot.jumpProgress = 0;

      // Moderately reduced competitive difficulty profiles (~10-15% reduction):
      // Profile A (Sprinter): base jump 0.58s - 0.63s, hop delay 0.11s - 0.15s (cycle ~0.735s vs prev 0.635s, ~14% slower)
      // Profile B (Pacer): base jump 0.63s - 0.69s, hop delay 0.13s - 0.18s (cycle ~0.815s vs prev 0.70s, ~14% slower)
      if (index === 0) {
        bot.baseJumpDuration = 0.58 + Math.random() * 0.05;
        bot.baseHopDelay = 0.11 + Math.random() * 0.04;
      } else {
        bot.baseJumpDuration = 0.63 + Math.random() * 0.06;
        bot.baseHopDelay = 0.13 + Math.random() * 0.05;
      }
      bot.jumpDuration = bot.baseJumpDuration;
      bot.hopDelay = bot.baseHopDelay;

      if (startP) {
        bot.group.position.set(
          startP.mesh.position.x + bot.lateralOffset,
          startP.mesh.position.y + 0.68,
          startP.mesh.position.z
        );
      }
    });

    soundEngine.playCountdownBeep(false);
    this.updateRaceLeaderboard(true);
  }

  private updateRaceLeaderboard(forceNotify: boolean = false) {
    if (!this.isDailyChallengeMode) return;

    const totalTargetPads = Math.max(1, this.currentLevelConfig.targetPadsCount);

    const playerZ = this.ballPos.z;
    const playerProgress = Math.min(
      100,
      Math.round((this.stats.targetPadsCleared / totalTargetPads) * 100)
    );

    // If player finished: 1000000 - rank * 10000
    // If player fell: -1000000 + progress (ranked below any active/finishing racer)
    // If active: playerZ
    let playerOrderScore = playerZ;
    if (this.playerFinished) {
      playerOrderScore = 1000000 - (this.playerFinishRank || 1) * 10000;
    } else if (this.stats.playerFell) {
      playerOrderScore = -1000000 + this.stats.targetPadsCleared;
    }

    const playerFlag = this.cachedPlayerFlag;
    const playerCountry = this.cachedPlayerCountry;

    const playerStatus: 'ACTIVE' | 'FINISHED' | 'FELL' = this.stats.playerFell
      ? 'FELL'
      : this.playerFinished
      ? 'FINISHED'
      : 'ACTIVE';

    const racers = [
      {
        id: 'player',
        name: 'YOU',
        isBot: false,
        flag: playerFlag,
        countryCode: 'YOU',
        countryName: playerCountry,
        color: this.currentSkin.color || '#00f5ff',
        colorName: 'Cyan',
        orderScore: playerOrderScore,
        currentPad: this.stats.targetPadsCleared,
        totalPads: totalTargetPads,
        progressPercent: playerProgress,
        isFinished: this.playerFinished,
        finishRank: this.playerFinishRank || undefined,
        status: playerStatus,
        position: 1,
      },
      ...this.botRacers.map((bot) => {
        const botZ = bot.group.position.z;
        const botProgress = Math.min(
          100,
          Math.round((bot.currentPadIndex / totalTargetPads) * 100)
        );
        const botOrderScore = bot.isFinished
          ? 1000000 - (bot.finishRank || 1) * 10000
          : botZ;

        return {
          id: bot.id,
          name: bot.name,
          isBot: true,
          flag: bot.flag,
          countryCode: bot.countryCode,
          countryName: bot.countryName,
          color: bot.colorHex,
          colorName: bot.colorName,
          orderScore: botOrderScore,
          currentPad: bot.currentPadIndex,
          totalPads: totalTargetPads,
          progressPercent: botProgress,
          isFinished: bot.isFinished,
          finishRank: bot.finishRank,
          status: (bot.isFinished ? 'FINISHED' : 'ACTIVE') as 'ACTIVE' | 'FINISHED' | 'FELL',
          position: 1,
        };
      }),
    ];

    racers.sort((a, b) => b.orderScore - a.orderScore);

    racers.forEach((r, idx) => {
      r.position = idx + 1;
    });

    const playerEntry = racers.find((r) => r.id === 'player');
    if (playerEntry) {
      this.stats.racePosition = this.stats.playerFell ? 3 : playerEntry.position;
    }

    this.stats.raceParticipants = racers.map((r) => ({
      id: r.id,
      name: r.name,
      isPlayer: r.id === 'player',
      isHuman: !r.isBot,
      isBot: r.isBot,
      flag: r.flag,
      countryCode: r.countryCode,
      countryName: r.countryName,
      color: r.color,
      colorName: r.colorName,
      progressPercent: r.progressPercent,
      currentPad: r.currentPad,
      totalPads: r.totalPads,
      position: r.position,
      isFinished: r.isFinished,
      finishRank: r.finishRank,
      status: r.status,
    }));

    this.stats.countdown = this.currentCountdownNum;

    // Throttle React state notifications to avoid 60fps component re-render churn
    const now = performance.now();
    if (forceNotify || now - this.lastLeaderboardUpdateTime >= 100) {
      this.lastLeaderboardUpdateTime = now;
      this.callbacks.onStatsUpdate(this.stats);
    }
  }

  private initShockwaves() {
    const ringGeo = new THREE.RingGeometry(0.3, 1.8, 32);
    ringGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 8; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.visible = false;
      this.scene.add(ring);
      this.shockwavePool.push(ring);
    }
  }

  private triggerShockwave(x: number, y: number, z: number, colorHex: string) {
    const ring = this.shockwavePool.find((r) => !r.visible) || this.shockwavePool[0];
    ring.visible = true;
    ring.position.set(x, y + 0.05, z);
    ring.scale.set(0.2, 0.2, 0.2);
    (ring.material as THREE.MeshBasicMaterial).color.set(colorHex);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.95;

    this.activeShockwaves.push({
      mesh: ring,
      startTime: performance.now(),
      duration: 380,
    });
  }

  public setLevel(level: LevelConfig, shouldReset: boolean = true) {
    this.currentLevelConfig = level;
    this.buildEnvironment(level);
    if (shouldReset) {
      this.resetGame();
    }
  }

  private generateLevelPlatforms() {
    this.platforms.forEach((p) => {
      this.platformGroup.remove(p.mesh);
    });
    this.platforms = [];
    this.leftPlatforms.forEach((p) => {
      this.platformGroup.remove(p.mesh);
    });
    this.leftPlatforms = [];
    this.rightPlatforms.forEach((p) => {
      this.platformGroup.remove(p.mesh);
    });
    this.rightPlatforms = [];
    this.botExtraPlatformMeshes.forEach((mesh) => {
      this.platformGroup.remove(mesh);
    });
    this.botExtraPlatformMeshes = [];

    const cfg = this.currentLevelConfig;
    const totalPads = cfg.platformsCount;
    const gap = cfg.gapDistance;

    const pWidth = 2.4;
    const pLength = 2.4;
    const pHeight = 0.54;

    // Pre-calculate exact platforms that contain gems (distributed evenly)
    const eligibleIndices: number[] = [];
    for (let i = 1; i < totalPads - 1; i++) {
      eligibleIndices.push(i);
    }
    const targetGemsCount = Math.min(cfg.totalGems, eligibleIndices.length);
    const gemPadIndices = new Set<number>();
    const step = eligibleIndices.length / targetGemsCount;
    for (let g = 0; g < targetGemsCount; g++) {
      let idx = Math.min(eligibleIndices.length - 1, Math.floor(g * step + step * 0.35));
      while (gemPadIndices.has(eligibleIndices[idx]) && idx < eligibleIndices.length - 1) {
        idx++;
      }
      gemPadIndices.add(eligibleIndices[idx]);
    }
    // Guarantee EXACT count of targetGemsCount
    for (const el of eligibleIndices) {
      if (gemPadIndices.size >= targetGemsCount) break;
      gemPadIndices.add(el);
    }

    let currentX = 0;
    let dir = 1;
    let actualGemsCount = 0;

    for (let i = 0; i < totalPads; i++) {
      const isStartPad = i === 0;
      const isGoal = i === totalPads - 1;
      const z = i * gap;
      
      // Aerial staircase ascension into the sky as shown in Image 1 and Image 2!
      const y = isStartPad ? 0 : i * 0.4;

      // Sizing based on tuned difficulty curve:
      let padWidth = 2.4;
      let padLength = 2.4;

      if (isStartPad || isGoal) {
        padWidth = 3.4;
        padLength = 3.4;
      } else if (cfg.id === 9999) {
        // Daily Challenge: Generously sized parallel lanes for comfortable, exhilarating racing
        padWidth = 2.4;
        padLength = 2.4;
      } else if (cfg.id <= 10) {
        // Levels 1-10: Approachable starting pads
        padWidth = 2.4;
        padLength = 2.4;
      } else if (cfg.id <= 50) {
        // Levels 11-50: Narrower pads, faster pace (Increased difficulty as requested)
        padWidth = 2.2;
        padLength = 2.2;
      } else if (cfg.id <= 100) {
        // Levels 51-100: High difficulty, compact precision landing pads
        padWidth = 2.0;
        padLength = 2.0;
      } else {
        // Levels 101-150: Master tier
        padWidth = 1.95;
        padLength = 1.95;
      }

      if (isStartPad) {
        currentX = 0;
      } else if (!isGoal) {
        if (cfg.id === 9999) {
          // Smooth racing circuit alignment: gentle curving so all 3 parallel tracks remain fully in camera view
          currentX += dir * 0.45;
          if (Math.abs(currentX) > 1.2) dir *= -1;
        } else if (cfg.id <= 50) {
          currentX += dir * (1.1 + Math.random() * 0.5);
          if (Math.abs(currentX) > 2.2) dir *= -1;
        } else if (cfg.id <= 100) {
          currentX += dir * (1.3 + Math.random() * 0.7);
          if (Math.abs(currentX) > 2.7) dir *= -1;
        } else {
          currentX += dir * (1.4 + Math.random() * 0.7);
          if (Math.abs(currentX) > 2.9) dir *= -1;
        }
      } else {
        currentX = currentX * 0.5;
      }

      // Moving platforms frequency based on difficulty tier (standard levels only, Daily Challenge tracks are stable parallel lanes):
      let isMoving = false;
      if (cfg.hasMovingPlatforms && !isStartPad && !isGoal && cfg.id !== 9999) {
        if (cfg.id <= 50) {
          isMoving = (i % 3 === 0 || i % 7 === 0);
        } else if (cfg.id <= 100) {
          isMoving = (i % 2 === 0 || i % 5 === 0);
        } else {
          isMoving = (i % 2 === 0 || i % 3 === 0);
        }
      }

      const moveSpeed = isMoving ? cfg.movingPlatformSpeed * (0.95 + (i % 3) * 0.18) : 0;
      const moveAmplitude = isMoving ? cfg.movingAmplitude : 0;
      const movePhase = (i * Math.PI) / 3;

      let colorHex = '#00ff88';
      if (isGoal) {
        colorHex = cfg.planetColor;
      } else if (!isStartPad) {
        colorHex = PLATFORM_COLORS[(i - 1) % PLATFORM_COLORS.length];
      }

      const hasGem = gemPadIndices.has(i);
      if (hasGem) actualGemsCount++;

      const pData: PlatformData = {
        id: i,
        index: i,
        baseX: currentX,
        x: currentX,
        y,
        z,
        width: padWidth,
        length: padLength,
        height: pHeight,
        colorHex,
        isMoving,
        moveSpeed,
        moveAmplitude,
        movePhase,
        hasGem,
        isStartPad,
        isGoal,
        visited: isStartPad,
      };

      // Center Lane Pad: Dedicated for the Player (YOU)
      const pMesh = this.createPlatformMesh(pData, cfg);
      pMesh.laneIndex = 0;
      this.platformGroup.add(pMesh.mesh);
      this.platforms.push(pMesh);

      // In Daily Challenge, generate separate, visually distinct Left and Right lane pads
      if (cfg.id === 9999) {
        // Left Lane Pad: Dedicated for Left Lane with Vivid Hot Magenta (#ff007f) theme trim
        const leftData: PlatformData = {
          ...pData,
          id: 100000 + i,
          x: currentX - 3.2,
          baseX: currentX - 3.2,
          colorHex: isGoal ? '#ff007f' : isStartPad ? '#ff007f' : '#f43f5e',
          hasGem: false,
          visited: isStartPad,
        };
        const leftMesh = this.createPlatformMesh(leftData, cfg);
        leftMesh.laneIndex = -1;
        this.platformGroup.add(leftMesh.mesh);
        this.leftPlatforms.push(leftMesh);
        this.botExtraPlatformMeshes.push(leftMesh.mesh);

        // Right Lane Pad: Dedicated for Right Lane with Radiant Golden Amber (#ffb703) theme trim
        const rightData: PlatformData = {
          ...pData,
          id: 200000 + i,
          x: currentX + 3.2,
          baseX: currentX + 3.2,
          colorHex: isGoal ? '#ffb703' : isStartPad ? '#ffb703' : '#f59e0b',
          hasGem: false,
          visited: isStartPad,
        };
        const rightMesh = this.createPlatformMesh(rightData, cfg);
        rightMesh.laneIndex = 1;
        this.platformGroup.add(rightMesh.mesh);
        this.rightPlatforms.push(rightMesh);
        this.botExtraPlatformMeshes.push(rightMesh.mesh);
      }
    }

    this.stats.totalTargetPads = cfg.targetPadsCount;
    this.stats.targetPadsCleared = 0;
    this.stats.totalGemsInLevel = actualGemsCount;
    this.stats.gemsCollectedInLevel = 0;
    this.stats.coinsEarnedInLevel = 0;
    this.stats.currentLevel = cfg.id;
  }

  private platformTextureCache = new Map<string, THREE.CanvasTexture>();

  private getPlatformTopTexture(cfg: LevelConfig, isStart: boolean, isGoal: boolean): THREE.CanvasTexture {
    const key = `${cfg.planetType || 'sky_islands'}_${isStart}_${isGoal}`;
    if (this.platformTextureCache.has(key)) {
      return this.platformTextureCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const type = cfg.planetType || 'sky_islands';

    if (type.includes('sky')) {
      // 1. Sky Castle Islands (Image 2): Ancient cracked stone pavers with moss/grass tufts & yellow hazard caution borders
      ctx.fillStyle = '#64748b'; // stone gray
      ctx.fillRect(0, 0, 256, 256);

      // Flagstone crack lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(35, 75); ctx.lineTo(120, 90); ctx.lineTo(220, 70);
      ctx.moveTo(70, 85); ctx.lineTo(85, 175); ctx.lineTo(160, 195);
      ctx.moveTo(140, 92); ctx.lineTo(150, 150); ctx.lineTo(220, 160);
      ctx.stroke();

      // Green moss & grass tufts in fissures & borders
      ctx.fillStyle = '#4ade80';
      for (let m = 0; m < 45; m++) {
        const mx = 38 + Math.random() * 180;
        const my = 10 + Math.random() * 236;
        ctx.fillRect(mx, my, 4, 4);
      }

      // Yellow caution borders on sides
      this.drawHazardBorder(ctx, '#facc15', '#1e293b', 34);

      if (!isGoal) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(44, 20, 168, 216);
      }
    } else if (type.includes('coastal')) {
      // 2. Coastal City (Image 1): Asphalt road with crisp white dashed centerline & black/yellow chevron hazard borders
      ctx.fillStyle = '#1e293b'; // dark asphalt
      ctx.fillRect(0, 0, 256, 256);

      // Asphalt grain
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      for (let i = 0; i < 300; i++) {
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }

      // Yellow/black chevron hazard borders
      this.drawHazardBorder(ctx, '#facc15', '#0f172a', 34);

      // White dashed centerline
      if (!isGoal) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 7;
        ctx.setLineDash([20, 16]);
        ctx.beginPath();
        ctx.moveTo(128, 0);
        ctx.lineTo(128, 256);
        ctx.stroke();
      }
    } else if (type.includes('beach')) {
      // 3. Tropical Beach: Boardwalk wood planks with timber grain & rope borders
      ctx.fillStyle = '#b45309'; // warm teak wood
      ctx.fillRect(0, 0, 256, 256);

      // Horizontal plank grooves
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      for (let y = 32; y < 256; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }

      // Brass nail rivets
      ctx.fillStyle = '#fde047';
      for (let y = 16; y < 256; y += 32) {
        ctx.fillRect(40, y, 4, 4);
        ctx.fillRect(212, y, 4, 4);
      }

      this.drawHazardBorder(ctx, '#fbbf24', '#78350f', 32);
    } else if (type.includes('forest') || type.includes('temple')) {
      // 4. Forest Temple: Ancient carved stone with Mayan glyphs and creeping vines
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 256, 256);

      // Ancient stone carvings
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 176, 176);
      ctx.beginPath();
      ctx.arc(128, 128, 48, 0, Math.PI * 2);
      ctx.stroke();

      // Green ivy leaves
      ctx.fillStyle = '#22c55e';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(35 + Math.random() * 186, Math.random() * 256, 5, 5);
      }

      this.drawHazardBorder(ctx, '#eab308', '#064e3b', 32);
    } else if (type.includes('mountain') || type.includes('snow')) {
      // 5. Snowy Mountain: Frosted slate stone coated in crisp white snow & cyan ice edges
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, 256, 256);

      // Snow patches
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(40, 30, 176, 196);

      this.drawHazardBorder(ctx, '#38bdf8', '#0f172a', 32);
    } else if (type.includes('tokyo') || type.includes('city') || type.includes('neon')) {
      // 6. Tokyo Neon City: Cyberpunk hex grid with hot pink & cyan neon LED borders
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 256, 256);

      // Neon cyan grid
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.35)';
      ctx.lineWidth = 2;
      for (let x = 34; x <= 222; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
      }
      for (let y = 0; y <= 256; y += 30) {
        ctx.beginPath(); ctx.moveTo(34, y); ctx.lineTo(222, y); ctx.stroke();
      }

      this.drawHazardBorder(ctx, '#00f5ff', '#ff007f', 32);
    } else if (type.includes('desert')) {
      // 7. Red Desert: Carved sandstone with geometric sun glyphs & terracotta borders
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 176, 176);

      this.drawHazardBorder(ctx, '#f97316', '#451a03', 32);
    } else if (type.includes('crystal')) {
      // 8. Crystal Islands: Amethyst geode facet with magenta/cyan gemstone borders
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.fillRect(40, 40, 176, 176);

      this.drawHazardBorder(ctx, '#ec4899', '#3b0764', 32);
    } else if (type.includes('sea')) {
      // 9. Deep Sea: Pearl ocean stone with bioluminescent coral trims
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.fillRect(40, 40, 176, 176);

      this.drawHazardBorder(ctx, '#06b6d4', '#082f49', 32);
    } else if (type.includes('bamboo')) {
      // 11. Bamboo Valley: Jade green stone with woven bamboo borders
      ctx.fillStyle = '#166534';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(132, 204, 22, 0.4)';
      ctx.fillRect(40, 40, 176, 176);
      this.drawHazardBorder(ctx, '#84cc16', '#14532d', 32);
    } else if (type.includes('venice')) {
      // 12. Venice Canals: Venetian cobblestone with terracotta borders
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, 176, 176);
      this.drawHazardBorder(ctx, '#f97316', '#475569', 32);
    } else if (type.includes('volcano')) {
      // 13. Volcano Caldera: Obsidian basalt with glowing magma fissures
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 176, 176);
      this.drawHazardBorder(ctx, '#dc2626', '#450a0a', 32);
    } else if (type.includes('autumn')) {
      // 14. Autumn Highlands: Amber golden stone with warm crimson trim
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.fillRect(40, 40, 176, 176);
      this.drawHazardBorder(ctx, '#f59e0b', '#78350f', 32);
    } else if (type.includes('aurora') || type.includes('glacier')) {
      // 15. Aurora Glacier: Frosted arctic glass with turquoise aurora trim
      ctx.fillStyle = '#0f766e';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(45, 212, 191, 0.4)';
      ctx.fillRect(40, 40, 176, 176);
      this.drawHazardBorder(ctx, '#2dd4bf', '#042f2e', 32);
    } else {
      // Andromeda Galaxy: Cosmic obsidian with starlight dust
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.fillRect(40, 40, 176, 176);

      this.drawHazardBorder(ctx, '#a855f7', '#020617', 32);
    }

    // Goal emblem
    if (isGoal) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 128, 64, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(128, 128, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.platformTextureCache.set(key, texture);
    return texture;
  }

  private drawHazardBorder(ctx: CanvasRenderingContext2D, colorA: string, colorB: string, stripeW: number) {
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, stripeW, 256);
    ctx.fillRect(256 - stripeW, 0, stripeW, 256);

    ctx.fillStyle = colorB;
    for (let y = -20; y < 280; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(stripeW, y + 14);
      ctx.lineTo(stripeW, y + 24);
      ctx.lineTo(0, y + 10);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(256 - stripeW, y);
      ctx.lineTo(256, y + 14);
      ctx.lineTo(256, y + 24);
      ctx.lineTo(256 - stripeW, y + 10);
      ctx.fill();
    }
  }

  private createPlatformMesh(data: PlatformData, cfg: LevelConfig): PlatformMeshItem {
    const meshGroup = new THREE.Group();
    meshGroup.position.set(data.x, data.y, data.z);

    const type = cfg.planetType || 'sky_islands';

    // 1. Top road / stone / grass slab with yellow hazard caution borders
    const topGeo = new THREE.BoxGeometry(data.width, 0.08, data.length);
    const topTex = this.getPlatformTopTexture(cfg, Boolean(data.isStartPad), Boolean(data.isGoal));
    const topMat = new THREE.MeshStandardMaterial({
      map: topTex,
      roughness: 0.5,
      metalness: 0.15,
    });
    const mainBox = new THREE.Mesh(topGeo, topMat);
    mainBox.position.y = 0.04;
    mainBox.receiveShadow = true;
    mainBox.castShadow = true;
    meshGroup.add(mainBox);

    // 2. Theme-Specific 3D Chassis underneath
    let chassisColor = 0x334155;
    let chassisRoughness = 0.8;
    let chassisMetalness = 0.2;

    if (type.includes('sky')) {
      // Natural mossy stone cliff chunk
      chassisColor = 0x57534e;
      chassisRoughness = 0.95;
    } else if (type.includes('coastal')) {
      // Highway concrete block
      chassisColor = 0x64748b;
      chassisRoughness = 0.6;
    } else if (type.includes('beach')) {
      // Timber beam block
      chassisColor = 0x78350f;
      chassisRoughness = 0.85;
    } else if (type.includes('forest')) {
      // Ancient carved mossy stone
      chassisColor = 0x1f2937;
      chassisRoughness = 0.9;
    } else if (type.includes('mountain')) {
      // Glacier ice block
      chassisColor = 0x38bdf8;
      chassisRoughness = 0.2;
      chassisMetalness = 0.1;
    } else if (type.includes('tokyo')) {
      // High-tech dark alloy
      chassisColor = 0x1e1b4b;
      chassisRoughness = 0.3;
      chassisMetalness = 0.8;
    } else if (type.includes('desert')) {
      // Warm sandstone mesa strata
      chassisColor = 0x9a3412;
      chassisRoughness = 0.9;
    } else if (type.includes('crystal')) {
      // Amethyst crystal block
      chassisColor = 0x7e22ce;
      chassisRoughness = 0.15;
      chassisMetalness = 0.4;
    } else if (type.includes('sea')) {
      // Marine coral rock
      chassisColor = 0x0284c7;
      chassisRoughness = 0.7;
    } else {
      // Deep space titanium hull
      chassisColor = 0x111827;
      chassisRoughness = 0.4;
      chassisMetalness = 0.8;
    }

    const baseGeo = new THREE.BoxGeometry(data.width * 0.96, data.height, data.length * 0.96);
    const baseMat = new THREE.MeshStandardMaterial({
      color: chassisColor,
      roughness: chassisRoughness,
      metalness: chassisMetalness,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -data.height / 2;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    meshGroup.add(baseMesh);

    // 3. Floating underglow for readability
    const underglowGeo = new THREE.PlaneGeometry(data.width * 1.3, data.length * 1.3);
    underglowGeo.rotateX(-Math.PI / 2);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(data.colorHex),
      transparent: true,
      opacity: data.isGoal ? 0.6 : data.isStartPad ? 0.45 : 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(underglowGeo, underglowMat);
    glowMesh.position.y = -data.height - 0.05;
    meshGroup.add(glowMesh);

    let gemGroup: THREE.Group | undefined;
    if (data.hasGem) {
      gemGroup = new THREE.Group();
      gemGroup.position.set(0, 1.1, 0);

      const gemGeo = new THREE.OctahedronGeometry(0.38, 0);
      const gemMat = new THREE.MeshPhysicalMaterial({
        color: 0x00f5ff,
        emissive: 0x00c8ff,
        emissiveIntensity: 0.85,
        roughness: 0.1,
        metalness: 0.9,
      });
      const gemMesh = new THREE.Mesh(gemGeo, gemMat);
      gemGroup.add(gemMesh);

      meshGroup.add(gemGroup);
    }

    // 4. Glowing 3D Finish Flag on Goal Pad (Matches Reference Images 1 & 2!)
    let planetBeacon: THREE.Group | undefined;
    if (data.isGoal) {
      planetBeacon = new THREE.Group();
      planetBeacon.position.set(0, 0.08, 0);

      // Flagpole
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.0, 8);
      const poleMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.2,
      });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(-0.9, 2.0, 0);
      planetBeacon.add(pole);

      // Golden Finial ball
      const finialGeo = new THREE.SphereGeometry(0.2, 12, 12);
      const finial = new THREE.Mesh(finialGeo, poleMat);
      finial.position.set(-0.9, 4.0, 0);
      planetBeacon.add(finial);

      // Waving silk finish flag banner
      const flagGeo = new THREE.BufferGeometry();
      const flagVerts = new Float32Array([
        -0.9, 3.8, 0,
        0.8, 3.4, 0.15,
        -0.9, 2.6, 0,
        0.8, 3.4, 0.15,
        0.7, 2.4, 0.12,
        -0.9, 2.6, 0,
      ]);
      flagGeo.setAttribute('position', new THREE.BufferAttribute(flagVerts, 3));
      flagGeo.computeVertexNormals();

      const flagColor = type.includes('coastal') ? 0xffd700 : 0xef4444;
      const flagMat = new THREE.MeshStandardMaterial({
        color: flagColor,
        emissive: flagColor,
        emissiveIntensity: 0.55,
        side: THREE.DoubleSide,
        roughness: 0.3,
      });
      const flagMesh = new THREE.Mesh(flagGeo, flagMat);
      planetBeacon.add(flagMesh);

      // Glowing finish circle on pad surface
      const beaconRingGeo = new THREE.RingGeometry(0.6, 1.4, 32);
      beaconRingGeo.rotateX(-Math.PI / 2);
      const beaconRingMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
      beaconRing.position.y = 0.05;
      planetBeacon.add(beaconRing);

      meshGroup.add(planetBeacon);
    }

    return {
      data,
      mesh: meshGroup,
      topMesh: mainBox,
      glowMesh,
      gemGroup,
      planetBeacon,
      targetY: 0,
      currentY: 0,
      velocity: 0,
      previousX: data.x,
    };
  }

  // --- ACCURATE, RESPONSIVE MANUAL CONTROLS ---

  public getCurrentPlatform(): PlatformMeshItem | undefined {
    if (this.isDailyChallengeMode) {
      if (this.currentLane === -1) return this.leftPlatforms[this.currentPlatformIndex];
      if (this.currentLane === 1) return this.rightPlatforms[this.currentPlatformIndex];
    }
    return this.platforms[this.currentPlatformIndex];
  }

  public getNextPlatform(): PlatformMeshItem | undefined {
    const nextIdx = this.currentPlatformIndex + 1;
    if (this.isDailyChallengeMode) {
      if (this.currentLane === -1) return this.leftPlatforms[nextIdx] || this.platforms[nextIdx];
      if (this.currentLane === 1) return this.rightPlatforms[nextIdx] || this.platforms[nextIdx];
    }
    return this.platforms[nextIdx];
  }

  public steerLeft(amount: number = 0.4) {
    if (this.phase !== 'playing') return;
    if (this.isGrounded) {
      // On platform: Smoothly target position for rolling slide
      const currentPlat = this.getCurrentPlatform();
      if (currentPlat) {
        const maxHalfW = currentPlat.data.width / 2 - this.ballBaseRadius * 0.15;
        this.targetPlatformRelX = Math.max(-maxHalfW, this.targetPlatformRelX - amount);
      }
    } else {
      // In mid-air: Active lateral nudge so player can switch lanes mid-flight
      this.ballPos.x = Math.max(-5.4, this.ballPos.x - amount * 1.6);
      this.ballVel.x = Math.max(-6.5, this.ballVel.x - 2.8);
      this.ballSphere.rotation.z += amount * 4;
    }
  }

  public steerRight(amount: number = 0.4) {
    if (this.phase !== 'playing') return;
    if (this.isGrounded) {
      // On platform: Smoothly target position for rolling slide
      const currentPlat = this.getCurrentPlatform();
      if (currentPlat) {
        const maxHalfW = currentPlat.data.width / 2 - this.ballBaseRadius * 0.15;
        this.targetPlatformRelX = Math.min(maxHalfW, this.targetPlatformRelX + amount);
      }
    } else {
      // In mid-air: Active lateral nudge so player can switch lanes mid-flight
      this.ballPos.x = Math.min(5.4, this.ballPos.x + amount * 1.6);
      this.ballVel.x = Math.min(6.5, this.ballVel.x + 2.8);
      this.ballSphere.rotation.z -= amount * 4;
    }
  }

  public jump() {
    if (this.phase === 'title' || this.phase === 'gameover' || this.phase === 'victory') {
      this.startGame();
    } else if (this.isGrounded) {
      // Ball hops STRAIGHT forward from wherever the player positioned it!
      this.launchBall(1.0, 0);
    } else {
      // In-flight active boost
      this.ballVel.y = Math.max(this.ballVel.y, 6.5);
      soundEngine.playJumpLaunch(0.9);
    }
  }

  private setupEventListeners() {
    const el = this.renderer.domElement;

    this.onPointerDownHandler = (e: PointerEvent) => {
      if (this.phase === 'title') {
        this.startGame();
        return;
      }
      if (this.phase !== 'playing') return;

      this.isPointerDown = true;
      this.pointerStartPos = { x: e.clientX, y: e.clientY };
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      this.pointerStartTime = performance.now();
      this.totalDragDistance = 0;
    };

    this.onPointerMoveHandler = (e: PointerEvent) => {
      if (!this.isPointerDown || this.phase !== 'playing') return;

      // Invert screen-to-world X mapping: Three.js camera looks down +Z from behind, so screen LEFT maps to World +X
      const deltaX = -(e.clientX - this.lastPointerPos.x);
      const deltaY = e.clientY - this.lastPointerPos.y;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };

      this.totalDragDistance += Math.hypot(deltaX, deltaY);

      if (this.isGrounded) {
        const currentPlat = this.getCurrentPlatform();
        if (currentPlat) {
          const maxHalfW = currentPlat.data.width / 2 - this.ballBaseRadius * 0.3;
          const maxHalfL = currentPlat.data.length / 2 - this.ballBaseRadius * 0.3;

          this.platformRelPos.x += deltaX / 95;
          this.platformRelPos.z -= deltaY / 95;

          this.platformRelPos.x = Math.max(-maxHalfW, Math.min(maxHalfW, this.platformRelPos.x));
          this.platformRelPos.z = Math.max(-maxHalfL, Math.min(maxHalfL, this.platformRelPos.z));
          this.targetPlatformRelX = this.platformRelPos.x;

          this.ballSphere.rotation.z -= (deltaX / 95) * 4;
          this.ballSphere.rotation.x -= (deltaY / 95) * 4;
        }
      } else {
        this.ballPos.x += deltaX / 85;
        this.ballPos.x = Math.max(-5.4, Math.min(5.4, this.ballPos.x));
        this.ballVel.z = Math.max(5.0, Math.min(15.0, this.ballVel.z - (deltaY / 150) * 3));
      }
    };

    this.onPointerUpHandler = () => {
      this.isPointerDown = false;
      this.targetPlatformRelX = this.platformRelPos.x;
    };

    this.onKeyDownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (this.phase === 'title' || this.phase === 'gameover' || this.phase === 'victory') {
          this.startGame();
        } else if (this.isGrounded) {
          this.launchBall(1.0, 0);
        }
        return;
      }

      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keysHeld.up = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keysHeld.down = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keysHeld.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keysHeld.right = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
    };

    this.onKeyUpHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keysHeld.up = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keysHeld.down = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keysHeld.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keysHeld.right = false;
    };

    this.onBlurHandler = () => {
      this.keysHeld = { left: false, right: false, up: false, down: false };
      this.isPointerDown = false;
    };

    el.addEventListener('pointerdown', this.onPointerDownHandler);
    window.addEventListener('pointermove', this.onPointerMoveHandler);
    window.addEventListener('pointerup', this.onPointerUpHandler);
    window.addEventListener('pointercancel', this.onPointerUpHandler);
    window.addEventListener('keydown', this.onKeyDownHandler);
    window.addEventListener('keyup', this.onKeyUpHandler);
    window.addEventListener('blur', this.onBlurHandler);
    window.addEventListener('resize', this.onWindowResize);
  }

  // Jump Launch - Straight-ahead forward hop physics
  public launchBall(powerRatio: number = 1.0, steerRatio: number = 0) {
    if (!this.isGrounded) return;
    // Synchronized countdown guard: ball cannot hop until countdown finishes (3-2-1-GO!)
    if (this.isDailyChallengeMode && this.currentCountdownNum !== null && this.currentCountdownNum > 0) return;

    this.isGrounded = false;
    this.groundTimer = 0;
    this.ignorePlatformIndex = this.currentPlatformIndex;

    // Natural forward leap based on level gap and ascending platform deltaY
    const gap = this.currentLevelConfig.gapDistance || 6.2;
    const flightTime = 0.68;
    this.ballVel.z = (gap / flightTime) * powerRatio;

    const currentPlat = this.getCurrentPlatform();
    const nextPlat = this.getNextPlatform();
    const deltaY = (nextPlat && currentPlat) ? (nextPlat.mesh.position.y - currentPlat.mesh.position.y) : 0;
    this.ballVel.y = (deltaY / flightTime) + (0.5 * this.gravity * flightTime) * Math.sqrt(powerRatio);

    // Lateral direction: 0 by default so the ball hops STRAIGHT forward from where the player positioned it!
    // If the player is actively holding steering keys at the exact instant of jump, apply a gentle nudge
    let lateralSteer = steerRatio;
    if (lateralSteer === 0) {
      if (this.keysHeld.left) lateralSteer = -0.55;
      else if (this.keysHeld.right) lateralSteer = 0.55;
    }

    this.ballVel.x = lateralSteer * 3.8;
    this.activeSteerDir = 0;

    this.ballSquash.y = 1.35;
    this.ballSquash.x = 0.8;
    this.ballSquash.z = 0.8;

    soundEngine.playJumpLaunch(powerRatio);
  }

  private updateCameraProjection(width: number, height: number) {
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Standard perspective FOV for all game modes:
    // Ensures player ball has the exact same visual size, framing, and crispness
    this.camera.fov = aspect < 1.0 ? 70 : 56;
    this.camera.updateProjectionMatrix();
  }

  private onWindowResize = () => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.updateCameraProjection(width, height);
    this.renderer.setSize(width, height);
  };

  // --- GAME LIFECYCLE ---

  public startGame() {
    soundEngine.init();
    soundEngine.playGameStart();

    this.isGameOverHandled = false;
    this.currentLane = 0;
    this.resetStats();
    this.generateLevelPlatforms();

    const startPlatform = this.platforms[0];
    this.platformRelPos = { x: 0, z: 0 };
    this.targetPlatformRelX = 0;
    this.ballPos.set(startPlatform.data.x, 0.68, startPlatform.data.z);
    this.ballVel.set(0, 0, 0);
    this.isGrounded = true;
    this.currentPlatformIndex = 0;
    this.ignorePlatformIndex = -1;
    this.groundTimer = 0;
    this.ballMesh.position.copy(this.ballPos);

    // Centered straight-ahead camera behind start pad
    const isMobile = this.camera.aspect < 1.0;
    this.camera.position.set(startPlatform.data.x, 4.35, startPlatform.data.z - 5.2);
    this.camera.lookAt(startPlatform.data.x, 1.45, startPlatform.data.z + 3.2);

    this.phase = 'playing';
    soundEngine.stopBackgroundMusic();
    this.setupDailyRaceRacers();
    this.callbacks.onPhaseChange('playing');
  }

  public restartCurrentLevel() {
    soundEngine.init();
    soundEngine.playGameStart();

    this.isGameOverHandled = false;
    this.currentLane = 0;
    this.resetStats();
    this.generateLevelPlatforms();

    const startPlatform = this.platforms[0];
    this.platformRelPos = { x: 0, z: 0 };
    this.targetPlatformRelX = 0;
    this.ballPos.set(startPlatform.data.x, 0.68, startPlatform.data.z);
    this.ballVel.set(0, 0, 0);
    this.isGrounded = true;
    this.currentPlatformIndex = 0;
    this.ignorePlatformIndex = -1;
    this.groundTimer = 0;
    this.ballMesh.position.copy(this.ballPos);

    // Centered straight-ahead camera behind start pad
    const isMobile = this.camera.aspect < 1.0;
    this.camera.position.set(startPlatform.data.x, 4.35, startPlatform.data.z - 5.2);
    this.camera.lookAt(startPlatform.data.x, 1.45, startPlatform.data.z + 3.2);

    this.phase = 'playing';
    soundEngine.stopBackgroundMusic();
    this.setupDailyRaceRacers();
    this.callbacks.onPhaseChange('playing');
  }

  public togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.callbacks.onPhaseChange('paused');
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.callbacks.onPhaseChange('playing');
    }
  }

  public resetGame() {
    this.isGameOverHandled = false;
    this.currentLane = 0;
    this.resetStats();
    this.generateLevelPlatforms();

    const startPlatform = this.platforms[0];
    if (startPlatform) {
      this.platformRelPos = { x: 0, z: 0 };
      this.ballPos.set(startPlatform.data.x, 0.55, startPlatform.data.z);
      this.ballVel.set(0, 0, 0);
      this.isGrounded = true;
      this.currentPlatformIndex = 0;
      this.ignorePlatformIndex = -1;
      this.groundTimer = 0;
      this.ballMesh.position.copy(this.ballPos);
    }

    this.setupDailyRaceRacers();
    this.phase = 'title';
    // Fixed, stable camera looking straight forward at pads on Title screen
    this.camera.position.set(0, 4.8, -6.8);
    this.camera.lookAt(0, 1.6, 6.0);
    soundEngine.startHomeAmbientMusic();
    this.callbacks.onPhaseChange('title');
  }

  // Revive player at current platform after watching rewarded ad
  public reviveAtCurrentPlatform() {
    this.isGameOverHandled = false;
    const platIdx = Math.max(0, Math.min(this.currentPlatformIndex, this.platforms.length - 1));
    const plat = this.platforms[platIdx];
    if (plat) {
      this.platformRelPos = { x: 0, z: 0 };
      this.targetPlatformRelX = 0;
      this.ballPos.set(plat.mesh.position.x, plat.mesh.position.y + 0.68, plat.mesh.position.z);
      this.ballVel.set(0, 0, 0);
      this.isGrounded = true;
      this.currentPlatformIndex = platIdx;
      this.ignorePlatformIndex = -1;
      this.groundTimer = 0;
      this.ballSquash = { x: 1, y: 1, z: 1 };
      this.ballMesh.scale.set(1, 1, 1);
      this.ballMesh.position.copy(this.ballPos);

      const isMobile = this.camera.aspect < 1.0;
      this.camera.position.set(
        plat.mesh.position.x,
        Math.max(isMobile ? 3.9 : 3.8, this.ballPos.y + (isMobile ? 4.1 : 4.2)),
        plat.mesh.position.z - (isMobile ? 5.1 : 5.4)
      );
      this.camera.lookAt(plat.mesh.position.x, Math.max(0.9, this.ballPos.y + 0.9), this.ballPos.z + 3.5);
    }
    this.keysHeld = { left: false, right: false, up: false, down: false };
    this.isPointerDown = false;
    this.activeSteerDir = 0;
    this.phase = 'playing';
    this.stats.playerFell = false;
    soundEngine.playGameStart();
    this.callbacks.onPhaseChange('playing');
    this.callbacks.onStatsUpdate(this.stats);
  }

  private resetStats() {
    this.stats = {
      score: 0,
      totalCumulativeScore: this.stats.totalCumulativeScore,
      coinsEarnedInLevel: 0,
      totalCoins: this.stats.totalCoins,
      totalGems: this.stats.totalGems,
      gemsCollectedInLevel: 0,
      totalGemsInLevel: this.currentLevelConfig.totalGems,
      combo: 0,
      maxCombo: 0,
      targetPadsCleared: 0,
      totalTargetPads: this.currentLevelConfig.targetPadsCount,
      currentLevel: this.currentLevelConfig.id,
      isDailyChallenge: this.currentLevelConfig.id === 9999,
      racePosition: this.currentLevelConfig.id === 9999 ? 1 : undefined,
    };
    this.callbacks.onStatsUpdate(this.stats);
  }

  // --- 60 FPS SIMULATION LOOP ---

  private startLoop() {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.render();
    };
    this.animFrameId = requestAnimationFrame(animate);
  }

  private update(dt: number) {
    const time = this.clock.getElapsedTime();

    // Animate living 3D environment entities (birds, ocean waves, drifting clouds, boats)
    EnvironmentBuilder.update(dt, time);

    if (this.starParticles) {
      this.starParticles.rotation.y += dt * 0.015;
    }

    // Moving platforms
    this.platforms.forEach((p) => {
      p.previousX = p.mesh.position.x;
      if (p.data.isMoving) {
        const newX = p.data.baseX + Math.sin(time * p.data.moveSpeed + p.data.movePhase) * p.data.moveAmplitude;
        p.mesh.position.x = newX;
        p.data.x = newX;
      }

      if (p.gemGroup && p.gemGroup.visible) {
        p.gemGroup.rotation.y += dt * 2.5;
      }

      if (p.planetBeacon) {
        p.planetBeacon.rotation.y += dt * 1.2;
      }

      if (p.currentY !== p.targetY || p.velocity !== 0) {
        const springK = 220;
        const dampingC = 16;
        const disp = p.currentY - p.targetY;
        const force = -springK * disp - dampingC * p.velocity;
        p.velocity += force * dt;
        p.currentY += p.velocity * dt;
        p.mesh.position.y = p.data.y + p.currentY;
      }
    });

    if (this.phase === 'title') {
      this.ballPos.set(0, 0.65 + Math.sin(time * 2.5) * 0.12, 0);
      this.ballMesh.position.copy(this.ballPos);
      this.ballSphere.rotation.y += dt * 0.6;
      // Fixed, stable camera looking straight forward at pads (elevated and pulled back on mobile portrait)
      const isMobile = this.camera.aspect < 1.0;
      this.camera.position.set(0, isMobile ? 5.2 : 4.8, isMobile ? -8.2 : -6.8);
      this.camera.lookAt(0, isMobile ? 1.4 : 1.6, 6.0);
      return;
    }

    if (this.phase === 'paused') return;
    if (this.phase === 'gameover' || this.phase === 'victory') return;

    // Daily Challenge countdown handling
    if (this.isDailyChallengeMode && this.raceCountdownTimer > 0) {
      this.raceCountdownTimer -= dt;

      let newNum: number | null = null;
      if (this.raceCountdownTimer > 2.6) newNum = 3;
      else if (this.raceCountdownTimer > 1.6) newNum = 2;
      else if (this.raceCountdownTimer > 0.6) newNum = 1;
      else if (this.raceCountdownTimer > 0) newNum = 0; // 0 represents "GO!"

      const countdownChanged = newNum !== this.currentCountdownNum;
      if (countdownChanged) {
        this.currentCountdownNum = newNum;
        if (newNum !== null) {
          soundEngine.playCountdownBeep(newNum === 0);
        }
      }

      // Synchronized gentle bob on start pad during countdown
      const idleBob = Math.sin(time * 6) * 0.08;
      const startP = this.platforms[0];
      if (startP) {
        this.ballPos.set(startP.mesh.position.x, startP.mesh.position.y + 0.68 + idleBob, startP.mesh.position.z);
        this.ballMesh.position.copy(this.ballPos);

        if (this.botRacers[0]) {
          this.botRacers[0].group.position.set(startP.mesh.position.x - 3.2, startP.mesh.position.y + 0.68 + idleBob, startP.mesh.position.z);
        }
        if (this.botRacers[1]) {
          this.botRacers[1].group.position.set(startP.mesh.position.x + 3.2, startP.mesh.position.y + 0.68 + idleBob, startP.mesh.position.z);
        }
      }

      this.updateRaceLeaderboard(countdownChanged);
      return;
    }

    if (this.isDailyChallengeMode && this.currentCountdownNum !== null && this.raceCountdownTimer <= 0) {
      this.currentCountdownNum = null;
      this.updateRaceLeaderboard(true);
    }

    if (this.isGrounded) {
      this.groundTimer += dt;
      const currentPlat = this.getCurrentPlatform();
      if (currentPlat) {
        if (currentPlat.data.isGoal) {
          // Finished level, stay at celestial beacon
          this.ballPos.x = currentPlat.mesh.position.x;
          this.ballPos.y = currentPlat.mesh.position.y + 0.68;
          this.ballPos.z = currentPlat.mesh.position.z;
        } else {
          // Responsive keyboard/input rolling on surface with smooth damping
          const keyboardSpeed = 6.5 * dt;
          const maxHalfW = currentPlat.data.width / 2 - this.ballBaseRadius * 0.2;
          const maxHalfL = currentPlat.data.length / 2 - this.ballBaseRadius * 0.2;

          if (this.keysHeld.left) {
            this.targetPlatformRelX = Math.max(-maxHalfW, this.targetPlatformRelX - keyboardSpeed * 1.5);
          }
          if (this.keysHeld.right) {
            this.targetPlatformRelX = Math.min(maxHalfW, this.targetPlatformRelX + keyboardSpeed * 1.5);
          }
          if (this.keysHeld.up) {
            this.platformRelPos.z += keyboardSpeed;
            this.ballSphere.rotation.x += keyboardSpeed * 5.0;
          }
          if (this.keysHeld.down) {
            this.platformRelPos.z -= keyboardSpeed;
            this.ballSphere.rotation.x -= keyboardSpeed * 5.0;
          }

          this.targetPlatformRelX = Math.max(-maxHalfW, Math.min(maxHalfW, this.targetPlatformRelX));

          // Smooth damping for buttery rolling & sliding
          const prevRelX = this.platformRelPos.x;
          this.platformRelPos.x = THREE.MathUtils.damp(this.platformRelPos.x, this.targetPlatformRelX, 18, dt);
          const deltaMoveX = this.platformRelPos.x - prevRelX;

          this.platformRelPos.z = Math.max(-maxHalfL, Math.min(maxHalfL, this.platformRelPos.z));

          // Physical rolling rotation proportional to slide delta
          this.ballSphere.rotation.z -= deltaMoveX * 8.0;

          // Lock ball directly to moving platform position + relative offset so ball rides perfectly with the pad!
          this.ballPos.x = currentPlat.mesh.position.x + this.platformRelPos.x;
          this.ballPos.y = currentPlat.mesh.position.y + 0.68;
          this.ballPos.z = currentPlat.mesh.position.z + this.platformRelPos.z;

          // Roll ball sphere visual with moving platform
          const platformDeltaX = currentPlat.mesh.position.x - currentPlat.previousX;
          if (platformDeltaX !== 0) {
            this.ballSphere.rotation.z -= platformDeltaX * 1.8;
          }

          // Stable platform resting: Ball only jumps when user taps HOP!
        }
      }

      this.ballSquash.x = THREE.MathUtils.damp(this.ballSquash.x, 1.0, 10, dt);
      this.ballSquash.y = THREE.MathUtils.damp(this.ballSquash.y, 1.0, 10, dt);
      this.ballSquash.z = THREE.MathUtils.damp(this.ballSquash.z, 1.0, 10, dt);
    } else {
      // IN MID-AIR: Responsive steering
      if (this.keysHeld.left) {
        this.ballPos.x -= 10.5 * dt;
        this.ballSphere.rotation.z += 10.5 * dt * 4;
      }
      if (this.keysHeld.right) {
        this.ballPos.x += 10.5 * dt;
        this.ballSphere.rotation.z -= 10.5 * dt * 4;
      }
      if (this.keysHeld.up) this.ballVel.z += 8.0 * dt;
      if (this.keysHeld.down) this.ballVel.z = Math.max(4.0, this.ballVel.z - 10.0 * dt);

      this.ballVel.y -= this.gravity * dt;

      this.ballPos.x += this.ballVel.x * dt;
      this.ballPos.y += this.ballVel.y * dt;
      this.ballPos.z += this.ballVel.z * dt;

      // Natural air drag on lateral momentum
      this.ballVel.x = THREE.MathUtils.damp(this.ballVel.x, 0, 2.5, dt);

      this.ballSphere.rotation.x += this.ballVel.z * dt * 2.2;
      this.ballSphere.rotation.z -= this.ballVel.x * dt * 2.2;

      this.ballSquash.y = THREE.MathUtils.lerp(this.ballSquash.y, 1.15, 0.1);
      this.ballSquash.x = THREE.MathUtils.lerp(this.ballSquash.x, 0.9, 0.1);
      this.ballSquash.z = THREE.MathUtils.lerp(this.ballSquash.z, 0.9, 0.1);

      this.checkPlatformCollisions();

      const curPlatY = this.platforms[this.currentPlatformIndex]?.mesh.position.y ?? 0;
      if (this.ballPos.y < curPlatY - 4.5) {
        this.handleFallToAbyss();
        return;
      }
    }

    this.ballMesh.scale.set(this.ballSquash.x, this.ballSquash.y, this.ballSquash.z);
    this.ballMesh.position.copy(this.ballPos);

    // Update AI Opponent Racers in Daily Challenge
    if (this.isDailyChallengeMode) {
      for (const bot of this.botRacers) {
        if (bot.isFinished) {
          const goalP = this.platforms[this.platforms.length - 1];
          if (goalP) {
            bot.group.position.set(
              goalP.mesh.position.x + bot.lateralOffset,
              goalP.mesh.position.y + 0.68 + Math.sin(time * 4) * 0.1,
              goalP.mesh.position.z
            );
          }
          bot.sphereMesh.rotation.y += dt * 3;
          continue;
        }

        if (bot.isGrounded) {
          const curP = this.platforms[bot.currentPadIndex];
          if (curP) {
            bot.group.position.x = curP.mesh.position.x + bot.lateralOffset;
            bot.group.position.y = curP.mesh.position.y + 0.68;
            bot.group.position.z = curP.mesh.position.z;
          }

          bot.groundTime += dt;
          bot.squash.x = THREE.MathUtils.damp(bot.squash.x, 1.0, 10, dt);
          bot.squash.y = THREE.MathUtils.damp(bot.squash.y, 1.0, 10, dt);
          bot.squash.z = THREE.MathUtils.damp(bot.squash.z, 1.0, 10, dt);
          bot.group.scale.set(bot.squash.x, bot.squash.y, bot.squash.z);

          if (bot.groundTime >= bot.hopDelay) {
            const nextIdx = bot.currentPadIndex + 1;
            if (nextIdx < this.platforms.length) {
              bot.isGrounded = false;
              bot.jumpProgress = 0;
              bot.jumpDuration = bot.baseJumpDuration + (Math.random() * 0.04 - 0.02);
              bot.jumpStartPos.copy(bot.group.position);
              bot.squash.y = 1.35;
              bot.squash.x = 0.82;
              bot.squash.z = 0.82;
            }
          }
        } else {
          bot.jumpProgress += dt / bot.jumpDuration;
          const t = Math.min(1.0, bot.jumpProgress);
          const nextP = this.platforms[bot.currentPadIndex + 1];
          if (nextP) {
            const targetX = nextP.mesh.position.x + bot.lateralOffset;
            const targetY = nextP.mesh.position.y + 0.68;
            const targetZ = nextP.mesh.position.z;

            bot.group.position.x = THREE.MathUtils.lerp(bot.jumpStartPos.x, targetX, t);
            bot.group.position.z = THREE.MathUtils.lerp(bot.jumpStartPos.z, targetZ, t);
            const arcHeight = 2.4;
            bot.group.position.y =
              THREE.MathUtils.lerp(bot.jumpStartPos.y, targetY, t) + Math.sin(t * Math.PI) * arcHeight;

            bot.sphereMesh.rotation.x += dt * 11;
          }

          if (t >= 1.0) {
            bot.isGrounded = true;
            bot.currentPadIndex += 1;
            bot.groundTime = 0;
            bot.hopDelay = bot.baseHopDelay + (Math.random() * 0.04 - 0.02);

            bot.squash.y = 0.65;
            bot.squash.x = 1.3;
            bot.squash.z = 1.3;

            const landedP = this.platforms[bot.currentPadIndex];
            if (landedP) {
              this.triggerShockwave(
                landedP.mesh.position.x + bot.lateralOffset,
                landedP.mesh.position.y,
                landedP.mesh.position.z,
                bot.colorHex
              );

              if (landedP.data.isGoal) {
                bot.isFinished = true;
                this.raceFinishCount++;
                bot.finishRank = this.raceFinishCount;
              }
            }
          }
        }
      }

      this.updateRaceLeaderboard(false);
    }

    this.checkGemPickups();

    // Update active shockwaves inside unified 60fps loop
    const now = performance.now();
    for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
      const sw = this.activeShockwaves[i];
      const elapsed = now - sw.startTime;
      const progress = Math.min(elapsed / sw.duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const s = 0.3 + easeOut * 2.5;
      sw.mesh.scale.set(s, s, s);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - easeOut) * 0.95;
      if (progress >= 1) {
        sw.mesh.visible = false;
        this.activeShockwaves.splice(i, 1);
      }
    }

    // Camera follow - Smoothly track ball & pad directly so they NEVER drift or skew into corners!
    const currentPlat = this.platforms[this.currentPlatformIndex];
    let camTargetX = this.ballPos.x;
    let lookTargetX = this.ballPos.x;

    if (this.isGrounded && currentPlat && currentPlat.data.isMoving) {
      // Anchoring camera to the base track center of the moving platform allows the player to clearly see and feel the platform gliding left and right beneath the ball!
      camTargetX = currentPlat.data.baseX + this.platformRelPos.x * 0.35;
      lookTargetX = currentPlat.data.baseX;
    }

    const isMobile = this.camera.aspect < 1.0;
    // Standard camera tracking: guarantees ball has identical visual size, distance, and perspective as normal game
    const camTargetY = Math.max(isMobile ? 3.9 : 3.8, this.ballPos.y + (isMobile ? 4.1 : 4.2));
    const camTargetZ = this.ballPos.z - (isMobile ? 5.1 : 5.4);

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camTargetX, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camTargetY, 16, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camTargetZ, 20, dt);

    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
    }

    // Camera looks directly straight forward down the track along the ball's X axis
    this.camera.lookAt(lookTargetX, Math.max(0.9, this.ballPos.y + 0.9), this.ballPos.z + 3.5);
  }

  private checkPlatformCollisions() {
    if (this.ballVel.y > 0) return;

    const candidatePads: Array<{ p: PlatformMeshItem; index: number; lane: number }> = [];

    if (this.isDailyChallengeMode) {
      for (let i = 0; i < this.platforms.length; i++) {
        if (i === this.ignorePlatformIndex) continue;
        const centerP = this.platforms[i];
        if (!centerP) continue;
        if (centerP.mesh.position.z < this.ballPos.z - 2.5 || centerP.mesh.position.z > this.ballPos.z + 6.0) continue;

        candidatePads.push({ p: centerP, index: i, lane: 0 });
        if (this.leftPlatforms[i]) {
          candidatePads.push({ p: this.leftPlatforms[i], index: i, lane: -1 });
        }
        if (this.rightPlatforms[i]) {
          candidatePads.push({ p: this.rightPlatforms[i], index: i, lane: 1 });
        }
      }
    } else {
      for (let i = 0; i < this.platforms.length; i++) {
        if (i === this.ignorePlatformIndex) continue;
        const p = this.platforms[i];
        if (p.mesh.position.z < this.ballPos.z - 2.5 || p.mesh.position.z > this.ballPos.z + 6.0) continue;
        candidatePads.push({ p, index: i, lane: 0 });
      }
    }

    for (const cand of candidatePads) {
      const p = cand.p;
      const pTopY = p.mesh.position.y + 0.02;
      const ballBottomY = this.ballPos.y - this.ballBaseRadius;

      if (ballBottomY <= pTopY + 0.45 && ballBottomY >= pTopY - 0.75) {
        const halfW = p.data.width / 2 + 0.35;
        const halfL = p.data.length / 2 + 0.35;

        const inX = Math.abs(this.ballPos.x - p.mesh.position.x) <= halfW;
        const inZ = Math.abs(this.ballPos.z - p.mesh.position.z) <= halfL;

        if (inX && inZ) {
          this.handleLandingOnPlatform(p, cand.index, cand.lane);
          break;
        }
      }
    }
  }

  private handleLandingOnPlatform(platform: PlatformMeshItem, index: number, lane: number = 0) {
    this.isGrounded = true;
    this.currentPlatformIndex = index;
    this.currentLane = lane;
    this.ignorePlatformIndex = -1;
    this.groundTimer = 0;
    this.ballVel.set(0, 0, 0);
    this.activeSteerDir = 0;

    // Anchor precisely to pad surface without any auto-drift or unexpected lateral sliding
    const maxHalfW = platform.data.width / 2 - this.ballBaseRadius * 0.25;
    const maxHalfL = platform.data.length / 2 - this.ballBaseRadius * 0.25;
    const clampedRelX = Math.max(-maxHalfW, Math.min(maxHalfW, this.ballPos.x - platform.mesh.position.x));
    const clampedRelZ = Math.max(-maxHalfL, Math.min(maxHalfL, this.ballPos.z - platform.mesh.position.z));

    this.platformRelPos.x = clampedRelX;
    this.platformRelPos.z = clampedRelZ;
    this.targetPlatformRelX = clampedRelX;
    this.ballPos.x = platform.mesh.position.x + clampedRelX;
    this.ballPos.y = platform.mesh.position.y + 0.68;
    this.ballPos.z = platform.mesh.position.z + clampedRelZ;

    platform.currentY = -0.3;
    platform.velocity = -2.2;

    this.ballSquash.y = 0.65;
    this.ballSquash.x = 1.3;
    this.ballSquash.z = 1.3;

    const distFromCenter = Math.abs(this.ballPos.x - platform.mesh.position.x);
    const isPerfect = distFromCenter < 0.45;

    this.triggerShockwave(platform.mesh.position.x, platform.mesh.position.y, platform.mesh.position.z, platform.data.colorHex);
    soundEngine.playLand(isPerfect);

    // Contested landing check with bots in Daily Challenge
    if (this.isDailyChallengeMode) {
      for (const bot of this.botRacers) {
        if (bot.currentPadIndex === index && Math.abs(bot.group.position.x - platform.mesh.position.x) < 1.2) {
          this.triggerShockwave(platform.mesh.position.x, platform.mesh.position.y + 0.1, platform.mesh.position.z, '#ff007f');
          soundEngine.playGemCollect();
          this.stats.hitFeedback = {
            type: 'PAD CONTESTED! ⚡ (+10 PTS)',
            bonus: 10,
            timestamp: performance.now(),
          };
          this.stats.score += 10;
          this.stats.totalCumulativeScore += 10;
          break;
        }
      }
    }

    if (!platform.data.isStartPad) {
      if (!platform.data.visited) {
        platform.data.visited = true;

        const padScore = 5;
        this.stats.score += padScore;
        this.stats.totalCumulativeScore += padScore;
        this.stats.targetPadsCleared += 1;
        // Strictly 2 coins per pad cleared, never extra coins!
        this.stats.coinsEarnedInLevel = this.stats.targetPadsCleared * 2;
        this.stats.totalCoins += 2;

        this.stats.combo += 1;
        if (this.stats.combo > this.stats.maxCombo) {
          this.stats.maxCombo = this.stats.combo;
        }

        if (!this.stats.hitFeedback || this.stats.hitFeedback.type.indexOf('CONTESTED') === -1) {
          this.stats.hitFeedback = {
            type: isPerfect ? 'PERFECT! (+2 🪙)' : '+2 COINS',
            bonus: padScore,
            timestamp: performance.now(),
          };
        }
      }
    }

    if (this.isDailyChallengeMode) {
      this.stats.isDailyChallenge = true;
      if (platform.data.isGoal && !this.playerFinished) {
        this.playerFinished = true;
        this.raceFinishCount++;
        this.playerFinishRank = this.raceFinishCount;
        this.stats.racePosition = this.playerFinishRank;
      }
      this.updateRaceLeaderboard();
    } else {
      this.callbacks.onStatsUpdate(this.stats);
    }

    if (platform.data.isGoal) {
      this.handleVictory();
    }
  }

  private checkGemPickups() {
    this.platforms.forEach((p) => {
      if (p.gemGroup && p.gemGroup.visible && !p.data.gemCollected) {
        const dx = Math.abs(this.ballPos.x - p.mesh.position.x);
        const dz = Math.abs(this.ballPos.z - p.mesh.position.z);
        const dy = Math.abs(this.ballPos.y - (p.mesh.position.y + 1.1));

        if (dx < 0.9 && dz < 0.9 && dy < 1.0) {
          p.data.gemCollected = true;
          p.gemGroup.visible = false;
          this.stats.gemsCollectedInLevel = Math.min(
            this.stats.totalGemsInLevel,
            this.stats.gemsCollectedInLevel + 1
          );
          this.stats.totalGems += 1;
          this.stats.score += 5;
          this.stats.totalCumulativeScore += 5;
          soundEngine.playGemCollect();
          this.triggerShockwave(p.mesh.position.x, p.mesh.position.y + 1.0, p.mesh.position.z, '#00f5ff');
          this.callbacks.onStatsUpdate(this.stats);
        }
      }
    });
  }

  private handleFallToAbyss() {
    if (this.isGameOverHandled) return;
    this.isGameOverHandled = true;
    this.phase = 'gameover';

    soundEngine.stopBackgroundMusic();
    soundEngine.playMiss();

    if (this.isDailyChallengeMode) {
      this.playerFinished = false;
      this.stats.playerFell = true;
      this.stats.raceOutcome = 'PLAYER_FELL';
      // Fallen player is ranked 3rd (behind both bots who continue/finish)
      this.stats.racePosition = 3;
      this.updateRaceLeaderboard();
    }

    this.callbacks.onGameOver(this.stats);
    this.callbacks.onPhaseChange('gameover');
  }

  private handleVictory() {
    if (this.isGameOverHandled) return;
    this.isGameOverHandled = true;
    this.phase = 'victory';
    this.stats.score += 10;
    this.stats.totalCumulativeScore += 10;

    if (this.isDailyChallengeMode) {
      this.stats.playerFell = false;
      this.stats.raceOutcome = 'PLAYER_FINISHED';
      if (!this.playerFinished) {
        this.playerFinished = true;
        this.raceFinishCount++;
        this.playerFinishRank = this.raceFinishCount;
      }
      this.stats.racePosition = this.playerFinishRank || 1;
      this.updateRaceLeaderboard();
    }

    soundEngine.stopBackgroundMusic();
    soundEngine.playLevelComplete();
    this.callbacks.onVictory(this.stats);
    this.callbacks.onPhaseChange('victory');
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    const el = this.renderer.domElement;
    if (el && this.onPointerDownHandler) {
      el.removeEventListener('pointerdown', this.onPointerDownHandler);
    }
    if (this.onPointerMoveHandler) window.removeEventListener('pointermove', this.onPointerMoveHandler);
    if (this.onPointerUpHandler) {
      window.removeEventListener('pointerup', this.onPointerUpHandler);
      window.removeEventListener('pointercancel', this.onPointerUpHandler);
    }
    if (this.onKeyDownHandler) window.removeEventListener('keydown', this.onKeyDownHandler);
    if (this.onKeyUpHandler) window.removeEventListener('keyup', this.onKeyUpHandler);
    if (this.onBlurHandler) window.removeEventListener('blur', this.onBlurHandler);
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}

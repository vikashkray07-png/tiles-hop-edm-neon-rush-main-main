import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

// Enable CORS for all requests (important for iframe preview and cross-device access)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const DATA_DIR = path.resolve(__dirname, 'data');
const LEADERBOARD_FILE = path.resolve(DATA_DIR, 'leaderboard.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Error creating data directory:', err);
}

interface PlayerRecord {
  id: string;
  name: string;
  country: string;
  flag: string;
  gems: number; // Gems collected (Primary ranking criteria)
  score: number;
  level: number;
  updatedAt: number;
}

const SERVER_LEADERBOARD_VERSION = 'v22.0_clean_wipe_levels_harder_review_modal';

// REAL GAMERS ONLY - Clean slate, zero stale test names or fake bots!
const INITIAL_REAL_GAMERS: PlayerRecord[] = [];

interface StoredData {
  version: string;
  records: PlayerRecord[];
}

function getLeaderboard(): PlayerRecord[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const content = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
      if (content.trim()) {
        const parsed = JSON.parse(content);
        if (parsed && parsed.version === SERVER_LEADERBOARD_VERSION && Array.isArray(parsed.records)) {
          return parsed.records;
        }
      }
    }
  } catch (err) {
    console.error('Error reading leaderboard file:', err);
  }
  return [];
}

function saveLeaderboard(records: PlayerRecord[]) {
  try {
    const payload: StoredData = {
      version: SERVER_LEADERBOARD_VERSION,
      records,
    };
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing leaderboard file:', err);
  }
}

// GET /api/leaderboard - Real Gamers Ranked strictly by Gems (More Gems = Top Rank #1)
app.get('/api/leaderboard', (req, res) => {
  const records = getLeaderboard();

  // PRIMARY SORT: Total Gems Collected descending!
  records.sort((a, b) => (b.gems || 0) - (a.gems || 0) || (b.level || 0) - (a.level || 0) || (b.score || 0) - (a.score || 0));

  const ranked = records.map((item, idx) => ({
    id: item.id,
    rank: idx + 1,
    name: item.name,
    country: item.country,
    flag: item.flag,
    gems: item.gems ?? item.score ?? 0,
    score: item.score ?? 0,
    level: item.level,
    updatedAt: item.updatedAt,
  }));

  res.json({ success: true, leaderboard: ranked, count: ranked.length });
});

// Protected: Unrestricted leaderboard reset removed for production data security
app.post('/api/leaderboard/reset', (req, res) => {
  res.status(403).json({ success: false, message: 'Leaderboard reset is disabled in production.' });
});

// POST /api/leaderboard - Sync real player gems across all devices
app.post('/api/leaderboard', (req, res) => {
  const { id, name, country, flag, gems, score, level } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Player name is required' });
  }

  const cleanName = name.trim();
  const safeGems = typeof gems === 'number' && !isNaN(gems) ? Math.max(0, gems) : typeof score === 'number' && !isNaN(score) ? Math.max(0, score) : 0;
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, score) : safeGems;
  const safeLevel = typeof level === 'number' && !isNaN(level) ? Math.max(1, level) : 1;
  const safeCountry = country || 'India';
  const safeFlag = flag || '🇮🇳';

  const records = getLeaderboard();

  const existingIdx = records.findIndex(
    (p) =>
      (id && p.id === id) ||
      p.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  const now = Date.now();
  const effectiveId = id || `player_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  if (existingIdx >= 0) {
    records[existingIdx].name = cleanName;
    records[existingIdx].country = safeCountry;
    records[existingIdx].flag = safeFlag;
    if (safeGems > records[existingIdx].gems) {
      records[existingIdx].gems = safeGems;
    }
    if (safeScore > records[existingIdx].score) {
      records[existingIdx].score = safeScore;
    }
    if (safeLevel > records[existingIdx].level) {
      records[existingIdx].level = safeLevel;
    }
    records[existingIdx].updatedAt = now;
  } else {
    records.push({
      id: effectiveId,
      name: cleanName,
      country: safeCountry,
      flag: safeFlag,
      gems: safeGems,
      score: safeScore,
      level: safeLevel,
      updatedAt: now,
    });
  }

  // PRIMARY SORT: Total Gems Collected descending!
  records.sort((a, b) => (b.gems || 0) - (a.gems || 0) || (b.level || 0) - (a.level || 0) || (b.score || 0) - (a.score || 0));

  saveLeaderboard(records);

  const ranked = records.map((item, idx) => ({
    id: item.id,
    rank: idx + 1,
    name: item.name,
    country: item.country,
    flag: item.flag,
    gems: item.gems ?? item.score ?? 0,
    score: item.score ?? 0,
    level: item.level,
    updatedAt: item.updatedAt,
  }));

  res.json({ success: true, leaderboard: ranked, count: ranked.length });
});

// Health check endpoint for Cloud Run and container orchestration
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: Date.now() });
});

async function startServer() {
  const distDir = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE) || Boolean(process.env.CLOUD_RUN_JOB);

  if (isProduction && fs.existsSync(distDir)) {
    console.log(`Starting in PRODUCTION mode. Serving static assets from ${distDir}`);
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    console.log('Starting in DEVELOPMENT mode with Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();

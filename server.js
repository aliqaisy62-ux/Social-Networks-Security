/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   Social Networks Security Interactive Lab — Backend Server     ║
 * ║   Author : Dr. Ali Salim (Backend integration)                  ║
 * ║   Stack  : Node.js · Express · CORS · Body-Parser               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');
const fs         = require('fs');

// ── Bootstrap ──────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// Load data store once at startup
const DATA_PATH = path.join(__dirname, 'data.json');
let DB = {};
try {
  DB = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`[DB] Loaded ${DB.questions.length} questions | ${DB.trustedSeedSites.length} seed sites`);
} catch (err) {
  console.error('[DB] Failed to load data.json:', err.message);
  process.exit(1);
}

// ── Middleware ─────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Serve the frontend from the same directory
app.use(express.static(path.join(__dirname)));

// ── Request Logger ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ══════════════════════════════════════════════════════════════════
// UTILITY — Levenshtein Distance (pure function, reused by 2 routes)
// ══════════════════════════════════════════════════════════════════
function levenshtein(s, t) {
  const m = s.length, n = t.length;

  // Build DP table
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  const ops = [];

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const eq  = s[i - 1] === t[j - 1];
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 1;
      const sub = dp[i - 1][j - 1] + (eq ? 0 : 1);
      dp[i][j]  = Math.min(del, ins, sub);

      ops.push({
        i, j,
        s: s[i - 1], t: t[j - 1],
        eq, del, ins, sub,
        val: dp[i][j],
        op : dp[i][j] === sub
              ? (eq ? 'match' : 'substitution')
              : dp[i][j] === del ? 'deletion' : 'insertion',
      });
    }
  }

  const dist = dp[m][n];
  const sim  = Math.max(m, n) === 0 ? 1 : 1 - dist / Math.max(m, n);

  return { dp, dist, sim, ops, m, n };
}

// Classify risk level from similarity percentage
function riskLabel(simPct) {
  if (simPct >= 85) return { level: 'CRITICAL', color: 'threat', action: 'Block immediately' };
  if (simPct >= 70) return { level: 'HIGH',     color: 'threat', action: 'Flag for review' };
  if (simPct >= 50) return { level: 'MEDIUM',   color: 'warn',   action: 'Monitor' };
  return               { level: 'LOW',      color: 'trust',  action: 'Likely safe' };
}


// ══════════════════════════════════════════════════════════════════
// ROUTE  POST /api/levenshtein
// Body : { source: string, target: string }
// ══════════════════════════════════════════════════════════════════
app.post('/api/levenshtein', (req, res) => {
  const { source = '', target = '' } = req.body;

  // Input validation
  if (typeof source !== 'string' || typeof target !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'Both "source" and "target" must be strings.',
    });
  }

  const s = source.trim().toLowerCase();
  const t = target.trim().toLowerCase();

  if (!s || !t) {
    return res.status(400).json({ ok: false, error: 'Source and target cannot be empty.' });
  }

  if (s.length > 50 || t.length > 50) {
    return res.status(400).json({ ok: false, error: 'Strings must be ≤ 50 characters.' });
  }

  const result   = levenshtein(s, t);
  const simPct   = parseFloat((result.sim * 100).toFixed(2));
  const risk     = riskLabel(simPct);

  // Build a readable steps log (diagonal entries — comparing char by char)
  const stepsLog = result.ops
    .filter(o => o.i === o.j)
    .map(o => ({
      position : o.i,
      charS    : o.s,
      charT    : o.t,
      match    : o.eq,
      operation: o.op,
      cellValue: o.val,
      delta    : o.eq ? 0 : 1,
    }));

  return res.json({
    ok         : true,
    source     : s,
    target     : t,
    distance   : result.dist,
    similarity : simPct,
    sourceLen  : result.m,
    targetLen  : result.n,
    risk,
    matrix     : result.dp,      // full DP table for frontend rendering
    stepsLog,
    message    : `Distance = ${result.dist} | Similarity = ${simPct}% | Risk: ${risk.level}`,
  });
});


// ══════════════════════════════════════════════════════════════════
// ROUTE  GET /api/quiz
// Query : ?topic=OSINT&difficulty=hard&count=10
// ══════════════════════════════════════════════════════════════════
app.get('/api/quiz', (req, res) => {
  const { topic = '', difficulty = '', count = '10' } = req.query;
  const maxCount = Math.min(parseInt(count, 10) || 10, 50);

  let pool = [...DB.questions];

  if (topic)      pool = pool.filter(q => q.topic === topic);
  if (difficulty) pool = pool.filter(q => q.difficulty === difficulty);

  if (pool.length === 0) {
    return res.status(404).json({
      ok: false,
      error: 'No questions match the given filters.',
      appliedFilters: { topic, difficulty },
    });
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, maxCount);

  // Available filter values (for frontend dropdowns)
  const allTopics      = [...new Set(DB.questions.map(q => q.topic))].sort();
  const allDifficulties = ['easy', 'medium', 'hard'];

  return res.json({
    ok        : true,
    total     : selected.length,
    questions : selected,
    meta: {
      availableTopics     : allTopics,
      availableDifficulties: allDifficulties,
      appliedFilters      : { topic: topic || null, difficulty: difficulty || null },
      requestedCount      : maxCount,
    },
  });
});


// ══════════════════════════════════════════════════════════════════
// ROUTE  POST /api/submit-quiz
// Body : { questions: [...], userAnswers: [int, ...], timeTaken?: seconds }
// ══════════════════════════════════════════════════════════════════
app.post('/api/submit-quiz', (req, res) => {
  const { questions = [], userAnswers = [], timeTaken = null } = req.body;

  if (!Array.isArray(questions) || !Array.isArray(userAnswers)) {
    return res.status(400).json({ ok: false, error: 'Invalid payload format.' });
  }

  if (questions.length === 0) {
    return res.status(400).json({ ok: false, error: 'No questions provided.' });
  }

  if (questions.length !== userAnswers.length) {
    return res.status(400).json({
      ok: false,
      error: `Question count (${questions.length}) does not match answer count (${userAnswers.length}).`,
    });
  }

  // Score the submission
  let score = 0;
  const breakdown = [];

  questions.forEach((q, idx) => {
    const userAns = userAnswers[idx];
    const correct = userAns === q.correct;
    if (correct) score++;

    breakdown.push({
      id        : q.id,
      topic     : q.topic,
      difficulty: q.difficulty,
      question  : q.q,
      userAnswer: userAns,
      correctAnswer: q.correct,
      isCorrect : correct,
      explanation: q.exp,
    });
  });

  const total   = questions.length;
  const pct     = Math.round((score / total) * 100);
  const grade   = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'D';

  // Performance by topic
  const topicStats = {};
  breakdown.forEach(r => {
    if (!topicStats[r.topic]) topicStats[r.topic] = { correct: 0, total: 0 };
    topicStats[r.topic].total++;
    if (r.isCorrect) topicStats[r.topic].correct++;
  });

  const topicSummary = Object.entries(topicStats).map(([topic, stat]) => ({
    topic,
    correct: stat.correct,
    total  : stat.total,
    pct    : Math.round((stat.correct / stat.total) * 100),
    status : stat.correct === stat.total ? 'mastered' : stat.correct === 0 ? 'needs_work' : 'in_progress',
  })).sort((a, b) => a.pct - b.pct);

  // Weak topics for recommendations
  const weakTopics = topicSummary.filter(t => t.pct < 60).map(t => t.topic);

  // Performance tier
  let tier, tierColor, message;
  if (pct >= 90) {
    tier = 'ELITE';          tierColor = 'trust';
    message = 'Outstanding. You demonstrate mastery of social network security concepts.';
  } else if (pct >= 75) {
    tier = 'PROFICIENT';     tierColor = 'trust';
    message = 'Strong performance. Minor gaps remain — review the weak topics below.';
  } else if (pct >= 60) {
    tier = 'DEVELOPING';     tierColor = 'warn';
    message = 'Solid foundation, but key concepts need reinforcement.';
  } else {
    tier = 'NEEDS_REVIEW';   tierColor = 'threat';
    message = 'Several core areas require focused study. Use the topic breakdown below.';
  }

  return res.json({
    ok      : true,
    score,
    total,
    pct,
    grade,
    tier,
    tierColor,
    message,
    timeTaken: timeTaken ? `${timeTaken}s` : null,
    topicSummary,
    weakTopics,
    breakdown,
    submittedAt: new Date().toISOString(),
  });
});


// ══════════════════════════════════════════════════════════════════
// ROUTE  GET /api/seeds
// Returns the Trusted Seed Sites list for the TrustRank module
// ══════════════════════════════════════════════════════════════════
app.get('/api/seeds', (req, res) => {
  const { category = '' } = req.query;

  let seeds = [...DB.trustedSeedSites];
  if (category) {
    seeds = seeds.filter(s =>
      s.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  const categories = [...new Set(DB.trustedSeedSites.map(s => s.category))].sort();

  return res.json({
    ok        : true,
    total     : seeds.length,
    seeds,
    categories,
  });
});


// ══════════════════════════════════════════════════════════════════
// ROUTE  GET /api/health
// Simple health-check ping
// ══════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    ok     : true,
    status : 'ONLINE',
    server : 'SNS Security Lab API',
    version: '1.0.0',
    uptime : `${Math.floor(process.uptime())}s`,
    db     : {
      questions: DB.questions.length,
      seeds    : DB.trustedSeedSites.length,
    },
    timestamp: new Date().toISOString(),
  });
});


// ══════════════════════════════════════════════════════════════════
// 404 Handler (API routes only)
// ══════════════════════════════════════════════════════════════════
app.use('/api', (req, res) => {
  res.status(404).json({
    ok   : false,
    error: `Endpoint ${req.method} ${req.path} not found.`,
    hint : 'Available: GET /api/health | GET /api/quiz | GET /api/seeds | POST /api/levenshtein | POST /api/submit-quiz',
  });
});

// Catch-all: serve index.html for any other GET
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// ── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   SNS Security Lab — Server ONLINE               ║');
  console.log(`║   http://localhost:${PORT}                          ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  GET  /api/health       — Server health check    ║');
  console.log('║  POST /api/levenshtein  — Edit distance engine   ║');
  console.log('║  GET  /api/quiz         — Fetch question bank    ║');
  console.log('║  POST /api/submit-quiz  — Score & analyse quiz   ║');
  console.log('║  GET  /api/seeds        — Trusted seed sites     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
});

module.exports = app;

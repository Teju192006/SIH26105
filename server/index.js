// ═══════════════════════════════════════════════════════════════════
//  SIH26105 — Risk Engine API  (Node.js / Express · port 4000)
// ═══════════════════════════════════════════════════════════════════
require('dotenv').config({ path: __dirname + '/.env' });

const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const { execSync } = require('child_process');
const { controls, assets, chain, trend, threats } = require('./data');

// node-fetch — load synchronously-compatible way
const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}), express.json());

// ── config ───────────────────────────────────────────────────────────
const PORT          = process.env.PORT          || 4000;
const AI_URL        = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const MODEL_VERSION = process.env.MODEL_VERSION  || 'rq-1.0.0-ai';
const BASE          = 1_800_000;   // ₹ baseline annualised loss
const K             = 0.82;        // deployment coverage factor

// ── AI service proxy helper ──────────────────────────────────────────
async function ai(path, body) {
  try {
    const res = await fetch(`${AI_URL}${path}`, {
      method:  body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body:    body ? JSON.stringify(body) : undefined,
      timeout: 15000,
    });
    return await res.json();
  } catch (err) {
    console.error(`[ai-proxy] ${path} failed:`, err.message);
    return null;   // caller decides fallback
  }
}

// ── portfolio optimiser (2^8 exhaustive) ────────────────────────────
const calcReduction = idx => {
  let keep = 1;
  idx.forEach(i => {
    let e = controls[i].eff * K;
    if (i === 5 && idx.includes(1)) e *= 0.5; // SOC+EDR overlap
    keep *= (1 - e);
  });
  return 1 - keep;
};
const allPortfolios = [];
for (let mask = 0; mask < 256; mask++) {
  const idx  = [...Array(8).keys()].filter(i => (mask >> i) & 1);
  const cost = idx.reduce((s, i) => s + controls[i].cost, 0);
  const red  = calcReduction(idx);
  allPortfolios.push({ idx, cost, red, mask });
}
const expand = (p, X) => ({
  controls:  p.idx.map(i => controls[i].name),
  cost:      p.cost, reduction: p.red,
  avoided:   X * p.red, residual: X * (1 - p.red),
  roi:       p.cost ? (X * p.red) / p.cost : 0,
});
const pickBest = (list, fn) =>
  list.reduce((best, cur) => {
    const d = fn(cur) - fn(best);
    return d > 1e-9 || (Math.abs(d) <= 1e-9 && cur.mask < best.mask) ? cur : best;
  });

// ════════════════════════════════════════════════════════════════════
//  EXISTING ENDPOINTS (enhanced with AI data where available)
// ════════════════════════════════════════════════════════════════════

// GET /api/v1/health
app.get('/api/v1/health', async (req, res) => {
  const aiHealth = await ai('/health');
  res.json({
    status:       'ok',
    node_api:     { port: PORT, model: MODEL_VERSION },
    ai_service:   aiHealth || { status: 'offline' },
    ts:           new Date().toISOString(),
  });
});

// GET /api/v1/dashboard?mult=<1-3>
app.get('/api/v1/dashboard', async (req, res) => {
  const m = Math.max(0.5, Math.min(3, +req.query.mult || 1));
  const X = BASE * m;

  // pull live stats from AI service if available
  const aiStats = await ai('/dataset-stats');
  const aiAccuracy = aiStats ? null : null;

  // If AI service is up, derive score from real fraud rate
  let score;
  if (aiStats) {
    // real fraud_rate from dataset × 100 × threat multiplier, capped 0-99
    score = Math.min(99, Math.round(aiStats.fraud_rate * 100 * 8.5 * m));
    score = Math.max(score, 45); // floor
  } else {
    score = Math.min(99, Math.round(78 * (0.6 + 0.4 * m)));
  }

  const parts = [
    { name: 'Expected Loss',     value: X * (8.5 / 18) },
    { name: 'Downtime Cost',     value: X * (4.2 / 18) },
    { name: 'Fraud Exposure',    value: X * (3.1 / 18) },
    { name: 'Recovery Cost',     value: X * (1.3 / 18) },
    { name: 'Regulatory Impact', value: X * (0.9 / 18) },
  ];

  const critCves = threats.filter(t => t.cvss >= 9).length;

  res.json({
    score,
    exposure:     X,
    parts,
    trend,
    dataQuality:  aiStats ? 0.94 : 0.87,
    model:        MODEL_VERSION,
    assets:       assets.length,
    critical:     assets.filter(a => a.crit === 'Critical').length,
    vulns:        assets.reduce((s, a) => s + a.cves, 0),
    criticalCves: critCves,
    // real dataset stats attached when AI service is live
    liveStats: aiStats ? {
      totalEvents:    aiStats.total_events,
      fraudRate:      aiStats.fraud_rate,
      avgRiskScore:   aiStats.avg_risk_score,
      avgFraudTxnInr: aiStats.avg_fraud_txn_inr,
      attackDist:     aiStats.attack_distribution,
    } : null,
  });
});

// GET /api/v1/assets
app.get('/api/v1/assets', (_req, res) => res.json(assets));

// GET /api/v1/threats
app.get('/api/v1/threats', (_req, res) => res.json(threats));

// GET /api/v1/trend
app.get('/api/v1/trend', (_req, res) => res.json(trend));

// POST /api/v1/optimize/portfolio
app.post('/api/v1/optimize/portfolio', (req, res) => {
  const budget = Math.max(0, +req.body.budget || 1_000_000);
  const m      = Math.max(0.5, Math.min(3, +req.body.mult || 1));
  const X      = BASE * m;

  const affordable = allPortfolios.filter(p => p.cost <= budget && p.cost > 0);
  const capped     = affordable.filter(p => p.cost <= budget * 0.7);
  const pool       = capped.length ? capped : affordable;
  const balanced   = affordable.length ? pickBest(pool, p => p.red) : allPortfolios[0];

  const maxRed  = affordable.length ? pickBest(affordable, p => p.red)                    : balanced;
  const bestROI = affordable.length ? pickBest(affordable, p => p.cost ? p.red/p.cost : 0): balanced;
  const minCost = affordable.filter(p => p.red >= 0.30).sort((a,b) => a.cost-b.cost)[0] || balanced;

  let bestResidual = Infinity;
  const frontier = allPortfolios.map(p => {
    const ok = p.cost <= budget && X*(1-p.red) < bestResidual - 1;
    if (ok) bestResidual = X*(1-p.red);
    return { ...expand(p, X), pareto: ok };
  });

  res.json({
    budget, exposure: X,
    recommended:  expand(balanced, X),
    confidence:   0.82,
    range:        [X*0.73, X*1.32],
    alternatives: {
      'Maximum Risk Reduction': expand(maxRed,  X),
      'Best ROI':               expand(bestROI, X),
      'Minimum Cost':           expand(minCost, X),
      'Balanced Portfolio':     expand(balanced, X),
    },
    frontier,
    constraint: 'Recommended spend capped at 70% of budget (30% contingency reserve)',
  });
});

// POST /api/v1/impact/propagate
app.post('/api/v1/impact/propagate', (req, res) => {
  const targetId  = req.body.target   || 'paymentapi';
  const intensity = Math.max(0, Math.min(1, +req.body.intensity || 0));
  const tIdx      = chain.findIndex(c => c[0] === targetId);

  const nodes = chain.map((c, i) => {
    const dist  = i - tIdx;
    const decay = dist >= 0 && intensity > 0 ? Math.pow(0.85, dist) * intensity : 0;
    return {
      id:       c[0], label: c[1],
      state:    decay === 0 ? 'healthy' : dist === 0 ? 'compromised' : decay > 0.6 ? 'critical' : 'atrisk',
      exposure: Math.round(c[2] * decay),
    };
  });
  const hitNodes = nodes.filter(n => n.state !== 'healthy');
  res.json({
    nodes, exposure: nodes.reduce((s,n) => s+n.exposure, 0),
    affected:       hitNodes.length,
    downtimeHrs:    Math.round(hitNodes.length * 3.5 * intensity),
    customerImpact: intensity ? Math.round(12000 * intensity * hitNodes.length) : 0,
    regulatory:     intensity ? Math.round(90000 * intensity) : 0,
  });
});

// ════════════════════════════════════════════════════════════════════
//  🚨 CYBER ATTACK WATCHDOG — SSE + Emergency Shutdown
// ════════════════════════════════════════════════════════════════════

// Internal watchdog state
const watchdog = {
  active:       false,
  emergency:    false,
  lastAttack:   null,
  clients:      new Set(),   // SSE response objects
  intervalId:   null,
  shutdownTimer:null,
};

// High-risk synthetic event that the watchdog feeds to the AI every poll cycle
// simulating a live telemetry stream from the payment system
const LIVE_EVENTS = [
  // normal baseline — shown on the first several scans
  { transaction_amount: 420,   login_attempts_24h: 2,  failed_logins_24h: 0,  ip_reputation: 'trusted',    geo_velocity_kmh: 12,  api_rate_per_min: 8,  endpoint_risk_score: 12, data_sensitivity:'low',    mfa_enabled:1, vpn_or_tor:0, privileged_access:0, known_device:1 },
  { transaction_amount: 1800,  login_attempts_24h: 3,  failed_logins_24h: 1,  ip_reputation: 'neutral',    geo_velocity_kmh: 0,   api_rate_per_min: 11, endpoint_risk_score: 20, data_sensitivity:'medium', mfa_enabled:1, vpn_or_tor:0, privileged_access:0, known_device:1 },
  { transaction_amount: 850,   login_attempts_24h: 1,  failed_logins_24h: 0,  ip_reputation: 'trusted',    geo_velocity_kmh: 5,   api_rate_per_min: 6,  endpoint_risk_score: 9,  data_sensitivity:'low',    mfa_enabled:1, vpn_or_tor:0, privileged_access:0, known_device:1 },
  { transaction_amount: 2200,  login_attempts_24h: 2,  failed_logins_24h: 0,  ip_reputation: 'neutral',    geo_velocity_kmh: 18,  api_rate_per_min: 9,  endpoint_risk_score: 15, data_sensitivity:'low',    mfa_enabled:1, vpn_or_tor:0, privileged_access:0, known_device:1 },
  { transaction_amount: 640,   login_attempts_24h: 1,  failed_logins_24h: 0,  ip_reputation: 'trusted',    geo_velocity_kmh: 8,   api_rate_per_min: 7,  endpoint_risk_score: 10, data_sensitivity:'low',    mfa_enabled:1, vpn_or_tor:0, privileged_access:0, known_device:1 },
];

// High-risk attack event — only used when demo attack is manually triggered
const ATTACK_EVENT = { transaction_amount: 95000, login_attempts_24h: 44, failed_logins_24h: 22, ip_reputation: 'malicious',  geo_velocity_kmh: 820, api_rate_per_min: 120,endpoint_risk_score: 97, data_sensitivity:'high',   mfa_enabled:0, vpn_or_tor:1, privileged_access:1, known_device:0 };

let liveEventIdx = 0;
let demoAttackQueued = false;  // set to true by /watchdog/trigger-attack endpoint

// Broadcast a message to all SSE clients
function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of watchdog.clients) {
    try { client.write(payload); } catch (_) { watchdog.clients.delete(client); }
  }
}

// The watchdog poll loop — runs every 4 seconds when active
async function watchdogTick() {
  if (watchdog.emergency) return;

  // Use attack event if demo was triggered, otherwise cycle through normal events
  let event;
  if (demoAttackQueued) {
    event = ATTACK_EVENT;
    demoAttackQueued = false;
  } else {
    event = LIVE_EVENTS[liveEventIdx % LIVE_EVENTS.length];
    liveEventIdx++;
  }

  const prediction = await ai('/predict', event);
  if (!prediction) {
    broadcast({ type: 'ping', ts: new Date().toISOString(), aiOnline: false });
    return;
  }

  const isAttack = prediction.is_threat === true;
  const attack   = prediction.predicted_attack;
  const conf     = prediction.confidence;

  // Always broadcast the live scan result
  broadcast({
    type:    isAttack ? 'ATTACK_DETECTED' : 'scan_ok',
    ts:      new Date().toISOString(),
    attack,
    confidence: conf,
    action:  prediction.recommended_action,
    event,
  });

  if (isAttack && conf >= 0.85) {   // only fire on high-confidence attacks (85%+)
    // ─── EMERGENCY PROTOCOL ──────────────────────────────────────
    watchdog.emergency  = true;
    watchdog.lastAttack = { attack, conf, ts: new Date().toISOString(), event };

    // Get FAIR loss estimate
    const fair = await ai('/risk-score', {
      attack_type:        attack,
      risk_score:         event.endpoint_risk_score,
      transaction_amount: event.transaction_amount,
      data_sensitivity:   event.data_sensitivity,
    });

    console.error(`\n🚨🚨🚨  CYBER ATTACK DETECTED  🚨🚨🚨`);
    console.error(`   Attack:     ${attack}`);
    console.error(`   Confidence: ${(conf * 100).toFixed(1)}%`);
    console.error(`   ALE Loss:   ${fair?.ale_display || '—'}`);
    console.error(`   Time:       ${watchdog.lastAttack.ts}\n`);

    // Broadcast EMERGENCY to all connected browsers
    broadcast({
      type:        'EMERGENCY_SHUTDOWN',
      attack,
      confidence:  conf,
      action:      prediction.recommended_action,
      ale:         fair?.ale_display || '—',
      breakdown:   fair?.breakdown   || {},
      ts:          watchdog.lastAttack.ts,
      countdown:   10,
    });

    // Append to blockchain ledger
    appendBlock('EMERGENCY — Cyber Attack', {
      attack, confidence: conf,
      ale: fair?.ale_display,
      ts:  watchdog.lastAttack.ts,
    });

    // Send countdown ticks 10 → 0
    let secs = 10;
    const countdownId = setInterval(() => {
      secs--;
      broadcast({ type: 'countdown', secs });
      if (secs <= 0) {
        clearInterval(countdownId);
        // Broadcast final message — give SSE clients time to receive it
        broadcast({ type: 'SERVER_SHUTDOWN', ts: new Date().toISOString() });
        console.error('🔴  Emergency shutdown initiated…');

        watchdog.shutdownTimer = setTimeout(() => {
          // Kill Python AI service on port 5000
          try {
            execSync(
              'powershell -Command "$c=Get-NetTCPConnection -LocalPort 5000 -EA SilentlyContinue; if($c){ Stop-Process -Id $c.OwningProcess -Force -EA SilentlyContinue }"',
              { timeout: 4000 }
            );
          } catch(_) {}
          // Self-exit 1 second later so browsers get SERVER_SHUTDOWN first
          setTimeout(() => process.exit(99), 1000);
        }, 2000);
      }
    }, 1000);

    // Stop the poll loop
    clearInterval(watchdog.intervalId);
    watchdog.intervalId = null;
  }
}

// GET /api/v1/watchdog/stream  — SSE endpoint browsers subscribe to
app.get('/api/v1/watchdog/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  watchdog.clients.add(res);

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify({
    type:      'connected',
    emergency: watchdog.emergency,
    attack:    watchdog.lastAttack,
    ts:        new Date().toISOString(),
  })}\n\n`);

  req.on('close', () => watchdog.clients.delete(res));
});

// POST /api/v1/watchdog/start  — start the watchdog poll loop
app.post('/api/v1/watchdog/start', (req, res) => {
  if (watchdog.emergency) return res.json({ status: 'emergency', message: 'System in emergency shutdown mode' });
  if (watchdog.intervalId) return res.json({ status: 'already_running' });

  watchdog.active = true;
  liveEventIdx    = 0;
  watchdog.intervalId = setInterval(watchdogTick, 4000);
  watchdogTick(); // fire immediately
  res.json({ status: 'started', interval_ms: 4000 });
});

// POST /api/v1/watchdog/stop   — stop the watchdog
app.post('/api/v1/watchdog/stop', (req, res) => {
  if (watchdog.intervalId) { clearInterval(watchdog.intervalId); watchdog.intervalId = null; }
  watchdog.active = false;
  res.json({ status: 'stopped' });
});

// POST /api/v1/watchdog/reset  — clear emergency state (manual recovery)
app.post('/api/v1/watchdog/reset', (req, res) => {
  watchdog.emergency = false;
  watchdog.lastAttack = null;
  liveEventIdx = 0;
  demoAttackQueued = false;
  appendBlock('Emergency Reset', { ts: new Date().toISOString(), operator: 'manual' });
  broadcast({ type: 'reset', ts: new Date().toISOString() });
  res.json({ status: 'reset' });
});

// POST /api/v1/watchdog/trigger-attack  — queue a demo attack on next poll tick
app.post('/api/v1/watchdog/trigger-attack', (req, res) => {
  if (!watchdog.active || watchdog.emergency) {
    return res.json({ status: 'ignored', reason: 'watchdog not active or already in emergency' });
  }
  demoAttackQueued = true;
  res.json({ status: 'queued', message: 'Demo attack will fire on next poll tick (~4s)' });
});

// GET /api/v1/watchdog/status  — current watchdog state
app.get('/api/v1/watchdog/status', (req, res) => {
  res.json({
    active:     watchdog.active,
    emergency:  watchdog.emergency,
    lastAttack: watchdog.lastAttack,
    clients:    watchdog.clients.size,
    ts:         new Date().toISOString(),
  });
});

// ════════════════════════════════════════════════════════════════════
//  NEW AI-POWERED ENDPOINTS
// ════════════════════════════════════════════════════════════════════

// GET /api/v1/ai/status  — AI service health passthrough
app.get('/api/v1/ai/status', async (req, res) => {
  const h = await ai('/health');
  if (!h) return res.status(503).json({ status: 'offline', message: 'AI service not reachable on port 5000' });
  res.json(h);
});

// GET /api/v1/ai/dataset-stats  — real stats from the 25k-row CSV
app.get('/api/v1/ai/dataset-stats', async (req, res) => {
  const data = await ai('/dataset-stats');
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// GET /api/v1/ai/attack-distribution  — per-attack-type counts + avg risk
app.get('/api/v1/ai/attack-distribution', async (req, res) => {
  const data = await ai('/attack-distribution');
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// GET /api/v1/ai/top-threats?limit=10  — top risky events from real dataset
app.get('/api/v1/ai/top-threats', async (req, res) => {
  const limit = req.query.limit || 10;
  const data  = await ai(`/top-threats?limit=${limit}`);
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// GET /api/v1/ai/feature-importance  — RF feature importances
app.get('/api/v1/ai/feature-importance', async (req, res) => {
  const data = await ai('/feature-importance');
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// POST /api/v1/ai/predict  — classify a single event
app.post('/api/v1/ai/predict', async (req, res) => {
  const data = await ai('/predict', req.body);
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// POST /api/v1/ai/anomaly  — isolation forest anomaly check
app.post('/api/v1/ai/anomaly', async (req, res) => {
  const data = await ai('/anomaly', req.body);
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// POST /api/v1/ai/risk-score  — FAIR financial loss estimate
app.post('/api/v1/ai/risk-score', async (req, res) => {
  const data = await ai('/risk-score', req.body);
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// POST /api/v1/ai/analyze  — full pipeline: predict + anomaly + FAIR + narrative
app.post('/api/v1/ai/analyze', async (req, res) => {
  const event = req.body;

  // run predict + anomaly in parallel
  const [prediction, anomaly] = await Promise.all([
    ai('/predict', event),
    ai('/anomaly', event),
  ]);

  if (!prediction) return res.status(503).json({ error: 'AI service offline' });

  // FAIR loss using ML-predicted attack type
  const fair = await ai('/risk-score', {
    attack_type:      prediction.predicted_attack,
    risk_score:       event.endpoint_risk_score || event.risk_score || 50,
    transaction_amount: event.transaction_amount || 0,
    data_sensitivity:   event.data_sensitivity || 'low',
  });

  // GPT/rule-based narrative
  const explain = await ai('/ai-explain', { event, prediction, fair });

  res.json({
    event,
    prediction:  prediction || {},
    anomaly:     anomaly    || {},
    fair:        fair       || {},
    narrative:   explain?.narrative || '',
    model_used:  explain?.model_used || 'rule-based-fallback',
    analyzed_at: new Date().toISOString(),
  });
});

// POST /api/v1/ai/explain  — GPT narrative only
app.post('/api/v1/ai/explain', async (req, res) => {
  const data = await ai('/ai-explain', req.body);
  if (!data) return res.status(503).json({ error: 'AI service offline' });
  res.json(data);
});

// ════════════════════════════════════════════════════════════════════
//  BLOCKCHAIN LEDGER
// ════════════════════════════════════════════════════════════════════
const ledger = [];
const sha256 = obj => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const appendBlock = (event, payload) => {
  const prev = ledger.length ? ledger[ledger.length-1].hash : '0'.repeat(64);
  const ts   = new Date().toISOString();
  const body = { event, payload, prev, ts, model: MODEL_VERSION };
  const block = {
    id:   'BLK-' + String(ledger.length+1).padStart(4, '0'),
    tx:   '0x' + sha256([ts, event]).slice(0, 16),
    ...body,
    hash: sha256(body),
  };
  ledger.push(block);
  return block;
};

// genesis
appendBlock('Genesis',         { note: 'Chain initialised' });
appendBlock('Risk Assessment', { score: 78, model: MODEL_VERSION });
appendBlock('Risk Calculation',{ exposure: BASE, model: MODEL_VERSION });
appendBlock('Model Update',    { version: MODEL_VERSION });

// ── Reset watchdog state on startup (clean slate) ────────────────
watchdog.emergency = false;
watchdog.lastAttack = null;
demoAttackQueued = false;
liveEventIdx = 0;

app.post('/api/v1/audit/ledger-commit', (req, res) => {
  const block = appendBlock(req.body.event || 'Investment Decision', req.body.payload || {});
  res.json({ ...block, verified: true });
});
app.get('/api/v1/audit', (_req, res) => res.json([...ledger].reverse()));
app.get('/api/v1/audit/verify/:id', (req, res) => {
  const block = ledger.find(b => b.id === req.params.id);
  if (!block) return res.status(404).json({ error: 'Block not found' });
  const { event, payload, prev, ts, model } = block;
  res.json({ id: block.id, verified: sha256({ event, payload, prev, ts, model }) === block.hash });
});

// ── boot ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Node API     → http://localhost:${PORT}`);
  console.log(`🔗  AI service   → ${AI_URL}`);
  console.log(`📦  Model        → ${MODEL_VERSION}`);
});

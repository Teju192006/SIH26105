'use client';
import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, Database, Network, Calculator, ShieldCheck,
  SlidersHorizontal, Activity, BrainCircuit, DollarSign, Target,
  CheckCircle2, Zap, RefreshCw, ChevronRight, BookOpen, ArrowRight,
  Cpu, TrendingUp, Search, Sparkles, Volume2, VolumeX, Bell, BellOff
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, CartesianGrid,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend
} from 'recharts';

/* ── helpers ── */
const inr   = n => '₹' + Math.round(n).toLocaleString('en-IN');
const inrL  = n => '₹' + (n / 1e5).toFixed(1) + 'L';
const inrCr = n => '₹' + (n / 1e7).toFixed(2) + ' Cr';
const pct   = n => (n * 100).toFixed(1) + '%';
const api   = (p, b) =>
  fetch('/api/v1/' + p, b
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }
    : undefined
  ).then(r => r.json());

// Direct AI microservice calls (proxied via next.config.js → port 5000)
const aiApi = (p, b) =>
  fetch('/api/ai/' + p, b
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }
    : undefined
  ).then(r => r.json()).catch(() => null);

/* ── static ── */
const PROBLEMS = [
  { icon: '📊', color: '#ef4444', title: 'Qualitative Risk',    text: '"High risk" gives no ₹ figure — boards cannot act on it.' },
  { icon: '⏱️', color: '#f59e0b', title: 'Stale Assessments',   text: 'Periodic reviews go stale as threats evolve daily.' },
  { icon: '🔗', color: '#a78bfa', title: 'Disconnected Data',    text: 'SIEM, EDR, IAM & CSPM sit in isolated silos.' },
  { icon: '🏦', color: '#22d3ee', title: 'No Business Linkage',  text: 'CVEs are not linked to revenue, downtime or fines.' },
  { icon: '💰', color: '#22c55e', title: 'Unoptimized Budget',   text: 'No method to pick the best mix of controls per rupee.' },
  { icon: '📣', color: '#ec4899', title: 'Executive Gap',        text: 'CISOs speak CVEs; management needs ₹ ROI.' },
];

const PIPELINE = [
  { label: 'Telemetry',    color: '#0ea5e9', Icon: Activity     },
  { label: 'AI Engine',    color: '#7c3aed', Icon: BrainCircuit },
  { label: 'Biz Impact',   color: '#f59e0b', Icon: Network      },
  { label: '₹ Loss Est.',  color: '#ef4444', Icon: DollarSign   },
  { label: 'Optimizer',    color: '#22c55e', Icon: Calculator   },
  { label: 'Decision',     color: '#ec4899', Icon: Target       },
];

const TECH = [
  ['Next.js 14',      '#0ea5e9'],['Node/Express', '#22c55e'],['Recharts',   '#a78bfa'],
  ['FAIR Model',      '#f59e0b'],['Integer LP',   '#22d3ee'],['SHA-256 Ledger','#ec4899'],
  ['Monte Carlo',     '#f97316'],['CVE/NVD Data', '#ef4444'],['MITRE ATT&CK','#8b5cf6'],
  ['NIST CSF 2.0',    '#06b6d4'],
];

const SOURCES = [
  { name: 'FAIR Institute',             url: 'https://www.fairinstitute.org/',               type: 'Risk Model' },
  { name: 'NIST NVD',                   url: 'https://nvd.nist.gov/',                        type: 'CVE Data'   },
  { name: 'IBM Cost of Data Breach 2023', url: 'https://www.ibm.com/reports/data-breach',   type: 'Research'   },
  { name: 'MITRE ATT&CK',               url: 'https://attack.mitre.org/',                   type: 'Threat Intel'},
  { name: 'NIST CSF 2.0',               url: 'https://www.nist.gov/cyberframework',         type: 'Framework'  },
  { name: 'RBI Cyber Security Framework',url: 'https://www.rbi.org.in/',                    type: 'Regulation' },
];

const SCENARIOS = {
  'Ransomware':        1.35,
  'Payment API Attack':1.50,
  'Cloud Misconfiguration':1.20,
  'Insider Threat':    1.15,
  'Zero-Day':          1.60,
  'Third-Party Breach':1.25,
};

const CRIT_COLOR = { Critical: '#ef4444', High: '#f59e0b', Medium: '#22d3ee', Low: '#22c55e' };

/* ── small atoms ── */
const Kpi = ({ label, value, color = '#e2eafc', sub }) => (
  <div style={{
    background: 'rgba(10,18,38,0.7)', border: '1px solid rgba(56,100,180,0.2)',
    borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 0,
  }}>
    <div style={{ fontSize: 10, color: '#5a7099', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.5px' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#5a7099', marginTop: 3 }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ icon: Icon, color, title, sub }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: color + '18', border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={color} />
      </div>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px', color: '#e2eafc' }}>{title}</h2>
    </div>
    {sub && <p style={{ margin: '0 0 0 44px', fontSize: 12, color: '#5a7099' }}>{sub}</p>}
  </div>
);

const Card = ({ children, accent, style = {} }) => (
  <div style={{
    background: 'rgba(10,18,38,0.75)', backdropFilter: 'blur(14px)',
    border: `1px solid ${accent ? accent + '30' : 'rgba(56,100,180,0.18)'}`,
    borderRadius: 18, padding: '18px 20px', position: 'relative', overflow: 'hidden',
    ...style,
  }}>
    {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />}
    {children}
  </div>
);

const ProgBar = ({ label, value, pct: p, color }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: '#a0b3d6' }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
    <div style={{ height: 5, background: 'rgba(56,100,180,0.18)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: p + '%', background: color, borderRadius: 99, transition: 'width 0.7s ease' }} />
    </div>
  </div>
);

const Row2 = ({ children, gap = 16 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, marginBottom: gap }}>
    {children}
  </div>
);

const Divider = () => (
  <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(14,165,233,0.2),transparent)', margin: '36px 0' }} />
);

const Disc = () => null;

const TT = { contentStyle: { background: '#0d1730', border: '1px solid rgba(56,100,180,0.3)', borderRadius: 10, fontSize: 12 } };

/* ══════════════════════════════════════════════════════
   🚨 SIREN SYSTEM COMPONENTS
══════════════════════════════════════════════════════ */

/* Spinning police-light SVG with red/blue flash */
const SirenLight = ({ active, size = 80 }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    <style>{`
      @keyframes sirenSpin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes sirenFlashR  { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      @keyframes sirenFlashB  { 0%,49%{opacity:0} 50%,100%{opacity:1} }
      @keyframes sirenBounce  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
      @keyframes barDance1 { 0%,100%{height:6px} 50%{height:22px} }
      @keyframes barDance2 { 0%,100%{height:14px} 50%{height:8px} }
      @keyframes barDance3 { 0%,100%{height:10px} 50%{height:20px} }
      @keyframes barDance4 { 0%,100%{height:18px} 50%{height:6px} }
      @keyframes barDance5 { 0%,100%{height:8px}  50%{height:16px} }
      @keyframes overlayPulse { 0%,100%{background:rgba(0,0,0,0.93)} 50%{background:rgba(100,0,0,0.97)} }
      @keyframes titleShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px)} 40%{transform:translateX(4px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
      @keyframes scanFlash  { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.7)} 70%{box-shadow:0 0 0 10px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
    `}</style>
    {/* outer glow ring */}
    <div style={{
      position:'absolute', inset:-6, borderRadius:'50%',
      boxShadow: active ? '0 0 30px 8px rgba(239,68,68,0.55), 0 0 60px 16px rgba(239,68,68,0.2)' : 'none',
      transition:'box-shadow 0.3s',
    }}/>
    <svg viewBox="0 0 80 80" width={size} height={size} style={{ display:'block', animation: active ? 'sirenBounce 0.5s ease-in-out infinite' : 'none' }}>
      <defs>
        <radialGradient id="sirenGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ef4444" stopOpacity={active ? "0.9" : "0.2"}/>
          <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.3"/>
        </radialGradient>
        <radialGradient id="sirenGlowB" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity={active ? "0.9" : "0.2"}/>
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.3"/>
        </radialGradient>
      </defs>
      {/* base dome */}
      <circle cx="40" cy="40" r="36" fill="#1a0a0a" stroke={active ? '#ef4444' : '#3d1515'} strokeWidth="2"/>
      {/* rotating beam — red half */}
      <path d="M40 40 L40 6 A34 34 0 0 1 74 40 Z" fill="url(#sirenGlow)"
        style={{ transformOrigin:'40px 40px', animation: active ? 'sirenSpin 0.8s linear infinite' : 'none', opacity: active ? 1 : 0.15 }}/>
      {/* blue half (opposite phase) */}
      <path d="M40 40 L40 74 A34 34 0 0 1 6 40 Z" fill="url(#sirenGlowB)"
        style={{ transformOrigin:'40px 40px', animation: active ? 'sirenSpin 0.8s linear infinite' : 'none', opacity: active ? 1 : 0.15 }}/>
      {/* center hub */}
      <circle cx="40" cy="40" r="12" fill={active ? '#ef4444' : '#3d1515'} style={{ transition:'fill 0.3s', filter: active ? 'drop-shadow(0 0 6px #ef4444)' : 'none' }}/>
      {/* siren emoji in hub */}
      <text x="40" y="45" textAnchor="middle" fontSize="12" style={{ userSelect:'none' }}>🚨</text>
    </svg>
  </div>
);

/* Sound bars — animate when siren is active */
const SoundBars = ({ active }) => (
  <div style={{ display:'flex', alignItems:'center', gap:3, height:24 }}>
    {[
      {anim:'barDance1',delay:'0s'},
      {anim:'barDance2',delay:'0.1s'},
      {anim:'barDance3',delay:'0.2s'},
      {anim:'barDance4',delay:'0.05s'},
      {anim:'barDance5',delay:'0.15s'},
    ].map((b,i) => (
      <div key={i} style={{
        width: 4, height: active ? undefined : 4,
        background: active ? `hsl(${0+i*10},90%,55%)` : 'rgba(239,68,68,0.3)',
        borderRadius: 2,
        animation: active ? `${b.anim} 0.4s ease-in-out infinite ${b.delay}` : 'none',
        transition: 'background 0.3s',
      }}/>
    ))}
  </div>
);

/* Audio permission request banner — shown until user grants permission */
const AudioPermissionBanner = ({ onGrant, granted }) => {
  if (granted) return null;
  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      zIndex:8000, background:'rgba(10,18,38,0.96)', backdropFilter:'blur(16px)',
      border:'1px solid rgba(239,68,68,0.4)', borderRadius:16,
      padding:'14px 24px', display:'flex', alignItems:'center', gap:14,
      boxShadow:'0 8px 40px rgba(239,68,68,0.2)', minWidth:360, maxWidth:480,
    }}>
      <div style={{ fontSize:28, flexShrink:0 }}>🔊</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:800, fontSize:13, color:'#e2eafc', marginBottom:3 }}>
          Enable Siren Audio
        </div>
        <div style={{ fontSize:11, color:'#5a7099', lineHeight:1.5 }}>
          The AI watchdog requires audio permission to sound the emergency siren when a cyber attack is detected.
        </div>
      </div>
      <button onClick={onGrant} style={{
        background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff',
        border:0, borderRadius:10, padding:'9px 18px', fontWeight:800,
        fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
      }}>
        Allow Siren
      </button>
    </div>
  );
};

/* ── 3D Shield ── */
const Shield3D = ({ score }) => {
  const fill = '#22c55e';
  const h = 100;
  return (
    <svg viewBox="0 0 120 140" width={150} style={{ filter: `drop-shadow(0 0 18px ${fill}55)`, display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1e3a5f"/><stop offset="1" stopColor="#0a1a35"/></linearGradient>
        <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop stopColor={fill} stopOpacity="0.9"/><stop offset="1" stopColor={fill} stopOpacity="0.15"/></linearGradient>
        <clipPath id="sc"><path d="M60 8 L108 28 L108 72 Q108 112 60 132 Q12 112 12 72 L12 28 Z"/></clipPath>
      </defs>
      <ellipse cx="60" cy="136" rx="26" ry="5" fill="rgba(0,0,0,0.3)"/>
      <path d="M60 8 L108 28 L108 72 Q108 112 60 132 Q12 112 12 72 L12 28 Z" fill="url(#sg)" stroke={fill} strokeWidth="1.5" strokeOpacity="0.5"/>
      <rect x="0" y={132 - h * 1.32} width="120" height={h * 1.32} fill="url(#fg)" clipPath="url(#sc)"/>
      <path d="M60 8 L12 28 L12 72 Q12 112 60 132" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2"/>
      <text x="60" y="52" textAnchor="middle" fontSize="18">⚡</text>
      <text x="60" y="80" textAnchor="middle" fontSize="28" fontWeight="900" fill="#e2eafc" fontFamily="Inter,sans-serif">{score}</text>
      <text x="60" y="96" textAnchor="middle" fontSize="9" fontWeight="700" fill={fill} letterSpacing="1" fontFamily="Inter,sans-serif">RISK SCORE</text>
    </svg>
  );
};

/* ── 3D Layer Stack SVG ── */
const LayerStack = () => (
  <svg viewBox="0 0 280 220" width="100%" style={{ maxWidth: 300, display: 'block', margin: '0 auto' }}>
    <defs>
      {[['l1','#0ea5e9','#0369a1'],['l2','#7c3aed','#4c1d95'],['l3','#22c55e','#15803d'],['l4','#ef4444','#991b1b'],['l5','#f59e0b','#92400e']].map(([id,c1,c2])=>(
        <linearGradient key={id} id={id} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={c1} stopOpacity="0.85"/><stop offset="1" stopColor={c2} stopOpacity="0.9"/>
        </linearGradient>
      ))}
    </defs>
    {[
      [140,200,250,175,30,'l5','BLOCKCHAIN AUDIT'],
      [140,168,235,145,30,'l4','INVESTMENT OPTIMIZER'],
      [140,136,220,115,30,'l3','FINANCIAL QUANTIFICATION'],
      [140,104,205,85, 30,'l2','AI RISK ENGINE (FAIR)'],
      [140,72, 190,55, 30,'l1','SECURITY TELEMETRY'],
    ].map(([cx,by,bw,ty,th,gid,lbl])=>(
      <g key={lbl}>
        <path d={`M${cx-bw/2} ${by} L${cx+bw/2} ${by} L${cx+bw/2} ${by-10} L${cx} ${by-4} L${cx-bw/2} ${by-10} Z`} fill="#1a2a4a" stroke="rgba(56,100,180,0.25)" strokeWidth="0.5"/>
        <path d={`M${cx-bw/2} ${by-10} L${cx} ${by-4} L${cx} ${ty} L${cx-bw/2} ${ty+6} Z`} fill={`url(#${gid})`} opacity="0.7"/>
        <path d={`M${cx} ${by-4} L${cx+bw/2} ${by-10} L${cx+bw/2} ${ty+6} L${cx} ${ty} Z`} fill={`url(#${gid})`} opacity="0.9"/>
        <path d={`M${cx-bw/2} ${ty+6} L${cx} ${ty} L${cx+bw/2} ${ty+6} L${cx} ${ty+12} Z`} fill={`url(#${gid})`}/>
        <text x={cx} y={ty+14} textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily="Inter,sans-serif">{lbl}</text>
      </g>
    ))}
    <circle cx="140" cy="25" r="5" fill="#0ea5e9"/><circle cx="140" cy="25" r="10" fill="none" stroke="#0ea5e9" strokeWidth="1" opacity="0.4"/>
  </svg>
);

/* ══════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════ */
export default function Home() {
  const [budget, setBudget] = useState(1000000);
  const [mult,   setMult]   = useState(1);
  const [dash,   setDash]   = useState(null);
  const [opt,    setOpt]    = useState(null);
  const [assets, setAssets] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [sim,    setSim]    = useState(null);
  const [busy,   setBusy]   = useState('');
  const [ver,    setVer]    = useState({});
  const [simGo,  setSimGo]  = useState(false);

  // ── AI state ──────────────────────────────────────────────────
  const [aiStatus,   setAiStatus]   = useState(null);  // AI health
  const [aiStats,    setAiStats]    = useState(null);  // dataset stats
  const [aiDist,     setAiDist]     = useState([]);    // attack distribution
  const [aiTopThreats, setAiTopThreats] = useState([]); // top-10 risky events
  const [aiFeat,     setAiFeat]     = useState([]);    // feature importance
  const [aiAnalysis, setAiAnalysis] = useState(null);  // single event analysis
  const [aiAnalyzing,setAiAnalyzing]= useState(false);
  const [aiNarrative,setAiNarrative]= useState('');

  // ── Watchdog / Emergency state ────────────────────────────────
  const [watchdogOn,  setWatchdogOn]  = useState(false);
  const [emergency,   setEmergency]   = useState(null);
  const [countdown,   setCountdown]   = useState(null);
  const [scanLog,     setScanLog]     = useState([]);
  const [sirenActive, setSirenActive] = useState(false);
  const [audioGranted,setAudioGranted]= useState(false); // user has unlocked AudioContext
  const audioCtxRef   = useRef(null);
  const sirenNodesRef = useRef([]);
  const gainMasterRef = useRef(null); // master gain for volume ramp
  const sseRef        = useRef(null);

  const loadLedger = () => api('audit').then(setLedger);
  const commit = (ev, pl) => api('audit/ledger-commit', { event: ev, payload: pl }).then(loadLedger);

  useEffect(() => {
    api('assets').then(setAssets);
    loadLedger();
    api('impact/propagate', { target: 'paymentapi', intensity: 0 }).then(setSim);
    // AI microservice data — non-blocking, degrades gracefully if offline
    aiApi('health').then(setAiStatus);
    aiApi('dataset-stats').then(setAiStats);
    aiApi('attack-distribution').then(d => d && setAiDist(d));
    aiApi('top-threats?limit=10').then(d => d && setAiTopThreats(d));
    aiApi('feature-importance').then(d => d && setAiFeat(d));
  }, []);

  useEffect(() => {
    api('dashboard?mult=' + mult).then(setDash);
    api('optimize/portfolio', { budget, mult }).then(setOpt);
  }, [budget, mult]);

  const runOpt = async () => {
    const steps = ['Loading data…', 'Building constraint matrix…', 'Running integer LP…', 'Computing Pareto frontier…'];
    for (const s of steps) { setBusy(s); await new Promise(r => setTimeout(r, 480)); }
    setBusy('');
    const o = await api('optimize/portfolio', { budget, mult });
    setOpt(o);
    commit('Investment Decision', { budget, controls: o.recommended.controls, reduction: o.recommended.reduction });
  };

  const runAttack = async i => {
    setSimGo(true);
    const s = await api('impact/propagate', { target: 'paymentapi', intensity: i });
    setSim(s); setSimGo(false);
    if (i) commit('Incident Sim', { intensity: i });
  };

  // Run full AI analysis on a sample high-risk event from the dataset
  const runAiAnalysis = async () => {
    setAiAnalyzing(true);
    setAiNarrative('');

    // Pull a REAL top-threat event from the live dataset instead of static data
    let eventToAnalyze = null;
    try {
      const topThreats = await aiApi('top-threats?limit=5');
      if (topThreats && topThreats.length > 0) {
        // Pick a random one from top 5 for variety
        const pick = topThreats[Math.floor(Math.random() * topThreats.length)];
        eventToAnalyze = {
          // Map dataset columns to AI service feature names
          account_type:          'savings',
          customer_industry:     pick.channel === 'api' ? 'technology' : 'banking',
          user_role:             'customer',
          region:                pick.region  || 'AP-Southeast',
          country:               pick.country || 'IN',
          channel:               pick.channel || 'mobile_app',
          device_type:           'android',
          payment_method:        'upi',
          action:                'transfer',
          ip_reputation:         pick.ip_reputation || 'suspicious',
          data_sensitivity:      pick.data_sensitivity || 'high',
          transaction_amount:    Number(pick.transaction_amount) || 95000,
          login_attempts_24h:    Number(pick.login_attempts_24h) || 18,
          failed_logins_24h:     Number(pick.failed_logins_24h)  || 12,
          account_age_days:      180,
          transactions_24h:      8,
          device_age_days:       3,
          session_minutes:       2,
          password_age_days:     400,
          mfa_enabled:           0,
          known_device:          0,
          vpn_or_tor:            1,
          privileged_access:     0,
          geo_velocity_kmh:      820,
          new_beneficiary:       1,
          api_rate_per_min:      Number(pick.api_rate_per_min) || 48,
          endpoint_risk_score:   Number(pick.risk_score) || 87,
          data_download_mb:      0.5,
          chargeback_count_90d:  2,
          previous_fraud_flags:  1,
          // carry original dataset fields for display
          _source_event_id:      pick.event_id,
          _source_attack_type:   pick.attack_type,
          _source_risk_score:    pick.risk_score,
        };
      }
    } catch (_) {}

    // Fallback to representative high-risk event if top-threats unavailable
    if (!eventToAnalyze) {
      eventToAnalyze = {
        account_type: 'savings', customer_industry: 'banking',
        user_role: 'customer', region: 'AP-Southeast', country: 'IN',
        channel: 'mobile_app', device_type: 'android', payment_method: 'upi',
        action: 'transfer', ip_reputation: 'malicious', data_sensitivity: 'high',
        transaction_amount: 95000, login_attempts_24h: 44, failed_logins_24h: 22,
        account_age_days: 180, transactions_24h: 8, device_age_days: 3,
        session_minutes: 2, password_age_days: 400, mfa_enabled: 0,
        known_device: 0, vpn_or_tor: 1, privileged_access: 1,
        geo_velocity_kmh: 820, new_beneficiary: 1, api_rate_per_min: 120,
        endpoint_risk_score: 97, data_download_mb: 0.5,
        chargeback_count_90d: 2, previous_fraud_flags: 1,
      };
    }

    const result = await aiApi('analyze', eventToAnalyze);
    if (result) {
      // Attach source metadata so UI can display which real event was used
      result._source = eventToAnalyze;
      setAiAnalysis(result);
      setAiNarrative(result.narrative || '');
    }
    setAiAnalyzing(false);
  };

  // ── Web Audio siren ───────────────────────────────────────────────
  // Prime AudioContext on first user interaction (browsers block autoplay)
  const primeAudio = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setAudioGranted(true);
    } catch(e) { console.warn('AudioContext init:', e); }
  };

  // Called from "Allow Siren" banner button
  const grantAudio = () => {
    primeAudio();
  };

  const startSiren = async () => {
    try {
      // Create or resume AudioContext
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state === 'closed') return; // can't use a closed context

      // Stop any previous nodes
      sirenNodesRef.current.forEach(n => { try { n.stop(0); } catch(_){} });
      sirenNodesRef.current = [];
      if (gainMasterRef.current) {
        try { gainMasterRef.current.disconnect(); } catch(_){}
      }

      // Master gain with volume ramp-up (0 → 0.8 over 0.4s)
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.4);
      master.connect(ctx.destination);
      gainMasterRef.current = master;

      // Voice factory: sawtooth osc + FM LFO for wailing pitch sweep
      const makeVoice = (baseHz, gainAmt, lfoHz, lfoDepth) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo  = ctx.createOscillator();
        const lfoG = ctx.createGain();

        osc.type            = 'sawtooth';
        osc.frequency.value = baseHz;
        gain.gain.value     = gainAmt;

        lfo.type            = 'sine';
        lfo.frequency.value = lfoHz;   // sweep rate
        lfoG.gain.value     = lfoDepth; // sweep depth in Hz

        lfo.connect(lfoG);
        lfoG.connect(osc.frequency); // FM modulation → wail
        osc.connect(gain);
        gain.connect(master);

        lfo.start(ctx.currentTime);
        osc.start(ctx.currentTime);
        sirenNodesRef.current.push(osc, lfo);
      };

      // Layer 1 — primary high wail (classic UK/EU siren)
      makeVoice(880, 0.40, 1.0, 400);
      // Layer 2 — lower harmony
      makeVoice(660, 0.28, 1.0, 300);
      // Layer 3 — sub bass pulse for urgency
      makeVoice(220, 0.18, 2.0, 80);

      setSirenActive(true);
      setAudioGranted(true);
    } catch(e) {
      console.error('Siren startSiren error:', e);
    }
  };

  const stopSiren = () => {
    if (gainMasterRef.current) {
      try {
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === 'running') {
          // Ramp down gracefully over 0.3s to avoid click
          gainMasterRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        }
      } catch(_){}
    }
    setTimeout(() => {
      sirenNodesRef.current.forEach(n => { try { n.stop(0); } catch(_){} });
      sirenNodesRef.current = [];
    }, 350);
    setSirenActive(false);
  };

  // ── SSE watchdog — direct to port 4000 (Next.js proxy breaks SSE) ────
  const WD = 'http://localhost:4000';  // direct connection bypasses Next.js proxy

  const startWatchdog = async () => {
    primeAudio(); // MUST be called from a user gesture to unlock AudioContext
    await fetch(`${WD}/api/v1/watchdog/start`,{method:'POST'});
    setWatchdogOn(true);
    if(sseRef.current) sseRef.current.close();
    const es=new EventSource(`${WD}/api/v1/watchdog/stream`);
    sseRef.current=es;
    es.onmessage=(e)=>{
      const msg=JSON.parse(e.data);
      if(msg.type==='scan_ok'||msg.type==='ATTACK_DETECTED'||msg.type==='EMERGENCY_SHUTDOWN'){
        setScanLog(prev=>[{ts:msg.ts,result:msg.type==='scan_ok'?'CLEAN':'ATTACK',attack:msg.attack,conf:msg.confidence},...prev].slice(0,8));
      }
      if(msg.type==='EMERGENCY_SHUTDOWN'){ setEmergency(msg); setCountdown(msg.countdown||10); startSiren(); }
      if(msg.type==='countdown'){ setCountdown(msg.secs); }
      if(msg.type==='SERVER_SHUTDOWN'){
        setCountdown(0);
        // Show "SYSTEM OFFLINE" for 3 seconds on the overlay
        setEmergency(prev => prev ? {...prev, offline: true} : prev);
      }
      if(msg.type==='reset'){ setEmergency(null); setCountdown(null); stopSiren(); setScanLog([]); }
    };
    es.onerror=()=>setWatchdogOn(false);
  };

  const stopWatchdog = async () => {
    await fetch(`${WD}/api/v1/watchdog/stop`,{method:'POST'});
    if(sseRef.current){sseRef.current.close();sseRef.current=null;}
    setWatchdogOn(false); stopSiren();
  };

  const resetEmergency = async () => {
    await fetch(`${WD}/api/v1/watchdog/reset`,{method:'POST'});
    setEmergency(null); setCountdown(null); stopSiren(); setScanLog([]); setWatchdogOn(false);
  };

  if (!dash || !opt) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 14, color: '#5a7099' }}>
      <div style={{ fontSize: 38 }}>⚙️</div>
      <div style={{ fontWeight: 700, color: '#e2eafc' }}>Connecting to Risk Engine…</div>
      <code style={{ background: 'rgba(14,165,233,0.1)', padding: '6px 14px', borderRadius: 8, color: '#22d3ee', fontSize: 13 }}>
        cd server && npm start
      </code>
    </div>
  );

  const rec = opt.recommended;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px', color: '#e2eafc', fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* Audio permission banner — floats at bottom until user grants */}
      <AudioPermissionBanner granted={audioGranted} onGrant={grantAudio} />

      {/* ══════════════════════════════════════════════════════════
          🚨 EMERGENCY OVERLAY — shown when attack is detected
      ══════════════════════════════════════════════════════════ */}
      {emergency && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          animation:'overlayPulse 0.7s ease-in-out infinite alternate',
          padding:'20px',
        }}>
          {/* Two red flash bars — top and bottom */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:8, background:'linear-gradient(90deg,#ef4444,#f97316,#ef4444)', animation:'sirenFlashR 0.5s ease-in-out infinite' }}/>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:8, background:'linear-gradient(90deg,#3b82f6,#06b6d4,#3b82f6)', animation:'sirenFlashB 0.5s ease-in-out infinite' }}/>

          {/* Left siren light */}
          <div style={{ position:'absolute', top:24, left:32 }}>
            <SirenLight active={sirenActive} size={72} />
          </div>
          {/* Right siren light */}
          <div style={{ position:'absolute', top:24, right:32 }}>
            <SirenLight active={sirenActive} size={72} />
          </div>

          {/* Main content card */}
          <div style={{
            background:'rgba(8,0,0,0.92)', border:'2px solid rgba(239,68,68,0.6)',
            borderRadius:24, padding:'36px 44px', maxWidth:560, width:'100%',
            textAlign:'center', boxShadow:'0 0 80px rgba(239,68,68,0.4), inset 0 0 40px rgba(239,68,68,0.06)',
            position:'relative',
          }}>
            {/* Big siren + sound bars row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20, marginBottom:20 }}>
              <SoundBars active={sirenActive} />
              <div style={{ animation:'sirenBounce 0.5s ease-in-out infinite' }}>
                <SirenLight active={sirenActive} size={96} />
              </div>
              <SoundBars active={sirenActive} />
            </div>

            {/* Title — shakes */}
            <div style={{
              fontSize:36, fontWeight:900, color:'#ef4444',
              letterSpacing:'-0.5px', marginBottom:8,
              animation: emergency.offline ? 'none' : 'titleShake 0.4s ease-in-out infinite',
              textShadow:'0 0 30px rgba(239,68,68,0.6)',
            }}>
              {emergency.offline ? '✅ SYSTEM OFFLINE' : '🚨 CYBER ATTACK DETECTED'}
            </div>

            {/* Attack type + confidence */}
            {!emergency.offline && (
              <div style={{ fontSize:15, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>
                {emergency.attack?.replace(/_/g,' ').toUpperCase()}
                &nbsp;·&nbsp;
                {Math.round((emergency.confidence||0)*100)}% CONFIDENCE
              </div>
            )}
            <div style={{ fontSize:13, color:'#a0b3d6', marginBottom:24 }}>
              {emergency.offline
                ? 'All services stopped. Click Reset to restart.'
                : 'AI detected a high-confidence attack. Emergency shutdown in progress.'}
            </div>

            {/* Countdown ring */}
            <div style={{ position:'relative', width:130, height:130, margin:'0 auto 20px' }}>
              <svg viewBox="0 0 130 130" style={{ position:'absolute', inset:0 }}>
                <circle cx="65" cy="65" r="58" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="9"/>
                <circle cx="65" cy="65" r="58" fill="none"
                  stroke={countdown <= 3 ? '#ef4444' : '#f59e0b'} strokeWidth="9"
                  strokeDasharray={`${2*Math.PI*58}`}
                  strokeDashoffset={`${2*Math.PI*58*(1-(countdown||0)/10)}`}
                  strokeLinecap="round"
                  style={{ transition:'stroke-dashoffset 0.9s linear, stroke 0.3s', transformOrigin:'65px 65px', transform:'rotate(-90deg)' }}/>
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                {emergency.offline
                  ? <div style={{ fontSize:14, fontWeight:900, color:'#22c55e', lineHeight:1.4, textAlign:'center' }}>SYSTEM<br/>OFFLINE</div>
                  : <>
                      <div style={{ fontSize:42, fontWeight:900, lineHeight:1, color: countdown<=3?'#ef4444':'#f59e0b', textShadow:`0 0 20px ${countdown<=3?'#ef444480':'#f59e0b80'}` }}>
                        {countdown ?? '!'}
                      </div>
                      <div style={{ fontSize:10, color:'#5a7099', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>seconds</div>
                    </>
                }
              </div>
            </div>

            {/* FAIR financial loss */}
            {emergency.ale && (
              <div style={{ padding:'12px 20px', borderRadius:12, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)', marginBottom:22, display:'inline-block', minWidth:220 }}>
                <div style={{ fontSize:10, color:'#5a7099', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:4 }}>Estimated Financial Exposure</div>
                <div style={{ fontSize:30, fontWeight:900, color:'#ef4444', textShadow:'0 0 20px rgba(239,68,68,0.5)' }}>{emergency.ale}</div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={resetEmergency} style={{
                padding:'12px 28px', borderRadius:12,
                background:'linear-gradient(135deg,#22c55e,#16a34a)',
                color:'#fff', border:0, fontWeight:800, fontSize:14, cursor:'pointer',
                boxShadow:'0 4px 20px rgba(34,197,94,0.4)',
              }}>
                ✅ Reset &amp; Resume
              </button>
              {sirenActive && (
                <button onClick={stopSiren} style={{
                  padding:'12px 28px', borderRadius:12,
                  background:'rgba(245,158,11,0.15)', color:'#f59e0b',
                  border:'1px solid rgba(245,158,11,0.4)', fontWeight:800, fontSize:14, cursor:'pointer',
                }}>
                  🔇 Mute Siren
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 99, padding: '4px 14px', fontSize: 11, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
          ● SIH26105 · Live Demo
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 12px', background: 'linear-gradient(135deg,#0ea5e9,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Cyber Risk Financial Engine
        </h1>
        <p style={{ fontSize: 15, color: '#a0b3d6', maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>
          Converts security telemetry into board-level ₹ exposure and determines the
          <strong style={{ color: '#e2eafc' }}> optimal budget allocation</strong> to maximise risk reduction per rupee.
        </p>
      </div>

      {/* ══════════════════════════════════════════════
          §0  WATCHDOG — AI Cyber Attack Monitor
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={ShieldCheck} color="#ef4444" title="AI Cyber Attack Watchdog" sub="Real-time AI monitoring — triggers siren + emergency shutdown on attack detection" />
      <Row2>
        {/* Controls */}
        <Card accent="#ef4444">
          {/* Header: title + live SirenLight */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6' }}>Watchdog Controls</div>
            <SirenLight active={sirenActive} size={36} />
          </div>
          <div style={{ padding:'12px 14px', borderRadius:10, marginBottom:14, display:'flex', alignItems:'center', gap:12,
            background: emergency ? 'rgba(239,68,68,0.1)' : watchdogOn ? 'rgba(34,197,94,0.07)' : 'rgba(56,100,180,0.06)',
            border: `1px solid ${emergency ? 'rgba(239,68,68,0.35)' : watchdogOn ? 'rgba(34,197,94,0.3)' : 'rgba(56,100,180,0.15)'}`,
          }}>
            <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0,
              background: emergency ? '#ef4444' : watchdogOn ? '#22c55e' : '#5a7099',
              boxShadow: watchdogOn ? `0 0 8px ${emergency?'#ef4444':'#22c55e'}` : 'none',
              animation: watchdogOn && !emergency ? 'sirenPulse 1.2s ease-in-out infinite' : 'none',
            }}/>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color: emergency?'#ef4444':watchdogOn?'#22c55e':'#5a7099' }}>
                {emergency ? '🚨 EMERGENCY — Attack Detected' : watchdogOn ? '● Active — Scanning every 4 seconds' : '○ Inactive'}
              </div>
              <div style={{ fontSize:11, color:'#5a7099', marginTop:2 }}>
                {emergency ? `Attack: ${emergency.attack?.replace(/_/g,' ')} · Confidence: ${Math.round((emergency.confidence||0)*100)}%` : watchdogOn ? 'AI polls live telemetry stream via RandomForest classifier' : 'Click Start to begin AI-powered threat scanning'}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
            {!watchdogOn && !emergency && (
              <button onClick={startWatchdog} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', border:0, borderRadius:10, padding:'11px 0', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                <Zap size={15}/> Activate Watchdog
              </button>
            )}
            {watchdogOn && !emergency && (<>
              <button onClick={stopWatchdog} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'11px 0', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                <RefreshCw size={14}/> Stop
              </button>
              <button onClick={()=>fetch(`${WD}/api/v1/watchdog/trigger-attack`,{method:'POST'})} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'linear-gradient(135deg,#7c3aed,#a78bfa)', color:'#fff', border:0, borderRadius:10, padding:'11px 0', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                ⚡ Trigger Demo Attack
              </button>
            </>)}
            {emergency && (
              <button onClick={resetEmergency} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:0, borderRadius:10, padding:'11px 0', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                <CheckCircle2 size={14}/> Reset &amp; Recover
              </button>
            )}
            {sirenActive && (
              <button onClick={stopSiren} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'11px 16px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                🔇 Mute
              </button>
            )}
          </div>

          {/* How it works */}
          {[
            ['🎯 AI Detection',   'RandomForest classifier analyses each telemetry event in real-time'],
            ['📡 Scan Interval',  'Polls live event stream every 4 seconds via SSE connection'],
            ['🚨 Attack Response','Triggers browser siren (Web Audio) + full-screen emergency overlay'],
            ['💀 Auto Shutdown',  '10-second countdown then server process exits with code 99'],
            ['🔄 Recovery',       '"Reset & Recover" clears emergency state and resumes operations'],
          ].map(([t,d])=>(
            <div key={t} style={{ display:'flex', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:12, flexShrink:0 }}>{t.split(' ')[0]}</span>
              <div>
                <span style={{ fontSize:12, fontWeight:700, color:'#e2eafc' }}>{t.split(' ').slice(1).join(' ')}</span>
                <span style={{ fontSize:11, color:'#5a7099' }}> — {d}</span>
              </div>
            </div>
          ))}
        </Card>

        {/* Live scan log */}
        <Card accent="#f97316">
          {/* Header row — title + live siren light */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6' }}>Live Scan Log</div>
              {watchdogOn && <SoundBars active={true} />}
            </div>
            <SirenLight active={sirenActive} size={40} />
          </div>

          {scanLog.length === 0 ? (
            <div style={{ padding:'32px', textAlign:'center', color:'#5a7099', fontSize:13 }}>
              {watchdogOn
                ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                    <SirenLight active={false} size={36} />
                    <span>⏳ Scanning… waiting for first result</span>
                  </div>
                : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                    <SirenLight active={false} size={36} />
                    <span>Activate watchdog to see real-time scan results here</span>
                  </div>
              }
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {scanLog.map((s,i) => {
                const isAtk = s.result === 'ATTACK';
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'9px 12px', borderRadius:10,
                    background: isAtk ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.05)',
                    border: `1px solid ${isAtk ? 'rgba(239,68,68,0.45)' : 'rgba(34,197,94,0.15)'}`,
                    animation: isAtk && i===0 ? 'scanFlash 1.2s ease-out 3' : 'none',
                    boxShadow: isAtk && i===0 ? '0 0 16px rgba(239,68,68,0.3)' : 'none',
                    transition:'border-color 0.3s, box-shadow 0.3s',
                  }}>
                    {/* Icon: spinning siren for attack, check for clean */}
                    {isAtk
                      ? <SirenLight active={i === 0} size={28} />
                      : <span style={{ fontSize:18, lineHeight:1 }}>✅</span>
                    }
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color: isAtk ? '#ef4444' : '#22c55e', display:'flex', alignItems:'center', gap:6 }}>
                        {isAtk ? '🚨 ATTACK' : 'CLEAN'}
                        {isAtk && s.attack && s.attack !== 'normal' &&
                          <span style={{ fontSize:11, color:'#f59e0b', fontWeight:600 }}>
                            — {s.attack.replace(/_/g,' ')}
                          </span>
                        }
                      </div>
                      <div style={{ fontSize:10, color:'#5a7099', marginTop:2 }}>
                        {new Date(s.ts).toLocaleTimeString('en-IN')}
                        &nbsp;·&nbsp;
                        conf {((s.conf||0)*100).toFixed(0)}%
                      </div>
                    </div>
                    {i === 0 && (
                      <span style={{
                        fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:700, whiteSpace:'nowrap',
                        background: isAtk ? 'rgba(239,68,68,0.2)' : 'rgba(14,165,233,0.12)',
                        color: isAtk ? '#ef4444' : '#22d3ee',
                        border: `1px solid ${isAtk ? 'rgba(239,68,68,0.4)' : 'rgba(14,165,233,0.25)'}`,
                      }}>
                        {isAtk ? '⚠️ ALERT' : 'LATEST'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Countdown display — big numbers with colour shift */}
          {countdown !== null && (
            <div style={{
              marginTop:14, padding:'16px', borderRadius:12,
              background: countdown<=3 ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${countdown<=3 ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.25)'}`,
              textAlign:'center', transition:'all 0.3s',
            }}>
              <div style={{ fontSize:11, color:'#5a7099', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:4 }}>Emergency Shutdown In</div>
              <div style={{
                fontSize:56, fontWeight:900, lineHeight:1,
                color: countdown<=3 ? '#ef4444' : '#f59e0b',
                textShadow: `0 0 20px ${countdown<=3 ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.4)'}`,
                transition:'color 0.3s, text-shadow 0.3s',
              }}>
                {countdown}
              </div>
              <div style={{ fontSize:11, color:'#5a7099', marginTop:2 }}>seconds</div>
            </div>
          )}
        </Card>
      </Row2>

      <Divider />

      {/* ══════════════════════════════════════════════
          §1  OVERVIEW KPIs + SHIELD
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={Activity} color="#0ea5e9" title="Live Risk Overview" sub="Key financial risk indicators updated in real time" />
      <Row2>
        {/* Shield + KPIs left */}
        <Card accent="#0ea5e9">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Shield3D score={dash.score} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Kpi label="Annual Exposure"  value={inrCr(dash.exposure)} color="#ef4444" />
              <Kpi label="Risk Reduction"   value={pct(rec.reduction)}   color="#22c55e" />
              <Kpi label="Model ROI"        value={rec.roi.toFixed(2) + '×'} color="#22d3ee" />
            </div>
          </div>
        </Card>
        {/* Right col — more KPIs */}
        <Card accent="#7c3aed">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Kpi label="Optimal Investment" value={inrL(rec.cost)}      color="#a78bfa" />
            <Kpi label="Loss Avoided"       value={inrL(rec.avoided)}   color="#22c55e" />
            <Kpi label="Residual Risk"      value={inrL(rec.residual)}  color="#f59e0b" />
            <Kpi label="Confidence"         value={pct(opt.confidence)} color="#22d3ee" />
          </div>
          <ProgBar label="Risk Reduction"     value={pct(rec.reduction)}  pct={Math.round(rec.reduction * 100)} color="#22c55e" />
          <ProgBar label="Budget Utilisation" value={Math.round(rec.cost / budget * 100) + '%'} pct={Math.min(100, Math.round(rec.cost / budget * 100))} color="#0ea5e9" />
          <ProgBar label="Data Quality"       value={Math.round(dash.dataQuality * 100) + '%'} pct={Math.round(dash.dataQuality * 100)} color="#a78bfa" />
        </Card>
      </Row2>

      {/* ── pipeline ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#5a7099', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12, fontWeight: 700 }}>Solution Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
          {PIPELINE.map(({ label, color, Icon }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, background: color + '12', border: `1px solid ${color}30`, minWidth: 90, textAlign: 'center' }}>
                <Icon size={15} color={color} />
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
              </div>
              {i < PIPELINE.length - 1 && (
                <div style={{ width: 24, height: 2, background: `linear-gradient(90deg,${color},${PIPELINE[i+1].color})`, position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', right: -1, top: -4, borderLeft: `6px solid ${PIPELINE[i+1].color}`, borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Row2>
        {/* Exposure pie */}
        <Card accent="#ef4444">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 10 }}>Financial Exposure Breakdown</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dash.parts} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3}>
                {dash.parts.map((_, i) => <Cell key={i} fill={['#ef4444','#f59e0b','#a78bfa','#22d3ee','#22c55e'][i]} />)}
              </Pie>
              <Tooltip formatter={inr} {...TT} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#a0b3d6' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Top risky assets bar */}
        <Card accent="#f59e0b">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 10 }}>Top 5 Risky Assets</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={assets.slice(0,5).map(a => ({ n: a.name.split(' ').slice(0,2).join(' '), r: +Math.min(10,(a.risk*(0.6+0.4*mult))).toFixed(1) }))} layout="vertical">
              <CartesianGrid strokeOpacity={0.07} horizontal={false} />
              <XAxis type="number" domain={[0,10]} tick={{ fill: '#5a7099', fontSize: 10 }} />
              <YAxis type="category" dataKey="n" width={110} tick={{ fill: '#a0b3d6', fontSize: 10 }} />
              <Tooltip {...TT} />
              <Bar dataKey="r" radius={[0,5,5,0]}>
                {assets.slice(0,5).map((_,i) => <Cell key={i} fill={['#ef4444','#f97316','#f59e0b','#eab308','#84cc16'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Row2>
      <Disc />

      <Divider />

      {/* ══════════════════════════════════════════════
          §2  PROBLEM & SOLUTION
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={AlertTriangle} color="#ef4444" title="Problem & Solution" sub="6 core gaps this platform closes" />

      {/* Quote */}
      <div style={{ textAlign: 'center', marginBottom: 20, padding: '18px 24px', borderRadius: 14, background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.18)' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#e2eafc', lineHeight: 1.8, margin: 0 }}>
          "Organizations don't know exactly <span style={{ color: '#ef4444' }}>how much their cyber risks could cost</span> or
          <span style={{ color: '#f59e0b' }}> where to invest</span> to achieve
          <span style={{ color: '#22c55e' }}> maximum risk reduction</span> within a limited budget."
        </p>
      </div>

      <Row2>
        {/* 6 problem boxes */}
        <Card accent="#ef4444">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 12 }}>Core Problems</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PROBLEMS.map(p => (
              <div key={p.title} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: p.color + '0c', border: `1px solid ${p.color}25` }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 2 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: '#a0b3d6', lineHeight: 1.5 }}>{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Before vs After */}
        <Card accent="#22c55e">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 12 }}>Before → After</div>
          {[
            ['Risk Expression',   'Low/Med/High',          '₹ Quantified loss',      '#ef4444','#22c55e'],
            ['Update Cycle',      'Quarterly',             'Continuous real-time',   '#f59e0b','#22c55e'],
            ['Data Integration',  'Siloed tools',          'Unified pipeline',       '#f59e0b','#22c55e'],
            ['Business Linkage',  'CVEs only',             'Revenue + downtime',     '#ef4444','#22c55e'],
            ['Budget Allocation', 'Gut feeling',           'AI LP optimisation',     '#ef4444','#22c55e'],
            ['Executive Report',  'Technical jargon',      'Financial ROI',          '#f59e0b','#22c55e'],
          ].map(([d, b, a, cb, ca]) => (
            <div key={d} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}>
              <span style={{ fontSize: 11, color: '#5a7099', width: 110, flexShrink: 0 }}>{d}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: cb + '18', color: cb, border: `1px solid ${cb}30`, flex: 1, textAlign: 'center' }}>✗ {b}</span>
              <ArrowRight size={12} color="#5a7099" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: ca + '18', color: ca, border: `1px solid ${ca}30`, flex: 1, textAlign: 'center' }}>✓ {a}</span>
            </div>
          ))}
        </Card>
      </Row2>

      <Divider />

      {/* ══════════════════════════════════════════════
          §3  ASSET INVENTORY
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={Database} color="#22d3ee" title="Asset Inventory" sub={`${assets.length} monitored assets · ${assets.filter(a=>a.crit==='Critical').length} critical`} />
      <Row2>
        {/* Summary bars */}
        <Card accent="#22d3ee">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 12 }}>Risk by Criticality</div>
          {Object.entries(CRIT_COLOR).map(([k, c]) => {
            const cnt = assets.filter(a => a.crit === k).length;
            return <ProgBar key={k} label={k} value={`${cnt} assets`} pct={Math.round(cnt / assets.length * 100)} color={c} />;
          })}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Kpi label="Portfolio Value" value={inrCr(assets.reduce((s,a)=>s+a.value,0))} color="#22d3ee" />
              <Kpi label="Total CVEs"      value={assets.reduce((s,a)=>s+a.cves,0)}          color="#f59e0b" />
            </div>
          </div>
        </Card>

        {/* Patch status breakdown */}
        <Card accent="#a78bfa">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 10 }}>Patch Status & Top CVEs</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={[
              { s:'Unpatched', n: assets.filter(a=>a.patchStatus==='Unpatched').length, fill:'#ef4444' },
              { s:'Partial',   n: assets.filter(a=>a.patchStatus==='Partial').length,   fill:'#f59e0b' },
              { s:'Patched',   n: assets.filter(a=>a.patchStatus==='Patched').length,   fill:'#22c55e' },
              { s:'Mixed',     n: assets.filter(a=>a.patchStatus==='Mixed').length,     fill:'#a78bfa' },
            ]}>
              <CartesianGrid strokeOpacity={0.07} vertical={false}/>
              <XAxis dataKey="s" tick={{ fill:'#a0b3d6', fontSize:11 }}/>
              <YAxis tick={{ fill:'#5a7099', fontSize:10 }}/>
              <Tooltip {...TT}/>
              <Bar dataKey="n" radius={[6,6,0,0]}>
                {['#ef4444','#f59e0b','#22c55e','#a78bfa'].map((c,i)=><Cell key={i} fill={c}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 10 }}>
            {assets.filter(a => a.cvss >= 7.5).slice(0,4).map(a => (
              <div key={a.name} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'5px 0', borderBottom:'1px solid rgba(56,100,180,0.12)' }}>
                <span style={{ color:'#a0b3d6' }}>{a.name}</span>
                <span style={{ color: a.cvss >= 9 ? '#ef4444' : '#f59e0b', fontWeight:700 }}>CVSS {a.cvss}</span>
              </div>
            ))}
          </div>
        </Card>
      </Row2>
      <Disc />

      <Divider />

      {/* ══════════════════════════════════════════════
          §4  BUSINESS IMPACT
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={Network} color="#f59e0b" title="Business Impact Simulation" sub="Simulate a Payment API compromise and track blast radius" />
      <Row2>
        <Card accent="#ef4444">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 12 }}>Attack Controls</div>
          <button onClick={() => runAttack(1)} disabled={simGo} style={{ display:'flex', alignItems:'center', gap:7, background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', border:0, borderRadius:10, padding:'9px 18px', fontWeight:700, fontSize:13, cursor:'pointer', marginBottom:8, opacity: simGo?0.5:1 }}>
            <Zap size={14}/> {simGo ? 'Simulating…' : 'Launch Attack Simulation'}
          </button>
          <button onClick={() => runAttack(0)} disabled={simGo} style={{ display:'flex', alignItems:'center', gap:7, background:'transparent', color:'#a0b3d6', border:'1px solid rgba(56,100,180,0.3)', borderRadius:10, padding:'9px 18px', fontWeight:600, fontSize:13, cursor:'pointer', marginBottom:14 }}>
            <RefreshCw size={13}/> Reset
          </button>
          {sim && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <Kpi label="Services Affected"   value={sim.affected}                                 color={sim.affected > 2 ? '#ef4444' : '#f59e0b'} />
              <Kpi label="Revenue at Risk"     value={inrL(sim.exposure)}                           color="#ef4444" />
              <Kpi label="Downtime"            value={sim.downtimeHrs + ' hrs'}                    color="#f59e0b" />
              <Kpi label="Customers Impacted"  value={sim.customerImpact.toLocaleString('en-IN')}  color="#ef4444" />
            </div>
          )}
        </Card>

        <Card accent="#f59e0b">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a0b3d6', marginBottom: 10 }}>Blast Radius Chain</div>
          {sim && (
            <>
              <div style={{ display:'flex', alignItems:'center', overflowX:'auto', paddingBottom:8, gap:0 }}>
                {sim.nodes.map((n, i) => (
                  <div key={n.id} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
                    <div style={{
                      padding:'8px 10px', borderRadius:9, textAlign:'center', minWidth:80,
                      border: `2px solid ${n.state==='compromised'?'#ef4444':n.state==='critical'?'#f97316':n.state==='atrisk'?'#f59e0b':'#22c55e'}`,
                      background: n.state==='compromised'?'rgba(239,68,68,0.1)':n.state==='critical'?'rgba(249,115,22,0.1)':n.state==='atrisk'?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.05)',
                      transition:'all 0.4s'
                    }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#e2eafc' }}>{n.label}</div>
                      <div style={{ fontSize:9, textTransform:'uppercase', marginTop:2, color: n.state==='compromised'?'#ef4444':n.state==='critical'?'#f97316':n.state==='atrisk'?'#f59e0b':'#22c55e' }}>{n.state}</div>
                      {n.exposure > 0 && <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginTop:2 }}>{inrL(n.exposure)}</div>}
                    </div>
                    {i < sim.nodes.length-1 && <div style={{ width:16, height:2, background:'rgba(56,100,180,0.3)', flexShrink:0 }}/>}
                  </div>
                ))}
              </div>
              {/* breach timeline */}
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:11, color:'#5a7099', marginBottom:6 }}>Breach Loss Timeline</div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={[{h:0,l:0},{h:1,l:80000},{h:3,l:400000},{h:6,l:900000},{h:12,l:1400000},{h:24,l:1800000},{h:48,l:2050000}]}>
                    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ef4444" stopOpacity={0.3}/><stop offset="1" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="h" tick={{ fill:'#5a7099', fontSize:10 }} label={{ value:'Hours', position:'insideBottom', offset:-2, fill:'#5a7099', fontSize:10 }}/>
                    <YAxis tickFormatter={v=>inrL(v)} tick={{ fill:'#5a7099', fontSize:9 }}/>
                    <Tooltip formatter={inr} {...TT}/>
                    <Area type="monotone" dataKey="l" stroke="#ef4444" fill="url(#ag)" strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      </Row2>
      <Disc />

      <Divider />

      {/* ══════════════════════════════════════════════
          §5  INVESTMENT OPTIMIZER
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={Calculator} color="#22c55e" title="Investment Optimizer" sub="AI picks the control portfolio that maximises risk reduction per ₹" />
      <Row2>
        <Card accent="#22c55e">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:12 }}>Configure & Run</div>
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
              <span style={{ color:'#a0b3d6' }}>Budget</span><span style={{ color:'#22c55e', fontWeight:800 }}>{inrCr(budget)}</span>
            </div>
            <input type="range" min={100000} max={5000000} step={50000} value={budget} onChange={e=>{setBudget(+e.target.value)}} style={{ width:'100%', accentColor:'#22c55e' }}/>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
              <span style={{ color:'#a0b3d6' }}>Threat Multiplier</span><span style={{ color:'#f59e0b', fontWeight:800 }}>{mult.toFixed(2)}×</span>
            </div>
            <input type="range" min={0.5} max={2} step={0.05} value={mult} onChange={e=>setMult(+e.target.value)} style={{ width:'100%', accentColor:'#f59e0b' }}/>
          </div>
          <button onClick={runOpt} disabled={!!busy} style={{ display:'flex', alignItems:'center', gap:7, background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#04120a', border:0, borderRadius:10, padding:'9px 18px', fontWeight:800, fontSize:13, cursor:'pointer', marginBottom:10, opacity:busy?0.6:1 }}>
            <BrainCircuit size={14}/> {busy || 'Run AI Optimization'}
          </button>
          {busy && <div style={{ fontSize:12, color:'#22d3ee', padding:'6px 10px', borderRadius:8, background:'rgba(14,165,233,0.08)' }}>⚡ {busy}</div>}
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:11, color:'#5a7099', marginBottom:6 }}>Recommended Controls</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {rec.controls.map(c => (
                <span key={c} style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                  <CheckCircle2 size={10}/>{c}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card accent="#a78bfa">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>Pareto Frontier</div>
          <div style={{ fontSize:10, color:'#5a7099', marginBottom:8 }}>
            <span style={{ color:'#22d3ee' }}>●</span> Pareto-optimal &nbsp; <span style={{ color:'#a78bfa' }}>●</span> Recommended &nbsp; <span style={{ color:'#2a3a5a' }}>●</span> Sub-optimal
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <ScatterChart margin={{ bottom:16 }}>
              <CartesianGrid strokeOpacity={0.07}/>
              <XAxis type="number" dataKey="cost"     name="Investment" tickFormatter={v=>inrL(v)} tick={{ fill:'#5a7099', fontSize:9 }} label={{ value:'Investment →', fill:'#5a7099', fontSize:9, position:'insideBottom', offset:-8 }}/>
              <YAxis type="number" dataKey="residual" name="Residual"   tickFormatter={v=>inrL(v)} tick={{ fill:'#5a7099', fontSize:9 }}/>
              <Tooltip formatter={(v,n)=>['Investment','Residual'].includes(n)?inr(v):v} {...TT}/>
              <Scatter data={opt.frontier.filter(p=>!p.pareto)} fill="#2a3a5a"/>
              <Scatter data={opt.frontier.filter(p=>p.pareto)}  fill="#22d3ee"/>
              <Scatter data={[rec]} fill="#a78bfa" shape="star"/>
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
            <Kpi label="Reduction"   value={pct(rec.reduction)} color="#22c55e" />
            <Kpi label="ROI"         value={rec.roi.toFixed(2)+'×'} color="#22d3ee" />
          </div>
        </Card>
      </Row2>
      <Disc />

      <Divider />

      {/* ══════════════════════════════════════════════
          §6  WHAT-IF SIMULATOR
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={SlidersHorizontal} color="#f97316" title="What-If Simulator" sub="Apply threat scenarios and see metrics recalculate instantly" />
      <Row2>
        <Card accent="#f97316">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>Scenario Presets</div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {Object.entries(SCENARIOS).map(([name, m]) => (
              <button key={name} onClick={() => { setMult(m); commit('Scenario', { name, mult: m }); }}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background: Math.abs(mult-m)<0.01 ? 'rgba(249,115,22,0.12)':'transparent', border:`1px solid ${Math.abs(mult-m)<0.01?'rgba(249,115,22,0.4)':'rgba(56,100,180,0.2)'}`, borderRadius:9, padding:'9px 14px', cursor:'pointer', color:'#e2eafc', fontSize:12, fontWeight:600 }}>
                <span>{name}</span>
                <span style={{ color:'#f97316', fontSize:11 }}>{m}× threat</span>
              </button>
            ))}
          </div>
        </Card>

        <Card accent="#ec4899">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>Live Metrics at {mult.toFixed(2)}× Threat</div>

          {/* ── Manual sliders ── */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
              <span style={{ color:'#a0b3d6', fontWeight:600 }}>Threat Multiplier</span>
              <span style={{ color: mult>=1.5?'#ef4444':mult>=1.2?'#f59e0b':'#22c55e', fontWeight:800, fontSize:14 }}>{mult.toFixed(2)}×</span>
            </div>
            <input type="range" min={0.5} max={2} step={0.05} value={mult}
              onChange={e => { setMult(+e.target.value); commit('What-If', { mult: +e.target.value, budget }); }}
              style={{ width:'100%', accentColor:'#f97316' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#5a7099', marginTop:2 }}>
              <span>0.5× Low</span><span>2.0× Extreme</span>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
              <span style={{ color:'#a0b3d6', fontWeight:600 }}>Budget</span>
              <span style={{ color:'#a78bfa', fontWeight:800, fontSize:14 }}>{inrCr(budget)}</span>
            </div>
            <input type="range" min={100000} max={5000000} step={50000} value={budget}
              onChange={e => { setBudget(+e.target.value); commit('What-If', { mult, budget: +e.target.value }); }}
              style={{ width:'100%', accentColor:'#a78bfa' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#5a7099', marginTop:2 }}>
              <span>₹1L</span><span>₹50L</span>
            </div>
          </div>

          {/* Threat level badge */}
          <div style={{ padding:'10px 14px', borderRadius:10, background: mult>=1.5?'rgba(239,68,68,0.08)':mult>=1.2?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${mult>=1.5?'rgba(239,68,68,0.25)':mult>=1.2?'rgba(245,158,11,0.25)':'rgba(34,197,94,0.25)'}`, marginBottom:12, textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:900, color: mult>=1.5?'#ef4444':mult>=1.2?'#f59e0b':'#22c55e' }}>
              {mult<=0.9?'🟢 LOW':mult<=1.1?'🟡 MODERATE':mult<=1.39?'🟠 ELEVATED':'🔴 CRITICAL'}
            </div>
          </div>

          {/* Live recalculated KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <Kpi label="Risk Score"    value={dash.score+'/100'}      color={dash.score>70?'#ef4444':'#f59e0b'} />
            <Kpi label="Annual Loss"   value={inrCr(dash.exposure)}   color="#ef4444" />
            <Kpi label="Recommended"   value={inrL(rec.cost)}         color="#a78bfa" />
            <Kpi label="Reduction"     value={pct(rec.reduction)}     color="#22c55e" />
            <Kpi label="Residual Risk" value={inrL(rec.residual)}     color="#f59e0b" />
            <Kpi label="ROI"           value={rec.roi.toFixed(2)+'×'} color="#22d3ee" />
          </div>

          {/* Recommended controls for this scenario */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#5a7099', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.6px' }}>Recommended Controls</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {rec.controls.length > 0
                ? rec.controls.map(c => (
                    <span key={c} style={{ fontSize:11, padding:'3px 9px', borderRadius:99, background:'rgba(14,165,233,0.08)', border:'1px solid rgba(14,165,233,0.2)', color:'#0ea5e9', fontWeight:600 }}>{c}</span>
                  ))
                : <span style={{ fontSize:11, color:'#5a7099' }}>No controls affordable at this budget</span>
              }
            </div>
          </div>

          {/* scenario comparison bar chart */}
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:11, color:'#5a7099', marginBottom:6 }}>All Scenario Exposures</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={Object.entries(SCENARIOS).map(([name,m])=>({ name:name.split(' ')[0], exp:+(1800000*m/1e5).toFixed(1), active: Math.abs(mult-m)<0.01 }))} margin={{ bottom:14 }}>
                <CartesianGrid strokeOpacity={0.07} vertical={false}/>
                <XAxis dataKey="name" tick={{ fill:'#a0b3d6', fontSize:9 }} angle={-20} textAnchor="end" interval={0}/>
                <YAxis tick={{ fill:'#5a7099', fontSize:9 }} tickFormatter={v=>v+'L'}/>
                <Tooltip formatter={v=>inrL(v*1e5)} {...TT}/>
                <Bar dataKey="exp" radius={[4,4,0,0]}>
                  {Object.entries(SCENARIOS).map(([name,m],i)=>(
                    <Cell key={i} fill={Math.abs(mult-m)<0.01 ? '#f97316' : ['#ef4444','#f97316','#f59e0b','#a78bfa','#22d3ee','#22c55e'][i]} opacity={Math.abs(mult-m)<0.01 ? 1 : 0.55}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Row2>
      <Disc />

      <Divider />

      {/* ══════════════════════════════════════════════
          §6.5  AI ANALYSIS — Real ML on CSV Dataset
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={BrainCircuit} color="#a78bfa" title="AI Analysis Engine" sub={aiStatus ? `RandomForest · ${(aiStatus.rf_accuracy*100).toFixed(1)}% accuracy · ${(aiStatus.n_samples||0).toLocaleString()} training events` : 'Connect AI service to enable real ML predictions'} />
      <Row2>
        {/* AI Service Status + Run button */}
        <Card accent="#a78bfa">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:12 }}>AI Service Status</div>
          {/* status row */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            {[
              { label:'ML Model',        val: aiStatus ? 'RandomForest (200 trees)' : 'Offline', ok: !!aiStatus },
              { label:'Anomaly Detector',val: aiStatus ? 'Isolation Forest (200 est.)' : 'Offline', ok: !!aiStatus },
              { label:'Training Data',   val: aiStatus ? `${(aiStatus.n_samples||25000).toLocaleString()} events` : '—', ok: !!aiStatus },
              { label:'Accuracy',        val: aiStatus ? `${(aiStatus.rf_accuracy*100).toFixed(1)}%` : '—', ok: !!aiStatus },
              { label:'OpenAI Narrative',val: aiStatus?.openai_enabled ? 'GPT-4o-mini' : 'Rule-based fallback', ok: !!aiStatus?.openai_enabled },
              { label:'Dataset Classes', val: aiStatus ? aiStatus.attack_classes?.join(', ') : '—', ok: !!aiStatus },
            ].map(({ label, val, ok }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:8, background:'rgba(10,18,38,0.5)', border:'1px solid rgba(56,100,180,0.15)' }}>
                <span style={{ fontSize:11, color:'#a0b3d6' }}>{label}</span>
                <span style={{ fontSize:11, fontWeight:700, color: ok ? '#22c55e' : '#5a7099' }}>{val}</span>
              </div>
            ))}
          </div>
          {!aiStatus && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', fontSize:12, color:'#f59e0b', marginBottom:12 }}>
              ⚠️ Start the AI service: <code style={{ background:'rgba(14,165,233,0.1)', padding:'1px 6px', borderRadius:4, color:'#22d3ee' }}>cd ai_service && pip install -r requirements.txt && python app.py</code>
            </div>
          )}
          <button onClick={runAiAnalysis} disabled={aiAnalyzing || !aiStatus}
            style={{ display:'flex', alignItems:'center', gap:7, background: aiStatus ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : 'rgba(56,100,180,0.15)', color: aiStatus ? '#fff':'#5a7099', border:0, borderRadius:10, padding:'10px 18px', fontWeight:800, fontSize:13, cursor: aiStatus ? 'pointer':'not-allowed', width:'100%', justifyContent:'center', opacity: aiAnalyzing ? 0.7:1 }}>
            <Sparkles size={15}/> {aiAnalyzing ? 'Running AI Analysis…' : 'Run Full AI Analysis'}
          </button>
        </Card>

        {/* Attack distribution from real dataset */}
        <Card accent="#22d3ee">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>
            Real Dataset — Attack Distribution
            {aiStats && <span style={{ fontSize:10, color:'#5a7099', marginLeft:8 }}>({(aiStats.total_events||0).toLocaleString()} events)</span>}
          </div>
          {aiDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={aiDist.map(d => ({ name: d.name.replace('_',' '), count: d.count, risk: +d.avg_risk.toFixed(1) }))} margin={{ bottom:20 }}>
                <CartesianGrid strokeOpacity={0.07} vertical={false}/>
                <XAxis dataKey="name" tick={{ fill:'#a0b3d6', fontSize:10 }} angle={-15} textAnchor="end" interval={0}/>
                <YAxis yAxisId="left"  tick={{ fill:'#5a7099', fontSize:10 }}/>
                <YAxis yAxisId="right" orientation="right" tick={{ fill:'#5a7099', fontSize:10 }} domain={[0,100]}/>
                <Tooltip contentStyle={{ background:'#0d1730', border:'1px solid rgba(56,100,180,0.3)', borderRadius:10, fontSize:12 }}/>
                <Legend wrapperStyle={{ fontSize:11, color:'#a0b3d6' }}/>
                <Bar yAxisId="left"  dataKey="count" name="Event Count" fill="#22d3ee" radius={[4,4,0,0]}/>
                <Bar yAxisId="right" dataKey="risk"  name="Avg Risk Score" fill="#ef4444" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#5a7099', fontSize:13 }}>
              {aiStatus ? 'Loading…' : 'AI service offline — start it to see real data'}
            </div>
          )}
        </Card>
      </Row2>

      {/* AI Analysis Result */}
      {aiAnalysis && (
        <Row2>
          {/* Prediction + FAIR */}
          <Card accent="#ef4444">
            <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:6 }}>ML Prediction Result</div>
            {/* Source event badge — shows which real dataset event was analysed */}
            {aiAnalysis._source?._source_event_id && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'6px 10px', borderRadius:8, background:'rgba(14,165,233,0.07)', border:'1px solid rgba(14,165,233,0.2)' }}>
                <span style={{ fontSize:10, color:'#5a7099', textTransform:'uppercase', letterSpacing:'0.6px' }}>Real Dataset Event</span>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#22d3ee', fontWeight:700 }}>{aiAnalysis._source._source_event_id}</span>
                <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', fontWeight:700 }}>
                  {aiAnalysis._source._source_attack_type?.replace(/_/g,' ')}
                </span>
                <span style={{ fontSize:10, color:'#f59e0b', fontWeight:700 }}>Risk {aiAnalysis._source._source_risk_score?.toFixed(1)}</span>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
              <Kpi label="Predicted Attack"    value={aiAnalysis.prediction?.predicted_attack?.replace('_',' ') || '—'} color={aiAnalysis.prediction?.is_threat ? '#ef4444':'#22c55e'} />
              <Kpi label="Confidence"          value={aiAnalysis.prediction?.confidence ? pct(aiAnalysis.prediction.confidence):'—'} color="#a78bfa" />
              <Kpi label="Recommended Action"  value={aiAnalysis.prediction?.recommended_action?.replace('_',' ') || '—'} color="#f59e0b" />
              <Kpi label="Anomaly"             value={aiAnalysis.anomaly?.is_anomaly ? '⚠️ Detected':'✅ Clean'} color={aiAnalysis.anomaly?.is_anomaly ? '#ef4444':'#22c55e'} />
            </div>
            {/* FAIR Loss */}
            {aiAnalysis.fair && (
              <div style={{ padding:'12px', borderRadius:10, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', marginBottom:10 }}>
                <div style={{ fontSize:11, color:'#5a7099', marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px' }}>FAIR Financial Loss Estimate</div>
                <div style={{ fontSize:22, fontWeight:900, color:'#ef4444' }}>{aiAnalysis.fair.ale_display || '₹0'}</div>
                <div style={{ fontSize:11, color:'#a0b3d6', marginTop:4 }}>Annualised Loss Expectancy</div>
                <div style={{ display:'flex', gap:10, marginTop:10 }}>
                  {[
                    ['Direct Loss',   aiAnalysis.fair.breakdown?.direct_loss,       '#ef4444'],
                    ['Regulatory',    aiAnalysis.fair.breakdown?.regulatory_fines,  '#a78bfa'],
                    ['Reputational',  aiAnalysis.fair.breakdown?.reputational_cost, '#f59e0b'],
                  ].map(([l,v,c]) => v != null && (
                    <div key={l} style={{ flex:1, textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#5a7099' }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:c }}>₹{Math.round(v).toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Top predictions */}
            {aiAnalysis.prediction?.top_predictions?.map(p => (
              <ProgBar key={p.attack} label={p.attack.replace('_',' ')} value={`${(p.probability*100).toFixed(1)}%`} pct={Math.round(p.probability*100)} color={p.attack==='normal'?'#22c55e':'#ef4444'} />
            ))}
          </Card>

          {/* GPT Narrative + Feature Importance */}
          <Card accent="#22c55e">
            <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>AI Risk Narrative</div>
            {aiNarrative ? (
              <div style={{ padding:'14px', borderRadius:10, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', fontSize:13, color:'#e2eafc', lineHeight:1.8, marginBottom:14 }}>
                <Sparkles size={13} color="#a78bfa" style={{ marginRight:6 }}/>{aiNarrative}
              </div>
            ) : (
              <div style={{ padding:'14px', borderRadius:10, background:'rgba(56,100,180,0.05)', border:'1px solid rgba(56,100,180,0.12)', fontSize:12, color:'#5a7099', marginBottom:14 }}>
                Run AI Analysis to see GPT-generated risk narrative here.
              </div>
            )}
            <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:8 }}>Top Feature Importances (RF Model)</div>
            {aiFeat.slice(0,6).map((f,i) => (
              <ProgBar key={f.feature} label={f.feature.replace('_',' ')} value={`${(f.importance*100).toFixed(2)}%`} pct={Math.round(f.importance*100*15)} color={['#22d3ee','#a78bfa','#22c55e','#f59e0b','#ef4444','#ec4899'][i%6]} />
            ))}
          </Card>
        </Row2>
      )}

      {/* Top Threats from real dataset */}
      {aiTopThreats.length > 0 && (
        <Card accent="#f97316">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>
            <TrendingUp size={13} style={{ marginRight:6 }} color="#f97316"/>Top 10 Riskiest Events — Real Dataset
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'rgba(249,115,22,0.06)', borderBottom:'1px solid rgba(249,115,22,0.2)' }}>
                  {['Event ID','Attack Type','Risk Score','Action','Amount','Channel','IP Rep','Sensitivity'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', color:'#5a7099', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiTopThreats.map((t,i) => (
                  <tr key={t.event_id} style={{ borderBottom:'1px solid rgba(56,100,180,0.1)' }}>
                    <td style={{ padding:'7px 10px', fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#22d3ee' }}>{t.event_id}</td>
                    <td style={{ padding:'7px 10px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700, background: t.attack_type==='normal'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', color: t.attack_type==='normal'?'#22c55e':'#ef4444', border:`1px solid ${t.attack_type==='normal'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}` }}>
                        {t.attack_type.replace('_',' ')}
                      </span>
                    </td>
                    <td style={{ padding:'7px 10px', fontWeight:700, color: t.risk_score>=80?'#ef4444':t.risk_score>=60?'#f59e0b':'#22c55e' }}>{t.risk_score?.toFixed(1)}</td>
                    <td style={{ padding:'7px 10px', fontSize:10, color:'#a0b3d6' }}>{t.recommended_action?.replace('_',' ')}</td>
                    <td style={{ padding:'7px 10px', color:'#e2eafc' }}>₹{Math.round(t.transaction_amount||0).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'7px 10px', color:'#a0b3d6', fontSize:10 }}>{t.channel}</td>
                    <td style={{ padding:'7px 10px' }}>
                      <span style={{ padding:'2px 7px', borderRadius:99, fontSize:10, fontWeight:700, background: t.ip_reputation==='malicious'?'rgba(239,68,68,0.12)':t.ip_reputation==='suspicious'?'rgba(245,158,11,0.12)':'rgba(34,197,94,0.08)', color: t.ip_reputation==='malicious'?'#ef4444':t.ip_reputation==='suspicious'?'#f59e0b':'#22c55e' }}>
                        {t.ip_reputation}
                      </span>
                    </td>
                    <td style={{ padding:'7px 10px', fontSize:10, color:'#a0b3d6' }}>{t.data_sensitivity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dataset KPIs */}
      {aiStats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:18 }}>
          <Kpi label="Total Events"       value={(aiStats.total_events||0).toLocaleString()}       color="#22d3ee" />
          <Kpi label="Fraud Rate"         value={pct(aiStats.fraud_rate||0)}                        color="#ef4444" />
          <Kpi label="Avg Risk Score"     value={(aiStats.avg_risk_score||0).toFixed(1)+'/100'}     color="#f59e0b" />
          <Kpi label="Avg Fraud Txn"      value={'₹'+(aiStats.avg_fraud_txn_inr||0).toFixed(0)}    color="#a78bfa" />
          <Kpi label="Attack Types"       value={Object.keys(aiStats.attack_distribution||{}).length} color="#22c55e" />
        </div>
      )}

      <Divider />

      {/* ══════════════════════════════════════════════
          §7  BLOCKCHAIN AUDIT
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={ShieldCheck} color="#22d3ee" title="Blockchain Audit Trail" sub="Every calculation hashed with SHA-256 · tamper-evident chain" />
      <Row2>
        <Card accent="#22d3ee">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>How It Works</div>
          {[
            ['SHA-256 Hashing',    'Every event hashed — no raw enterprise data stored.'],
            ['Chain Linking',      'Each block contains the previous block\'s hash.'],
            ['Permissioned Ledger','Simulates Hyperledger Fabric — authorised writes only.'],
            ['Immutable Append',   'No block can be edited without breaking the chain.'],
          ].map(([t,d]) => (
            <div key={t} style={{ display:'flex', gap:9, marginBottom:10 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#22d3ee', marginTop:5, flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:2 }}>{t}</div>
                <div style={{ fontSize:11, color:'#a0b3d6' }}>{d}</div>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <Kpi label="Blocks" value={ledger.length} />
            <Kpi label="Verified" value={Object.values(ver).filter(Boolean).length} color="#22c55e" />
          </div>
        </Card>

        <Card accent="#a78bfa">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>Recent Blocks</div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {ledger.slice(0,6).map(b => (
              <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:9, background:'rgba(10,18,38,0.6)', border:'1px solid rgba(56,100,180,0.15)' }}>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#22d3ee', width:70, flexShrink:0 }}>{b.id}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:600 }}>{b.event}</div>
                  <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'#5a7099', marginTop:1 }}>{b.hash.slice(0,24)}…</div>
                </div>
                {ver[b.id]
                  ? <span style={{ fontSize:10, color:'#22c55e', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}><CheckCircle2 size={11}/>OK</span>
                  : <button onClick={async()=>{ await new Promise(r=>setTimeout(r,400)); const v=await api('audit/verify/'+b.id); setVer(x=>({...x,[b.id]:v.verified})); }}
                      style={{ fontSize:10, padding:'3px 9px', borderRadius:6, background:'transparent', border:'1px solid rgba(56,100,180,0.3)', color:'#a0b3d6', cursor:'pointer' }}>
                      Verify
                    </button>
                }
              </div>
            ))}
          </div>
        </Card>
      </Row2>

      <Divider />

      {/* ══════════════════════════════════════════════
          §8  TECH STACK + SOURCES
      ══════════════════════════════════════════════ */}
      <SectionTitle icon={BookOpen} color="#a78bfa" title="Technology & Sources" sub="Stack, 3D architecture, and all references" />
      <Row2>
        {/* 3D layer stack + tech pills */}
        <Card accent="#a78bfa">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>3D Architecture Stack</div>
          <LayerStack />
          <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:6 }}>
            {TECH.map(([name, color]) => (
              <span key={name} style={{ fontSize:11, padding:'3px 11px', borderRadius:99, background:color+'14', border:`1px solid ${color}30`, color, fontWeight:600 }}>{name}</span>
            ))}
          </div>
        </Card>

        {/* Sources */}
        <Card accent="#22d3ee">
          <div style={{ fontSize:12, fontWeight:700, color:'#a0b3d6', marginBottom:10 }}>References & Data Sources</div>
          {SOURCES.map(s => (
            <div key={s.name} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 0', borderBottom:'1px solid rgba(56,100,180,0.1)' }}>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:'rgba(14,165,233,0.1)', border:'1px solid rgba(14,165,233,0.25)', color:'#22d3ee', fontWeight:700, flexShrink:0 }}>{s.type}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'#a0b3d6', textDecoration:'none' }}
                onMouseEnter={e=>e.target.style.color='#22d3ee'} onMouseLeave={e=>e.target.style.color='#a0b3d6'}>
                {s.name}
              </a>
            </div>
          ))}
          <div style={{ marginTop:14, padding:'12px 14px', borderRadius:10, background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>Risk Model: FAIR-inspired</div>
            <div style={{ fontSize:11, color:'#a0b3d6', lineHeight:1.6 }}>
              Factor Analysis of Information Risk · Monte Carlo loss distributions ·
              Integer LP over 256 control portfolios (2^8) · SHA-256 chain audit.
            </div>
          </div>
        </Card>
      </Row2>

      {/* ── FOOTER ── */}
      <div style={{ textAlign:'center', marginTop:48, paddingTop:28, borderTop:'1px solid rgba(56,100,180,0.15)', color:'#5a7099', fontSize:12 }}>
        <div style={{ fontWeight:700, color:'#a0b3d6', marginBottom:6 }}>SIH26105 · Cyber Risk Financial Decision Engine</div>
        <div>Simulated demo data only · No real enterprise data used or stored</div>
        <div style={{ marginTop:8 }}>Model: <span style={{ color:'#22d3ee', fontFamily:'JetBrains Mono,monospace' }}>rq-0.3.1-demo</span> · Confidence: 82% · Range: {inrCr(opt.range[0])} – {inrCr(opt.range[1])}</div>
      </div>

    </div>
  );
}

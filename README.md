# SIH26105 — Cyber Risk Financial Decision Engine

> Converts security telemetry into board-level ₹ exposure and determines the optimal security budget allocation using real ML models trained on the Cybersecurity Hackathon Dataset.

---

## Architecture

```
Browser (port 3000)
    │
    ├── /api/v1/*  ──► Node.js Risk Engine  (port 4000)
    │                       │
    │                       └── /api/v1/ai/* ──► Python AI Microservice (port 5000)
    │                                                 │
    └── /api/ai/* ──────────────────────────────────►─┘
                                                      │
                                               Cybersecurity Hackathon Dataset.csv
                                               (25,000 labeled banking events)
```

### Services

| Service | Port | Tech | Purpose |
|---------|------|------|---------|
| Next.js Frontend | 3000 | React 18, Recharts, Lucide | Single-page dashboard |
| Node.js API | 4000 | Express, crypto, dotenv | Risk engine, ledger, portfolio optimizer |
| Python AI Service | 5000 | Flask, scikit-learn, OpenAI | ML predictions, FAIR loss, narratives |

---

## Quick Start

### Prerequisites
- Node.js 18+ — https://nodejs.org
- Python 3.10+ — https://python.org

### One-command start (PowerShell)
```powershell
cd sih26105\sih26105
.\start.ps1
```

### Manual start (3 terminals)

**Terminal 1 — AI Service**
```bash
cd sih26105/sih26105/ai_service
pip install -r requirements.txt
python app.py
```
> ⏱ First run trains the model (~30–60 sec). Subsequent starts use the cached model (~5 sec).

**Terminal 2 — Node API**
```bash
cd sih26105/sih26105/server
npm install
npm start
```

**Terminal 3 — Frontend**
```bash
cd sih26105/sih26105/web
npm install
npm run dev
```

Open **http://localhost:3000**

---

## API Keys

Copy `server/.env` and fill in:

```env
OPENAI_API_KEY=sk-...        # GPT-4o-mini for AI narratives
                              # (optional — falls back to rule-based if missing)
```

Get a key at https://platform.openai.com/api-keys

---

## AI Model Details

| Component | Algorithm | Purpose |
|-----------|-----------|---------|
| Attack Classifier | RandomForest (200 trees, balanced) | Classifies events: normal / payment_fraud / account_takeover / credential_stuffing / api_abuse / insider_data_exfiltration |
| Anomaly Detector | Isolation Forest (200 estimators, 8% contamination) | Flags statistically unusual transactions |
| Financial Model | FAIR-inspired ALE | Converts attack type + risk score → ₹ annualised loss |
| Narrative Engine | GPT-4o-mini (with rule-based fallback) | Generates plain-English risk summaries for executives |

### Training Data
- **25,000 labeled banking events** from the Cybersecurity Hackathon Dataset
- **40 features** including: transaction amount, login patterns, device info, geo velocity, IP reputation, API rates
- **Class distribution**: 22,800 normal · 633 account_takeover · 539 payment_fraud · 488 credential_stuffing · 301 api_abuse · 239 insider_data_exfiltration

---

## API Reference

### Node.js Risk Engine (port 4000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Service health + AI status |
| GET | `/api/v1/dashboard?mult=<1-3>` | KPIs, exposure, live dataset stats |
| GET | `/api/v1/assets` | 12-asset inventory |
| GET | `/api/v1/threats` | CVE threat feed |
| POST | `/api/v1/optimize/portfolio` | `{budget, mult}` → optimal control mix |
| POST | `/api/v1/impact/propagate` | `{target, intensity}` → blast-radius chain |
| GET | `/api/v1/ai/status` | Python AI service health |
| GET | `/api/v1/ai/dataset-stats` | Real stats from CSV |
| GET | `/api/v1/ai/attack-distribution` | Attack type counts + avg risk |
| GET | `/api/v1/ai/top-threats?limit=10` | Top riskiest real events |
| GET | `/api/v1/ai/feature-importance` | RF feature importances |
| POST | `/api/v1/ai/predict` | Classify a single event |
| POST | `/api/v1/ai/anomaly` | Isolation Forest anomaly check |
| POST | `/api/v1/ai/risk-score` | FAIR ALE estimate |
| POST | `/api/v1/ai/analyze` | Full pipeline: predict + anomaly + FAIR + narrative |
| POST | `/api/v1/audit/ledger-commit` | Append to blockchain audit trail |
| GET | `/api/v1/audit` | Full audit ledger |
| GET | `/api/v1/audit/verify/:id` | Verify block integrity |

### Python AI Service (port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Model metadata + accuracy |
| GET | `/dataset-stats` | Full CSV statistics |
| POST | `/predict` | Attack classification |
| POST | `/batch-predict` | Classify up to 500 events |
| POST | `/risk-score` | FAIR loss estimate |
| POST | `/anomaly` | Anomaly detection |
| POST | `/ai-explain` | GPT/rule-based narrative |
| GET | `/top-threats` | Top-N riskiest events |
| GET | `/attack-distribution` | Per-type stats |
| GET | `/feature-importance` | RF importances |
| POST | `/retrain` | Force model re-training |

---

## Sources & References

| Source | Type |
|--------|------|
| [FAIR Institute](https://www.fairinstitute.org/) | Risk Model |
| [NIST NVD](https://nvd.nist.gov/) | CVE Data |
| [IBM Cost of Data Breach 2023](https://www.ibm.com/reports/data-breach) | Research |
| [MITRE ATT&CK](https://attack.mitre.org/) | Threat Intel |
| [NIST CSF 2.0](https://www.nist.gov/cyberframework) | Framework |
| [RBI Cyber Security Framework](https://www.rbi.org.in/) | Regulation |
| [SEBI CSCRF](https://www.sebi.gov.in/) | Regulation |

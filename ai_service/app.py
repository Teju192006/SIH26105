# ═══════════════════════════════════════════════════════════════════════
#  SIH26105 — AI Microservice  (Flask · port 5000)
#  Trains on the Cybersecurity Hackathon Dataset and exposes ML-backed
#  endpoints consumed by the Node.js risk engine on port 4000.
#
#  Endpoints
#  ─────────────────────────────────────────────────────────────────────
#  GET  /health                  → service status + model metadata
#  GET  /dataset-stats           → live stats computed from the CSV
#  POST /predict                 → classify a single event (attack type + action)
#  POST /batch-predict           → classify up to 500 events at once
#  POST /risk-score              → FAIR-inspired financial loss estimate
#  POST /anomaly                 → Isolation-Forest anomaly flag
#  POST /ai-explain              → GPT natural-language risk narrative
#  GET  /top-threats             → top-10 riskiest events from dataset
#  GET  /attack-distribution     → attack type counts from real data
#  GET  /feature-importance      → RF feature importances
# ═══════════════════════════════════════════════════════════════════════

import os, json, time, logging
from pathlib import Path
from functools import lru_cache

import numpy  as np
import pandas as pd
import joblib

from flask      import Flask, request, jsonify
from flask_cors import CORS
from dotenv     import load_dotenv

from sklearn.ensemble         import RandomForestClassifier, IsolationForest
from sklearn.preprocessing    import LabelEncoder, StandardScaler
from sklearn.model_selection  import train_test_split
from sklearn.metrics          import classification_report, accuracy_score
from sklearn.pipeline         import Pipeline

# ── optional: OpenAI for narrative generation ────────────────────────────
try:
    from openai import OpenAI
    _openai_available = True
except ImportError:
    _openai_available = False

# ── bootstrap ────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent / "server" / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger("ai_service")

app = Flask(__name__)
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "*").split(","))

# ── paths & keys ─────────────────────────────────────────────────────────
DATASET_PATH = os.getenv(
    "DATASET_PATH",
    str(Path(__file__).parents[4] / "Cybersecurity Hackathon Dataset.csv"),
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MODEL_VERSION  = os.getenv("MODEL_VERSION", "rq-1.0.0-ai")
MODEL_CACHE    = Path(__file__).parent / "model_cache"
MODEL_CACHE.mkdir(exist_ok=True)

# ── global model state ────────────────────────────────────────────────────
state = {
    "rf_model":       None,  # RandomForestClassifier
    "iso_model":      None,  # IsolationForest
    "scaler":         None,  # StandardScaler for anomaly features
    "label_encoders": {},    # per-column LabelEncoders
    "feature_cols":   [],    # final numeric feature column names
    "target_encoder": None,  # LabelEncoder for attack_type
    "action_encoder": None,  # LabelEncoder for recommended_action
    "df":             None,  # full DataFrame (for stats)
    "metrics":        {},    # train/test accuracy etc.
    "trained_at":     None,
    "n_samples":      0,
    "n_features":     0,
}

# ══════════════════════════════════════════════════════════════════════════
#  DATA LOADING & FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════════

CATEGORICAL_COLS = [
    "account_type", "customer_industry", "user_role", "region", "country",
    "channel", "device_type", "payment_method", "action",
    "ip_reputation", "data_sensitivity",
]

NUMERIC_COLS = [
    "transaction_amount", "login_attempts_24h", "failed_logins_24h",
    "account_age_days", "transactions_24h", "device_age_days",
    "session_minutes", "password_age_days", "mfa_enabled", "known_device",
    "vpn_or_tor", "privileged_access", "geo_velocity_kmh", "new_beneficiary",
    "api_rate_per_min", "endpoint_risk_score", "data_download_mb",
    "chargeback_count_90d", "previous_fraud_flags",
]

def load_and_engineer(path: str) -> pd.DataFrame:
    """Load CSV, clean, and create engineered features."""
    log.info(f"Loading dataset from {path}")
    df = pd.read_csv(path)
    log.info(f"Loaded {len(df):,} rows × {df.shape[1]} columns")

    # ── basic cleaning ────────────────────────────────────────────────
    df = df.dropna(subset=["is_fraud_or_attack", "attack_type", "risk_score"])
    df["transaction_amount"] = pd.to_numeric(df["transaction_amount"], errors="coerce").fillna(0)
    df["risk_score"]         = pd.to_numeric(df["risk_score"],         errors="coerce").fillna(0)

    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # ── engineered features ───────────────────────────────────────────
    df["failed_login_ratio"] = (
        df["failed_logins_24h"] / (df["login_attempts_24h"] + 1)
    ).clip(0, 1)

    df["high_velocity"]  = (df["geo_velocity_kmh"] > 500).astype(int)
    df["high_download"]  = (df["data_download_mb"] > 50).astype(int)
    df["unusual_time"]   = df["session_minutes"].apply(
        lambda x: 1 if x < 1 or x > 120 else 0
    )
    df["risk_tier"] = pd.cut(
        df["risk_score"],
        bins=[-1, 30, 60, 80, 101],
        labels=[0, 1, 2, 3],
    ).cat.codes.astype(int)

    log.info("Feature engineering complete")
    return df


def encode_features(df: pd.DataFrame, fit: bool = True) -> np.ndarray:
    """Encode all features into a numeric matrix."""
    extra_cols = [
        "failed_login_ratio", "high_velocity", "high_download",
        "unusual_time", "risk_tier",
    ]
    all_numeric = NUMERIC_COLS + extra_cols

    encoded_parts = []

    # numeric block
    num_block = df[[c for c in all_numeric if c in df.columns]].copy()
    encoded_parts.append(num_block.values)

    # categorical block — label-encode each column
    for col in CATEGORICAL_COLS:
        if col not in df.columns:
            encoded_parts.append(np.zeros((len(df), 1)))
            continue
        le = state["label_encoders"].get(col)
        if fit or le is None:
            le = LabelEncoder()
            le.fit(df[col].astype(str))
            state["label_encoders"][col] = le
        vals = df[col].astype(str).map(
            lambda v, _le=le: _le.transform([v])[0]
            if v in _le.classes_ else -1
        ).values
        encoded_parts.append(vals.reshape(-1, 1))

    X = np.hstack(encoded_parts).astype(float)
    return X


# ══════════════════════════════════════════════════════════════════════════
#  MODEL TRAINING
# ══════════════════════════════════════════════════════════════════════════

def train_models():
    """Train RF classifier + Isolation Forest on the real dataset."""
    t0 = time.time()

    df = load_and_engineer(DATASET_PATH)
    state["df"] = df
    state["n_samples"] = len(df)

    # ── target encoders ──────────────────────────────────────────────
    te = LabelEncoder()
    te.fit(df["attack_type"].astype(str))
    state["target_encoder"] = te

    ae = LabelEncoder()
    ae.fit(df["recommended_action"].astype(str))
    state["action_encoder"] = ae

    y_attack = te.transform(df["attack_type"].astype(str))

    # ── features ─────────────────────────────────────────────────────
    X = encode_features(df, fit=True)
    state["n_features"] = X.shape[1]

    # ── RandomForest for attack classification ────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_attack, test_size=0.20, random_state=42, stratify=y_attack
    )

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=18,
        min_samples_leaf=2,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
    )
    log.info("Training RandomForest …")
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    report = classification_report(
        y_test, y_pred,
        target_names=te.classes_,
        output_dict=True,
        zero_division=0,
    )
    state["rf_model"] = rf
    state["metrics"]  = {
        "accuracy": round(acc, 4),
        "report":   report,
        "classes":  list(te.classes_),
    }
    log.info(f"RF accuracy: {acc:.4f}")

    # ── Isolation Forest for anomaly detection ────────────────────────
    anomaly_cols = [
        "transaction_amount", "login_attempts_24h", "failed_logins_24h",
        "geo_velocity_kmh", "api_rate_per_min", "data_download_mb",
        "endpoint_risk_score", "failed_login_ratio",
    ]
    extra_e = ["failed_login_ratio", "high_velocity", "high_download", "unusual_time"]
    anom_df = df[[c for c in anomaly_cols + extra_e if c in df.columns]].copy()

    scaler = StandardScaler()
    X_anom = scaler.fit_transform(anom_df.fillna(0).values)

    iso = IsolationForest(
        n_estimators=200,
        contamination=0.08,
        random_state=42,
        n_jobs=-1,
    )
    log.info("Training Isolation Forest …")
    iso.fit(X_anom)
    state["iso_model"] = iso
    state["scaler"]    = scaler
    state["anomaly_cols"] = anomaly_cols + extra_e

    state["trained_at"]  = time.time()
    log.info(f"All models trained in {time.time()-t0:.1f}s")

    # ── persist to disk so restarts are fast ─────────────────────────
    joblib.dump(rf,     MODEL_CACHE / "rf.pkl")
    joblib.dump(iso,    MODEL_CACHE / "iso.pkl")
    joblib.dump(scaler, MODEL_CACHE / "scaler.pkl")
    joblib.dump(state["label_encoders"], MODEL_CACHE / "encoders.pkl")
    joblib.dump(te,     MODEL_CACHE / "target_enc.pkl")
    joblib.dump(ae,     MODEL_CACHE / "action_enc.pkl")
    log.info("Models persisted to disk")


def try_load_cached():
    """Try loading pre-trained models from disk to skip re-training."""
    files = ["rf.pkl", "iso.pkl", "scaler.pkl", "encoders.pkl",
             "target_enc.pkl", "action_enc.pkl"]
    if not all((MODEL_CACHE / f).exists() for f in files):
        return False
    try:
        state["rf_model"]       = joblib.load(MODEL_CACHE / "rf.pkl")
        state["iso_model"]      = joblib.load(MODEL_CACHE / "iso.pkl")
        state["scaler"]         = joblib.load(MODEL_CACHE / "scaler.pkl")
        state["label_encoders"] = joblib.load(MODEL_CACHE / "encoders.pkl")
        state["target_encoder"] = joblib.load(MODEL_CACHE / "target_enc.pkl")
        state["action_encoder"] = joblib.load(MODEL_CACHE / "action_enc.pkl")
        # still need the full dataframe for stats
        df = load_and_engineer(DATASET_PATH)
        state["df"]         = df
        state["n_samples"]  = len(df)
        state["n_features"] = state["rf_model"].n_features_in_
        state["anomaly_cols"] = [
            "transaction_amount", "login_attempts_24h", "failed_logins_24h",
            "geo_velocity_kmh", "api_rate_per_min", "data_download_mb",
            "endpoint_risk_score", "failed_login_ratio",
            "high_velocity", "high_download", "unusual_time",
        ]
        state["trained_at"] = (MODEL_CACHE / "rf.pkl").stat().st_mtime
        log.info("Loaded cached models from disk")
        return True
    except Exception as e:
        log.warning(f"Cache load failed ({e}), will retrain")
        return False


# ── boot: load cache or train ─────────────────────────────────────────────
if not try_load_cached():
    train_models()


# ══════════════════════════════════════════════════════════════════════════
#  PREDICTION HELPERS
# ══════════════════════════════════════════════════════════════════════════

def event_to_row(event: dict) -> pd.DataFrame:
    """Convert a raw event dict into a single-row DataFrame."""
    defaults = {
        "account_type": "savings", "customer_industry": "technology",
        "user_role": "customer", "region": "AP-Southeast", "country": "IN",
        "channel": "mobile_app", "device_type": "ios", "payment_method": "upi",
        "action": "transfer", "ip_reputation": "neutral", "data_sensitivity": "low",
        "transaction_amount": 0, "login_attempts_24h": 1, "failed_logins_24h": 0,
        "account_age_days": 365, "transactions_24h": 1, "device_age_days": 180,
        "session_minutes": 10, "password_age_days": 90, "mfa_enabled": 1,
        "known_device": 1, "vpn_or_tor": 0, "privileged_access": 0,
        "geo_velocity_kmh": 0, "new_beneficiary": 0, "api_rate_per_min": 5,
        "endpoint_risk_score": 10, "data_download_mb": 0,
        "chargeback_count_90d": 0, "previous_fraud_flags": 0,
    }
    row = {**defaults, **event}

    # engineered features
    login_att = float(row.get("login_attempts_24h", 1))
    fail_log  = float(row.get("failed_logins_24h", 0))
    row["failed_login_ratio"] = min(fail_log / (login_att + 1), 1.0)
    row["high_velocity"]  = 1 if float(row.get("geo_velocity_kmh", 0)) > 500 else 0
    row["high_download"]  = 1 if float(row.get("data_download_mb", 0)) > 50 else 0
    sess = float(row.get("session_minutes", 10))
    row["unusual_time"]   = 1 if sess < 1 or sess > 120 else 0
    rs = float(row.get("risk_score", row.get("endpoint_risk_score", 10)))
    tier_cut = pd.cut([rs], bins=[-1,30,60,80,101], labels=[0,1,2,3])
    row["risk_tier"] = int(tier_cut.codes[0]) if hasattr(tier_cut, 'codes') else int(tier_cut[0])

    return pd.DataFrame([row])


def predict_single(event: dict) -> dict:
    """Run RF prediction on one event."""
    rf = state["rf_model"]
    te = state["target_encoder"]
    ae = state["action_encoder"]

    df_row = event_to_row(event)
    X      = encode_features(df_row, fit=False)

    proba  = rf.predict_proba(X)[0]
    idx    = int(np.argmax(proba))
    conf   = float(proba[idx])
    attack = te.classes_[idx]

    # derive recommended action from dataset distribution for this attack type
    df = state["df"]
    if attack != "normal":
        mask  = df["attack_type"] == attack
        if mask.sum() > 0:
            action = df.loc[mask, "recommended_action"].mode()[0]
        else:
            action = "monitor"
    else:
        action = "allow"

    # top-3 probable attack types
    top3 = sorted(
        [{"attack": te.classes_[i], "probability": round(float(p), 4)}
         for i, p in enumerate(proba)],
        key=lambda x: -x["probability"],
    )[:3]

    return {
        "predicted_attack": attack,
        "confidence":       round(conf, 4),
        "recommended_action": action,
        "top_predictions":  top3,
        "is_threat":        attack != "normal",
    }


def anomaly_score_single(event: dict) -> dict:
    """Run Isolation Forest anomaly detection on one event."""
    iso    = state["iso_model"]
    scaler = state["scaler"]
    a_cols = state["anomaly_cols"]

    row = event_to_row(event).iloc[0]
    vec = np.array([float(row.get(c, 0)) for c in a_cols]).reshape(1, -1)
    vec = scaler.transform(vec)

    score    = float(iso.decision_function(vec)[0])   # negative = anomalous
    is_anom  = iso.predict(vec)[0] == -1
    severity = "high" if score < -0.15 else "medium" if score < 0 else "low"

    return {
        "anomaly_score":  round(score, 4),
        "is_anomaly":     bool(is_anom),
        "severity":       severity,
    }


# ══════════════════════════════════════════════════════════════════════════
#  FINANCIAL RISK (FAIR-inspired)
# ══════════════════════════════════════════════════════════════════════════

# Loss magnitude reference values in ₹ derived from IBM Cost of Data Breach 2023
# and RBI advisory figures — scaled to Indian banking context
LOSS_TABLE = {
    "payment_fraud":            {"direct": 0.80, "regulatory": 0.10, "reputational": 0.10},
    "account_takeover":         {"direct": 0.55, "regulatory": 0.20, "reputational": 0.25},
    "credential_stuffing":      {"direct": 0.30, "regulatory": 0.30, "reputational": 0.40},
    "api_abuse":                {"direct": 0.40, "regulatory": 0.35, "reputational": 0.25},
    "insider_data_exfiltration":{"direct": 0.20, "regulatory": 0.50, "reputational": 0.30},
    "normal":                   {"direct": 0.00, "regulatory": 0.00, "reputational": 0.00},
}

BASE_LOSS_PER_ATTACK = {
    "payment_fraud":            2_800_000,
    "account_takeover":         1_500_000,
    "credential_stuffing":        900_000,
    "api_abuse":                  600_000,
    "insider_data_exfiltration":  400_000,
    "normal":                           0,
}

def calc_fair_loss(attack_type: str, risk_score: float,
                   transaction_amount: float = 0,
                   data_sensitivity: str = "low") -> dict:
    """
    Simplified FAIR-inspired annual loss estimate.
    LEF  = Likely Event Frequency (from dataset attack rate)
    LM   = Loss Magnitude (base × risk modifier × data sensitivity)
    ALE  = LEF × LM
    """
    df = state["df"]

    # LEF: empirical attack frequency from dataset
    total   = len(df)
    count   = (df["attack_type"] == attack_type).sum()
    lef     = count / total  # events per "period"

    sens_mult = {"low": 1.0, "medium": 1.8, "high": 3.2}.get(data_sensitivity, 1.0)
    risk_mult = 1.0 + (risk_score / 100) * 2.5   # 1× – 3.5×

    base_lm  = BASE_LOSS_PER_ATTACK.get(attack_type, 0)
    txn_adj  = max(float(transaction_amount) * 12, 0)  # annualise one transaction
    lm       = (base_lm + txn_adj) * risk_mult * sens_mult

    ale      = lef * lm

    dist     = LOSS_TABLE.get(attack_type, LOSS_TABLE["normal"])
    return {
        "attack_type":   attack_type,
        "lef":           round(lef, 6),
        "loss_magnitude":round(lm, 2),
        "ale":           round(ale, 2),          # annualised loss expectancy ₹
        "ale_display":   f"₹{ale:,.0f}",
        "breakdown": {
            "direct_loss":       round(ale * dist["direct"], 2),
            "regulatory_fines":  round(ale * dist["regulatory"], 2),
            "reputational_cost": round(ale * dist["reputational"], 2),
        },
        "confidence_interval": [round(ale * 0.65, 2), round(ale * 1.55, 2)],
    }


# ══════════════════════════════════════════════════════════════════════════
#  OPENAI NARRATIVE GENERATION
# ══════════════════════════════════════════════════════════════════════════

def generate_narrative(event: dict, prediction: dict, fair: dict) -> str:
    if not _openai_available or not OPENAI_API_KEY or OPENAI_API_KEY.startswith("your_"):
        # fallback rule-based narrative
        attack  = prediction["predicted_attack"]
        action  = prediction["recommended_action"]
        ale     = fair["ale_display"]
        conf    = round(prediction["confidence"] * 100, 1)
        sens    = event.get("data_sensitivity", "low")
        return (
            f"The AI model classified this event as '{attack}' with {conf}% confidence. "
            f"Recommended action: {action.replace('_',' ')}. "
            f"FAIR-based annualised loss estimate: {ale}. "
            f"Data sensitivity: {sens}. "
            f"Immediate investigation {'is' if attack != 'normal' else 'is not'} required."
        )

    client = OpenAI(api_key=OPENAI_API_KEY)
    prompt = f"""You are a senior cybersecurity analyst at an Indian bank.
Summarise the following security event in 3 concise sentences for the CISO dashboard.
Include the attack type, recommended action, financial exposure in Indian Rupees, and risk level.

Event context: {json.dumps(event, default=str)}
ML Prediction: {json.dumps(prediction)}
Financial Risk (FAIR): {json.dumps(fair)}

Write in clear, professional English. No bullet points. Max 3 sentences."""

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=180,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        log.warning(f"OpenAI call failed: {e}")
        return f"AI narrative unavailable. Attack: {prediction['predicted_attack']}. Action: {prediction['recommended_action']}."


# ══════════════════════════════════════════════════════════════════════════
#  FLASK ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":       "ok",
        "model_version":MODEL_VERSION,
        "trained_at":   state["trained_at"],
        "n_samples":    state["n_samples"],
        "n_features":   state["n_features"],
        "rf_accuracy":  state["metrics"].get("accuracy", 0),
        "attack_classes": state["metrics"].get("classes", []),
        "openai_enabled": _openai_available and bool(OPENAI_API_KEY) and not OPENAI_API_KEY.startswith("your_"),
    })


@app.route("/dataset-stats", methods=["GET"])
def dataset_stats():
    df = state["df"]
    if df is None:
        return jsonify({"error": "model not ready"}), 503

    attack_dist = df["attack_type"].value_counts().to_dict()
    action_dist = df["recommended_action"].value_counts().to_dict()
    sens_dist   = df["data_sensitivity"].value_counts().to_dict()
    channel_dist= df["channel"].value_counts().to_dict()
    industry_dist=df["customer_industry"].value_counts().to_dict()

    fraud_df    = df[df["is_fraud_or_attack"] == 1]
    avg_risk    = float(df["risk_score"].mean())
    fraud_rate  = float((df["is_fraud_or_attack"] == 1).mean())
    avg_fraud_txn = float(fraud_df["transaction_amount"].mean()) if len(fraud_df) else 0

    top10 = (
        df[df["is_fraud_or_attack"] == 1]
        .nlargest(10, "risk_score")[
            ["event_id","attack_type","risk_score","recommended_action",
             "transaction_amount","channel","ip_reputation","data_sensitivity"]
        ]
        .to_dict(orient="records")
    )

    return jsonify({
        "total_events":      state["n_samples"],
        "fraud_rate":        round(fraud_rate, 4),
        "avg_risk_score":    round(avg_risk, 2),
        "avg_fraud_txn_inr": round(avg_fraud_txn, 2),
        "attack_distribution": attack_dist,
        "action_distribution": action_dist,
        "data_sensitivity":    sens_dist,
        "channel_distribution": channel_dist,
        "industry_distribution": industry_dist,
        "top10_risky_events":   top10,
    })


@app.route("/predict", methods=["POST"])
def predict():
    event = request.get_json(force=True) or {}
    try:
        result = predict_single(event)
        return jsonify(result)
    except Exception as e:
        log.error(f"/predict error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/batch-predict", methods=["POST"])
def batch_predict():
    body   = request.get_json(force=True) or {}
    events = body.get("events", [])[:500]
    try:
        results = [predict_single(e) for e in events]
        threat_count = sum(1 for r in results if r["is_threat"])
        return jsonify({
            "total":        len(results),
            "threat_count": threat_count,
            "threat_rate":  round(threat_count / max(len(results), 1), 4),
            "results":      results,
        })
    except Exception as e:
        log.error(f"/batch-predict error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/risk-score", methods=["POST"])
def risk_score():
    body = request.get_json(force=True) or {}
    attack_type      = body.get("attack_type", "normal")
    risk_sc          = float(body.get("risk_score", 50))
    txn_amount       = float(body.get("transaction_amount", 0))
    data_sensitivity = body.get("data_sensitivity", "low")
    try:
        result = calc_fair_loss(attack_type, risk_sc, txn_amount, data_sensitivity)
        return jsonify(result)
    except Exception as e:
        log.error(f"/risk-score error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/anomaly", methods=["POST"])
def anomaly():
    event = request.get_json(force=True) or {}
    try:
        result = anomaly_score_single(event)
        return jsonify(result)
    except Exception as e:
        log.error(f"/anomaly error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/ai-explain", methods=["POST"])
def ai_explain():
    body = request.get_json(force=True) or {}
    event      = body.get("event", {})
    prediction = body.get("prediction", {})
    fair       = body.get("fair", {})
    try:
        narrative = generate_narrative(event, prediction, fair)
        return jsonify({
            "narrative":  narrative,
            "model_used": OPENAI_MODEL if (
                _openai_available and OPENAI_API_KEY
                and not OPENAI_API_KEY.startswith("your_")
            ) else "rule-based-fallback",
        })
    except Exception as e:
        log.error(f"/ai-explain error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/top-threats", methods=["GET"])
def top_threats():
    df = state["df"]
    limit = int(request.args.get("limit", 10))
    top = (
        df[df["is_fraud_or_attack"] == 1]
        .nlargest(limit, "risk_score")[
            ["event_id","attack_type","risk_score","recommended_action",
             "transaction_amount","channel","ip_reputation","data_sensitivity",
             "region","country","login_attempts_24h","failed_logins_24h"]
        ]
        .to_dict(orient="records")
    )
    return jsonify(top)


@app.route("/attack-distribution", methods=["GET"])
def attack_distribution():
    df = state["df"]
    dist = (
        df.groupby("attack_type")
        .agg(
            count=("attack_type", "count"),
            avg_risk=("risk_score", "mean"),
            avg_txn=("transaction_amount", "mean"),
        )
        .reset_index()
        .rename(columns={"attack_type": "name"})
    )
    dist["avg_risk"] = dist["avg_risk"].round(2)
    dist["avg_txn"]  = dist["avg_txn"].round(2)
    return jsonify(dist.to_dict(orient="records"))


@app.route("/feature-importance", methods=["GET"])
def feature_importance():
    rf = state["rf_model"]
    if rf is None:
        return jsonify({"error": "model not ready"}), 503

    extra_cols = [
        "failed_login_ratio", "high_velocity", "high_download",
        "unusual_time", "risk_tier",
    ]
    all_numeric = NUMERIC_COLS + extra_cols
    feature_names = (
        [c for c in all_numeric]
        + [f"cat_{c}" for c in CATEGORICAL_COLS]
    )
    importances = rf.feature_importances_
    n = min(len(feature_names), len(importances))
    pairs = sorted(
        [{"feature": feature_names[i], "importance": round(float(importances[i]), 5)}
         for i in range(n)],
        key=lambda x: -x["importance"],
    )[:20]
    return jsonify(pairs)


@app.route("/retrain", methods=["POST"])
def retrain():
    """Force re-train — wipes disk cache first."""
    for f in MODEL_CACHE.glob("*.pkl"):
        f.unlink()
    train_models()
    return jsonify({"status": "ok", "message": "Models retrained successfully"})


# ── run ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

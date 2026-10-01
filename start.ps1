# ═══════════════════════════════════════════════════════════════
#  SIH26105 — Start All Services (PowerShell)
#  Starts: Python AI service (5000) + Node API (4000) + Next.js (3000)
#
#  Requirements:
#    - Node.js 18+  (https://nodejs.org)
#    - Python 3.10+ (https://python.org)
#    - pip install -r ai_service/requirements.txt  (run once)
#    - npm install  inside server/ and web/         (run once)
# ═══════════════════════════════════════════════════════════════

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  SIH26105  — Cyber Risk Engine" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Python AI Microservice ──────────────────────────────────
Write-Host "Starting Python AI microservice (port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", "cd '$root\ai_service'; python app.py" `
  -WindowStyle Normal

Start-Sleep -Seconds 2

# ── 2. Node.js Risk Engine API ─────────────────────────────────
Write-Host "Starting Node.js API (port 4000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", "cd '$root\server'; npm start" `
  -WindowStyle Normal

Start-Sleep -Seconds 2

# ── 3. Next.js Frontend ────────────────────────────────────────
Write-Host "Starting Next.js frontend (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", "cd '$root\web'; npm run dev" `
  -WindowStyle Normal

Write-Host ""
Write-Host "All services starting..." -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  → http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Node API  → http://localhost:4000" -ForegroundColor Cyan
Write-Host "  AI Model  → http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: The AI service takes ~30-60 seconds to train on first run." -ForegroundColor Yellow
Write-Host "      Subsequent starts load the cached model in ~5 seconds." -ForegroundColor Yellow
Write-Host ""

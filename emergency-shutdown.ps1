# ═══════════════════════════════════════════════════════════════
#  SIH26105 — Emergency Shutdown Script
#  Kills all 3 service processes: Node API (4000), Python AI (5000),
#  Next.js frontend (3000).
#  Triggered automatically when server/index.js calls process.exit(99)
#  Can also be run manually: .\emergency-shutdown.ps1
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  🚨 SIH26105 EMERGENCY SHUTDOWN 🚨" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Kill processes listening on ports 3000, 4000, 5000
$ports = @(3000, 4000, 5000)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $pid = $conn.OwningProcess | Select-Object -First 1
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  Stopping PID $pid ($($proc.ProcessName)) on port $port..." -ForegroundColor Yellow
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Killed port $port" -ForegroundColor Green
        }
    } else {
        Write-Host "  Port $port already free." -ForegroundColor Gray
    }
}

# Kill any remaining node / python processes started by this project
Write-Host ""
Write-Host "Cleaning up node and python processes..." -ForegroundColor Yellow
Get-Process -Name "node"   -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  ✅ Emergency shutdown complete." -ForegroundColor Green
Write-Host "  Run .\start.ps1 to restart all services after investigation." -ForegroundColor Cyan
Write-Host ""

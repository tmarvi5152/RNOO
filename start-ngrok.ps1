# RNOO ngrok Setup Script
# Starts an ngrok tunnel for the backend (port 8765) and updates WEBHOOK_BASE_URL in backend/.env

param(
    [string]$AuthToken = "",
    [int]$BackendPort = 8765,
    [int]$FrontendPort = 3456,
    [switch]$AlsoTunnelFrontend
)

$EnvFile = Join-Path $PSScriptRoot "backend\.env"

# ── 1. Authtoken ───────────────────────────────────────────────────────────────
$savedToken = $AuthToken
if (-not $savedToken) {
    # Check if already saved in ngrok config
    $ngrokConfig = "$env:LOCALAPPDATA\ngrok\ngrok.yml"
    if (Test-Path $ngrokConfig) {
        $configContent = Get-Content $ngrokConfig -Raw
        if ($configContent -match "authtoken:\s*(\S+)") {
            $savedToken = $Matches[1]
            Write-Host "Using saved ngrok authtoken." -ForegroundColor Gray
        }
    }
}

if (-not $savedToken) {
    Write-Host ""
    Write-Host "ngrok requires an authtoken." -ForegroundColor Yellow
    Write-Host "Sign up free at https://dashboard.ngrok.com/signup" -ForegroundColor Cyan
    Write-Host "Then copy your token from https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Cyan
    Write-Host ""
    $savedToken = Read-Host "Paste your ngrok authtoken here"
    if (-not $savedToken) {
        Write-Host "No token provided. Exiting." -ForegroundColor Red
        exit 1
    }
    ngrok config add-authtoken $savedToken
    Write-Host "Authtoken saved." -ForegroundColor Green
}

# ── 2. Kill any existing ngrok processes ───────────────────────────────────────
$existing = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping existing ngrok process..." -ForegroundColor Gray
    $existing | Stop-Process -Force
    Start-Sleep -Seconds 1
}

function Wait-NgrokTunnels {
    param(
        [int]$MinTunnels = 1,
        [int]$MaxWaitSeconds = 15
    )

    $waited = 0
    while ($waited -lt $MaxWaitSeconds) {
        Start-Sleep -Seconds 1
        $waited++
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
            if ($response.tunnels -and $response.tunnels.Count -ge $MinTunnels) {
                return $response.tunnels
            }
        } catch {
            # Not ready yet
        }
    }

    return $null
}

# ── 3. Start ngrok tunnel(s) ───────────────────────────────────────────────────
Write-Host ""
Write-Host "Starting ngrok tunnel for backend (port $BackendPort)..." -ForegroundColor Green

if ($AlsoTunnelFrontend) {
    # Run with config file for multiple tunnels
    $tmpConfig = Join-Path $env:TEMP "rnoo-ngrok.yml"
    $safeToken = ($savedToken -replace '"', '\\"')
    @"
version: "3"
authtoken: "$safeToken"
tunnels:
  backend:
    proto: http
    addr: $BackendPort
  frontend:
    proto: http
    addr: $FrontendPort
"@ | Set-Content $tmpConfig
    Start-Process -FilePath "ngrok" -ArgumentList "start", "--all", "--config", $tmpConfig -WindowStyle Minimized
    Write-Host "Waiting for ngrok dual tunnels to initialize..." -ForegroundColor Gray
    $tunnels = Wait-NgrokTunnels -MinTunnels 2 -MaxWaitSeconds 15

    if (-not $tunnels) {
        Write-Host "[!] Dual tunnel startup failed, retrying backend-only tunnel..." -ForegroundColor Yellow

        $retryExisting = Get-Process -Name ngrok -ErrorAction SilentlyContinue
        if ($retryExisting) {
            $retryExisting | Stop-Process -Force
            Start-Sleep -Seconds 1
        }

        Start-Process -FilePath "ngrok" -ArgumentList "http", $BackendPort -WindowStyle Minimized
        Write-Host "Waiting for backend tunnel to initialize..." -ForegroundColor Gray
        $tunnels = Wait-NgrokTunnels -MinTunnels 1 -MaxWaitSeconds 15
    }
} else {
    Start-Process -FilePath "ngrok" -ArgumentList "http", $BackendPort -WindowStyle Minimized
    Write-Host "Waiting for ngrok to initialize..." -ForegroundColor Gray
    $tunnels = Wait-NgrokTunnels -MinTunnels 1 -MaxWaitSeconds 15
}

if (-not $tunnels) {
    Write-Host "ERROR: ngrok did not start in time. Check the ngrok window for errors." -ForegroundColor Red
    exit 1
}

# ── 5. Extract URLs ────────────────────────────────────────────────────────────
$backendTunnel = $tunnels | Where-Object {
    $_.config.addr -match ":?$BackendPort$"
} | Select-Object -First 1

if (-not $backendTunnel) {
    # Fallback: just take the first HTTPS tunnel
    $backendTunnel = $tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1
}

$backendUrl = $backendTunnel.public_url

if (-not $backendUrl) {
    Write-Host "ERROR: Could not determine public ngrok URL." -ForegroundColor Red
    Write-Host "Raw tunnels response:" -ForegroundColor Gray
    $tunnels | Format-List
    exit 1
}

$backendUrl = $backendUrl.TrimEnd('/')

# ── 6. Update backend/.env ────────────────────────────────────────────────────
Write-Host ""
Write-Host "Updating backend/.env with WEBHOOK_BASE_URL..." -ForegroundColor Green

if (Test-Path $EnvFile) {
    $envContent = Get-Content $EnvFile -Raw
    if ($envContent -match "(?m)^WEBHOOK_BASE_URL\s*=.*$") {
        $envContent = $envContent -replace "(?m)^WEBHOOK_BASE_URL\s*=.*$", "WEBHOOK_BASE_URL=$backendUrl"
    } else {
        $envContent = $envContent.TrimEnd() + "`nWEBHOOK_BASE_URL=$backendUrl`n"
    }
    Set-Content $EnvFile $envContent -NoNewline
} else {
    "WEBHOOK_BASE_URL=$backendUrl" | Set-Content $EnvFile
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ngrok is running!" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend public URL:  $backendUrl" -ForegroundColor Yellow
Write-Host "  ngrok dashboard:     http://localhost:4040" -ForegroundColor Gray
Write-Host ""
Write-Host "  WEBHOOK_BASE_URL has been written to backend/.env" -ForegroundColor Green
Write-Host ""

if ($AlsoTunnelFrontend) {
    $frontendTunnel = $tunnels | Where-Object {
        $_.config.addr -match ":?$FrontendPort$"
    } | Select-Object -First 1
    if ($frontendTunnel) {
        Write-Host "  Frontend public URL: $($frontendTunnel.public_url)" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "  Next steps:" -ForegroundColor White
Write-Host "   1. Restart the backend (run start-backend.ps1) so it picks up the new WEBHOOK_BASE_URL" -ForegroundColor White
Write-Host "   2. Shepherd webhook subscriptions re-register automatically on startup" -ForegroundColor White
Write-Host "   3. Leave this ngrok process running while testing" -ForegroundColor White
Write-Host ""
Write-Host "  NOTE: Free ngrok URLs change every restart. Re-run this script each time." -ForegroundColor Gray
Write-Host "  TIP:  Use a paid ngrok static domain to keep the URL stable." -ForegroundColor Gray
Write-Host ""

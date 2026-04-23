# Start RNOO Application (Backend + Frontend)
# Starts both servers in separate windows

Write-Host "Starting RNOO Application..." -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = $PSScriptRoot
$BackendScript = Join-Path $ScriptDir "start-backend.ps1"
$FrontendScript = Join-Path $ScriptDir "start-frontend.ps1"

# Start Backend in new window
Write-Host "1. Starting Backend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $BackendScript

# Wait for backend to initialize
Write-Host "   Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Start Frontend in new window
Write-Host "2. Starting Frontend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $FrontendScript

Write-Host ""
Write-Host "RNOO Application Started!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend API:  http://127.0.0.1:8765" -ForegroundColor Yellow
Write-Host "Frontend App: http://localhost:3456" -ForegroundColor Yellow
Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor White
Write-Host "Wait ~30 seconds for frontend compilation to complete." -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop the servers." -ForegroundColor Gray

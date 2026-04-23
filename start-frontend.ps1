# Start RNOO Frontend Development Server
# Navigate to frontend directory and run the dev server

$FrontendPath = Join-Path $PSScriptRoot "frontend"
Set-Location $FrontendPath
$env:BROWSER = 'none'
$env:PORT = '3456'

$PortUsers = Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue |
	Select-Object -ExpandProperty OwningProcess -Unique
if ($PortUsers) {
	Write-Host "Port 3456 is in use. Stopping existing process(es): $($PortUsers -join ', ')" -ForegroundColor Yellow
	foreach ($Pid in $PortUsers) {
		Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue
	}
	Start-Sleep -Seconds 1
}

Write-Host "Starting RNOO Frontend Server on http://localhost:3456..." -ForegroundColor Green
Write-Host "Frontend Directory: $FrontendPath" -ForegroundColor Gray
Write-Host "Waiting for compilation..." -ForegroundColor Yellow
yarn start

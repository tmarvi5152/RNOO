# Start RNOO Backend Server
# Navigate to backend directory and run the server

$BackendPath = Join-Path $PSScriptRoot "backend"
Set-Location $BackendPath
Write-Host "Starting RNOO Backend Server on http://127.0.0.1:8765..." -ForegroundColor Green
Write-Host "Backend Directory: $BackendPath" -ForegroundColor Gray

$VenvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
	Write-Host "Using virtual environment Python: $VenvPython" -ForegroundColor Gray
	& $VenvPython run.py
} else {
	Write-Host "Virtual environment Python not found, falling back to system python." -ForegroundColor Yellow
	python run.py
}

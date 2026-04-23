@echo off
setlocal enabledelayedexpansion

:: RNOO Application Launcher with System Checks
:: =============================================

echo.
echo ========================================
echo   RNOO Application Startup
echo ========================================
echo.

:: Check if MongoDB is running
echo [1/4] Checking MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo   [OK] MongoDB is running
) else (
    echo   [!] MongoDB is NOT running
    echo.
    echo   MongoDB must be running for the application to work.
    echo   Please start MongoDB and try again.
    echo.
    echo   Options:
    echo   1. Start MongoDB service: net start MongoDB
    echo   2. Or run mongod.exe manually
    echo.
    pause
    exit /b 1
)

:: Check and clear port 8765 (Backend)
echo.
echo [2/4] Checking Backend Port 8765...
netstat -ano | findstr :8765 >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [!] Port 8765 is in use. Clearing...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8765') do (
        taskkill /F /PID %%a >NUL 2>&1
    )
    timeout /t 2 /nobreak >NUL
    echo   [OK] Port 8765 cleared
) else (
    echo   [OK] Port 8765 is available
)

:: Check and clear port 3456 (Frontend)
echo.
echo [3/4] Checking Frontend Port 3456...
netstat -ano | findstr :3456 >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [!] Port 3456 is in use. Clearing...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3456') do (
        taskkill /F /PID %%a >NUL 2>&1
    )
    timeout /t 2 /nobreak >NUL
    echo   [OK] Port 3456 cleared
) else (
    echo   [OK] Port 3456 is available
)

:: Start the application
echo.
echo [4/4] Starting RNOO Application...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"

echo.
echo ========================================
echo   Application Started!
echo ========================================
echo.
echo   Backend:  http://127.0.0.1:8765
echo   Frontend: http://localhost:3456
echo.
echo   Wait ~30 seconds for frontend to compile
echo   then open: http://localhost:3456
echo.
echo ========================================
echo.
pause

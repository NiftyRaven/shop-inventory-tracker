@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title AG Innovation Inventory
color 0F

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  This program needs Node.js. It is a free install.
  echo  Your browser will open the download page. Choose the LTS button.
  echo  When that finishes, double-click Start Inventory.bat again.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo  First time only — getting the program ready. This can take a minute.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Setup did not finish. Check the internet, then double-click this file again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  ============================================================
echo   AG Innovation Inventory
echo  ============================================================
echo.
echo   Leave this window open. Close it to stop the tracker.
echo   After the PC sleeps or restarts, double-click
echo   Start Inventory.bat again.
echo.
echo   This computer:   http://localhost:3000
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host ('  Other shop PCs:  http://' + $_.IPAddress + ':3000') }"
echo.
echo  Opening the tracker in your browser...
echo  ============================================================
echo.

start "" "http://localhost:3000"
node server\index.js

echo.
echo  The tracker is stopped. Double-click Start Inventory.bat to start it again.
pause

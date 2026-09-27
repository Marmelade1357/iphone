@echo off
cd /d "%~dp0"
echo Starte iPhone-Vergleich...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo !!! Start fehlgeschlagen - laeuft Docker Desktop?
  pause
  exit /b 1
)
timeout /t 3 >nul
start http://localhost:8103

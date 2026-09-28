@echo off
cd /d "%~dp0"
if exist .env goto start

echo.
echo Fuer den Admin-Bereich (Telekom-Preise eintragen) wird ein Passwort benoetigt.
echo Es wird nur lokal in der Datei .env gespeichert (nicht im Git).
set "PW="
set /p "PW=Admin-Passwort festlegen (leer lassen = Admin-Bereich aus): "
setlocal EnableDelayedExpansion
> .env echo ADMIN_PASSWORD=!PW!
endlocal

:start
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

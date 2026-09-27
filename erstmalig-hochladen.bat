@echo off
chcp 65001 >nul
rem Einmalig: erstes Hochladen nach GitHub (danach reicht push-all.bat).
cd /d "%~dp0"
git push -u origin main
if errorlevel 1 (
  echo.
  echo !!! Push fehlgeschlagen - Ausgabe oben pruefen.
) else (
  echo.
  echo Hochgeladen: https://github.com/Marmelade1357/iphone
)
pause

@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_incan_gold.ps1"
if errorlevel 1 (
  echo.
  echo Unable to start Incan Gold. Please check dev-server.err.log.
  pause
)

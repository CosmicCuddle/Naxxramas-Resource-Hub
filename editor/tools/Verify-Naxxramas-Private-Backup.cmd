@echo off
setlocal
title Verify Naxxramas Private Git Backup
rem Manual, read-only Windows helper. No token or network upload.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -STA -File "%~dp0Verify-Naxxramas-Private-Backup.ps1"
if errorlevel 1 (
  echo.
  echo The selected private backup was NOT verified.
) else (
  echo.
  echo Private backup verification helper finished.
)
echo.
echo Press any key to close this window.
pause >nul

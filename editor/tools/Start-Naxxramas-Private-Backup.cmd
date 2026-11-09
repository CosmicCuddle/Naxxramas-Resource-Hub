@echo off
setlocal
title Naxxramas Private Website Backup
rem Manual Windows-only shortcut. No network upload or website change.
rem PowerShell RemoteSigned respects existing machine policies; no bypass.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -STA -File "%~dp0Start-Naxxramas-Private-Backup.ps1"
if errorlevel 1 (
  echo.
  echo The private backup was not verified.
  echo See the on-screen warning. Never rely on a partial backup.
) else (
  echo.
  echo Local private backup helper finished.
)
echo.
echo Press any key to close this window.
pause >nul

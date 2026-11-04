@echo off
title Naxxramas Game Clients - Local Draft Preview
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Preview.ps1"
if errorlevel 1 (
  echo.
  echo Preview did not start. Check that the full ZIP has been extracted.
  pause
)

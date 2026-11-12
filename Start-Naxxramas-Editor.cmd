@echo off
setlocal
title Naxxramas - Website Editor
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. The editor did not start.
  goto :done
)
where gh.exe >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is required. The editor did not start.
  goto :done
)
node.exe "%~dp0tools\original-editor-save\server.cjs"
:done
echo.
echo Close this window when you are finished editing.
pause >nul

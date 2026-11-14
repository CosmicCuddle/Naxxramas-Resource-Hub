@echo off
setlocal
title Naxxramas - Original Website Editor

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Please install Node.js LTS first.
  goto :done
)

where gh.exe >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is missing. Please install GitHub CLI first.
  goto :done
)

node.exe "%~dp0start-original-editor.cjs"

:done
echo.
echo Close this window when you are finished editing.
pause >nul

@echo off
setlocal
title Naxxramas - Original Visual Website Editor
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it once from https://nodejs.org/.
  goto :done
)
where gh.exe >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is required. Install it once from https://cli.github.com/.
  goto :done
)
node.exe "%~dp0tools\original-editor\original-editor-server.cjs" --original-editor
:done
echo.
echo Press any key to close this window.
pause >nul

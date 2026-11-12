@echo off
setlocal
title Naxxramas - Original Website Editor
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. The original website editor did not start.
  goto :done
)
where gh.exe >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is missing or not on PATH. The original website editor did not start.
  goto :done
)
node.exe "%~dp0start-original-editor.cjs" --original-editor
:done
echo.
echo Close this window when you are finished editing.
pause >nul

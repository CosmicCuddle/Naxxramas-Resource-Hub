@echo off
setlocal
title Naxxramas - Original Website Editor
echo.
echo Starting the ORIGINAL Naxxramas website editor...
echo The Save button writes to a protected GitHub editing branch, not main.
echo.
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Nothing was changed.
  goto :done
)
where gh.exe >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is missing. Nothing was changed.
  goto :done
)
node.exe "%~dp0start-original-editor.cjs"
:done
echo.
echo Close this window when you are finished editing.
pause >nul

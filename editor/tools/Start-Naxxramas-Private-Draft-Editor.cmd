@echo off
setlocal
title Naxxramas - Private Website Draft Editor
rem Manual owner-launched private draft editor. Never publish the website.
rem GitHub CLI must be authenticated once before use. No token shown here.
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. The website editor did not start.
  goto :done
)
where gh.exe >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is missing or not on PATH. The website editor did not start.
  goto :done
)
node.exe "%~dp0start-owner-private-draft-editor.cjs" --private-drafts
:done
echo.
echo Close this window when finished editing.
pause >nul

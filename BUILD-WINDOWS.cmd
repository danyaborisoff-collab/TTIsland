@echo off
chcp 65001 >nul
cd /d "%~dp0"
title TTIsland - Windows build
where node >nul 2>&1 || (echo Установите Node.js LTS. & pause & exit /b 1)
call npm install
if errorlevel 1 (pause & exit /b 1)
call npm run dist:win
if errorlevel 1 (pause & exit /b 1)
echo Установщик готов в папке dist. После установки запускайте TTIsland, а не npm start.
explorer "%CD%\dist"
pause

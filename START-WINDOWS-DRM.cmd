@echo off
setlocal
cd /d "%~dp0"
rem Electron from castlabs with Widevine CDM (needed by Apple Music web player).
if "%ECS_TAG%"=="" set ECS_TAG=v42.0.0+wvcus
where npm.cmd >nul 2>&1
if errorlevel 1 (echo npm was not found. Install Node.js LTS 20+. & pause & exit /b 1)
if exist "node_modules\electron\.castlabs-%ECS_TAG%" goto run
echo Installing dependencies...
call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto fail
echo Installing castlabs Electron %ECS_TAG% (Widevine)...
call npm.cmd install --no-save --no-audit --no-fund "electron@https://github.com/castlabs/electron-releases#%ECS_TAG%"
if errorlevel 1 (
  echo Could not install castlabs Electron %ECS_TAG%.
  echo Open https://github.com/castlabs/electron-releases/releases , pick the newest tag ending with +wvcus
  echo and run:  set ECS_TAG=vXX.X.X+wvcus  then start this file again.
  goto fail
)
echo ok> "node_modules\electron\.castlabs-%ECS_TAG%"
:run
echo Starting TTIsland with Widevine...
start "TTIsland" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0
:fail
pause
exit /b 1

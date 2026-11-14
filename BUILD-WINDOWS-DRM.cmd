@echo off
setlocal
cd /d "%~dp0"
rem Builds the installer on castlabs Electron (Widevine) so Apple Music can play.
if "%ECS_TAG%"=="" set ECS_TAG=v42.0.0+wvcus
set ECS_VER=%ECS_TAG:~1%
call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto fail
call npm.cmd install --no-save --no-audit --no-fund "electron@https://github.com/castlabs/electron-releases#%ECS_TAG%"
if errorlevel 1 (echo castlabs Electron %ECS_TAG% not found. set ECS_TAG=vXX.X.X+wvcus and retry. & goto fail)
call npx.cmd electron-builder --win nsis --x64 -c.electronDist=node_modules/electron/dist -c.electronVersion=%ECS_VER%
if errorlevel 1 goto fail
echo.
echo Optional but recommended for Apple Music: VMP-sign the build (free castlabs EVS account):
echo   pip install castlabs-evs ^&^& python -m castlabs_evs.account signup
echo   python -m castlabs_evs.vmp sign-pkg dist\win-unpacked
explorer "%CD%\dist"
pause
exit /b 0
:fail
pause
exit /b 1

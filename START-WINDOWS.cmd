@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 goto path_error
if not exist "package.json" goto missing_files
if not exist "index.html" goto missing_files
where node.exe >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_npm
node -e "if (Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if errorlevel 1 goto old_node
if not exist "node_modules\electron\dist\electron.exe" goto install
if not exist "node_modules\imapflow\package.json" goto install
goto run
:install
echo Installing dependencies. This may take several minutes.
call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto install_error
if not exist "node_modules\electron\dist\electron.exe" goto install_error
if not exist "node_modules\imapflow\package.json" goto install_error
:run
echo Starting TTIsland...
start "TTIsland" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0
:path_error
echo Cannot open the application folder. Extract the ZIP to a local folder.
goto fail
:missing_files
echo Application files not found. Extract the entire ZIP before starting.
goto fail
:missing_node
echo Node.js was not found. Install Node.js LTS 20 or newer and reopen this window.
goto fail
:missing_npm
echo npm was not found. Reinstall Node.js LTS with npm enabled.
goto fail
:old_node
echo Node.js is too old. Install Node.js LTS version 20 or newer.
goto fail
:install_error
echo Dependency installation failed. Check the npm output above and internet connection.
:fail
pause
exit /b 1

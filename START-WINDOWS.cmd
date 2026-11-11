@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  call npm install
  if errorlevel 1 (
    echo Ошибка установки зависимостей.
    pause
    exit /b 1
  )
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron не установлен. Проверь вывод npm install.
  pause
  exit /b 1
)
start "TTIsland" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0

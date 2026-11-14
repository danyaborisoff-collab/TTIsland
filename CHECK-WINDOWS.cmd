@echo off
cd /d "%~dp0"
node tests\windows-smoke.cjs --devices
pause

@echo off
echo.
echo ========================================
echo  Stopping Image Analysis Application
echo ========================================
echo.

echo Stopping Python processes...

REM Kill all Python processes (this will stop both services)
taskkill /f /im python.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ Python processes stopped
) else (
    echo ℹ️  No Python processes were running
)

REM Kill any remaining processes on our ports
echo Checking for processes on ports 8000 and 8001...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    if not "%%a"=="0" (
        taskkill /f /pid %%a 2>nul
        echo ✅ Stopped process on port 8000 (PID: %%a)
    )
)

for /f "tokens=5" %%b in ('netstat -ano ^| findstr :8001') do (
    if not "%%b"=="0" (
        taskkill /f /pid %%b 2>nul
        echo ✅ Stopped process on port 8001 (PID: %%b)
    )
)

echo.
echo ========================================
echo  All services stopped successfully!
echo ========================================
echo.
pause
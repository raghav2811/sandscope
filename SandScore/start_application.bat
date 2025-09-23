@echo off
echo.
echo ========================================
echo  Hybrid Image Analysis Application
echo ========================================
echo.
echo Starting services...
echo - Web Server: http://localhost:8000
echo - Hybrid Analysis Service: http://localhost:8001
echo - Dashboard: http://localhost:8000/simple_dashboard.html
echo.
echo Features:
echo - Fast numerical analysis
echo - Comprehensive plot generation
echo - Preprocessing visualization
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv venv
    echo Then: venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

REM Start the analysis service in background
echo Starting Analysis Service on port 8001...
start "Grain Analysis Service" cmd /k "cd /d "%~dp0" && venv\Scripts\python.exe simple_analysis_service.py"

REM Wait for analysis service to start
echo Waiting for Analysis Service to initialize...
timeout /t 5 /nobreak >nul

REM Start the web server
echo Starting Web Server on port 8000...
echo.
echo ========================================
echo  Application Ready!
echo ========================================
echo.
echo Open these URLs in your browser:
echo - Main Upload: http://localhost:8000
echo - Dashboard:   http://localhost:8000/simple_dashboard.html
echo.
echo Press Ctrl+C to stop the web server
echo (Analysis service will continue running in background)
echo.

venv\Scripts\python.exe -m http.server 8000 --bind 127.0.0.1
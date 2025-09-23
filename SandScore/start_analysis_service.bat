@echo off
echo Starting Grain Size Analysis Service...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install requirements
echo Installing/updating dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

REM Set environment variables if not set
if "%SUPABASE_URL%"=="" (
    echo WARNING: SUPABASE_URL environment variable not set
    echo The service will use the default values from config.js
)

if "%SUPABASE_KEY%"=="" (
    echo WARNING: SUPABASE_KEY environment variable not set
    echo The service will use the default values from config.js
)

echo.
echo Starting the analysis service on http://localhost:8001
echo Press Ctrl+C to stop the service
echo.

REM Start the service
python simple_analysis_service.py
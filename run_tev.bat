@echo off
setlocal
title Tev Launcher

echo ===========================
echo       Tev Launcher
echo ===========================
echo.

cd /d "%~dp0"

rem Check for Ollama installation
where ollama >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Ollama was not found!
    echo.
    echo Tev requires Ollama to run
    echo Please download and install Ollama from https://ollama.com/
    echo If Ollama is already installed, make sure it is on PATH
    echo.
    pause
    exit /b 1
)

echo Ollama detected!
echo Ensuring AI model is ready...
echo.
ollama pull qwen2.5:1.5b

rem Detect Python
set "PYTHON_CMD="

where python >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=python"

if not defined PYTHON_CMD (
    where py >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=py"
)

if not defined PYTHON_CMD (
    echo Python was not found!
    echo Please download and install Python from https://www.python.org/downloads/
    echo If Python is already installed, make sure it is on PATH
    echo.
    pause
    exit /b 1
)

echo Python detected!
echo.

rem Check requirements
if not exist "requirements.txt" (
    echo requirements.txt was not found.
    echo.
    pause
    exit /b 1
)

echo Installing Python packages...
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 (
    echo Failed to install Python packages.
    echo.
    pause
    exit /b 1
)

echo.

rem Check for Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found!
    echo Please download and install Node.js from https://nodejs.org/en/download
    echo If Node.js is already installed, make sure it is on PATH
    echo.
    pause
    exit /b 1
)

rem Run Tev
if not exist "Desktop\package.json" (
    echo Desktop\package.json was not found.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0Desktop"
call npm start

if errorlevel 1 pause

endlocal
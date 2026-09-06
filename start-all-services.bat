@echo off
setlocal enabledelayedexpansion

title Gen AI Platform - All Services Launcher

echo =======================================================================
echo              GEN AI PLATFORM - MULTI-SERVICE LAUNCHER
echo =======================================================================
echo.

:: Detect root project directory
set "CURRENT_DIR=%~dp0"
if "%CURRENT_DIR:~-1%"=="\" set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

if exist "%CURRENT_DIR%\stable-diffusion-webui-forge" (
    set "ROOT_DIR=%CURRENT_DIR%"
) else if exist "%CURRENT_DIR%\..\stable-diffusion-webui-forge" (
    for %%I in ("%CURRENT_DIR%\..") do set "ROOT_DIR=%%~fI"
) else (
    set "ROOT_DIR=%CURRENT_DIR%"
)

set "FORGE_DIR=%ROOT_DIR%\stable-diffusion-webui-forge"
set "BACKEND_DIR=%ROOT_DIR%\Content Transformation"
set "FRONTEND_DIR=%ROOT_DIR%\Content Transformation\Frontend"

echo [ROOT]     : %ROOT_DIR%
echo [FORGE]    : %FORGE_DIR%
echo [BACKEND]  : %BACKEND_DIR%
echo [FRONTEND] : %FRONTEND_DIR%
echo.

echo Launching services in separate windows...
echo.

:: 1. Start Ollama Server & Pre-load Qwen + Gemma Models
echo [1/4] Starting Ollama Server (Qwen3 4B & Gemma3 4B)...
start "1. Ollama AI Server" cmd /k "title Ollama AI Server & echo Starting Ollama service... & ollama serve"

:: Small delay to allow Ollama service initialization
timeout /t 2 /nobreak >nul

:: Pre-warm/verify models in Ollama
start "1b. Ollama Model Loader" cmd /c "title Loading Qwen & Gemma Models & echo Pre-loading Qwen3 4B & Gemma3 4B... & ollama run qwen3:4b "hello" & ollama run gemma3:4b "hello" & echo Models loaded successfully!"

:: 2. Start Stable Diffusion WebUI Forge API
echo [2/4] Starting Stable Diffusion Image API (Port 7860)...
start "2. Stable Diffusion Forge API" cmd /k "title Stable Diffusion API (Port 7860) & cd /d "%FORGE_DIR%" & if exist start-image-api.bat ( call start-image-api.bat ) else ( call webui.bat --api --listen --port 7860 )"

:: 3. Start FastAPI Backend Server
echo [3/4] Starting FastAPI Backend (Port 8000)...
start "3. FastAPI Backend" cmd /k "title FastAPI Backend (Port 8000) & cd /d "%BACKEND_DIR%" & if exist .venv\Scripts\python.exe ( .venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 ) else ( python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 )"

:: 4. Start Frontend Dev Server
echo [4/4] Starting Frontend Dev Server (npm run dev)...
start "4. Frontend Dev Server" cmd /k "title Frontend Dev Server & cd /d "%FRONTEND_DIR%" & npm run dev"

echo.
echo =======================================================================
echo  All 4 service windows spawned successfully!
echo =======================================================================
echo  - Ollama Server & Models (qwen3:4b, gemma3:4b)
echo  - Stable Diffusion Image API : http://127.0.0.1:7860
echo  - FastAPI Backend API         : http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)
echo  - Frontend Dev Server         : http://localhost:5173 / http://localhost:3000
echo =======================================================================
echo.
pause

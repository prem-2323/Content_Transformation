@echo off
title FastAPI Backend Server (Port 8000)
cd /d "%~dp0"
echo Starting FastAPI application...
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
) else (
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
)
pause

@echo off
REM Teamly Azure Deployment Script for Windows
REM This script helps Windows users deploy to Azure

echo ============================================================
echo         Teamly Azure Deployment Script (Windows)
echo ============================================================
echo.

REM Check if Azure CLI is installed
where az >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Azure CLI is not installed
    echo Please install it from: https://docs.microsoft.com/cli/azure/install-azure-cli-windows
    echo.
    pause
    exit /b 1
)
echo [OK] Azure CLI is installed

REM Check if Docker is installed
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed
    echo Please install it from: https://docs.docker.com/desktop/install/windows-install/
    echo.
    pause
    exit /b 1
)
echo [OK] Docker is installed

echo.
echo This script will deploy Teamly to Microsoft Azure.
echo.
echo Prerequisites:
echo - Azure account (free tier available)
echo - Azure CLI installed and logged in
echo - Docker Desktop installed and running
echo.
echo Monthly cost estimate: $30-40 (Basic tier)
echo.
pause

REM Try to use Git Bash if available
where bash >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo [INFO] Git Bash detected. Using bash script for better experience.
    bash scripts/deployment/deploy-azure.sh
    exit /b %errorlevel%
)

REM If Git Bash not available, provide manual instructions
echo.
echo [INFO] Git Bash not found. Please follow these steps:
echo.
echo 1. Install Git for Windows from: https://git-scm.com/download/win
echo 2. Open Git Bash (not Command Prompt or PowerShell)
echo 3. Navigate to this directory
echo 4. Run: ./scripts/deployment/deploy-azure.sh
echo.
echo OR follow the manual deployment guide in:
echo docs\AZURE_DEPLOYMENT.md
echo.
pause

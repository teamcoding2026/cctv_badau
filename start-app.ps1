$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Host "Virtual environment belum ada. Jalankan dulu:" -ForegroundColor Yellow
    Write-Host "cd backend"
    Write-Host "python -m venv .venv"
    Write-Host ".\.venv\Scripts\python.exe -m pip install -r requirements.txt"
    exit 1
}

Set-Location (Join-Path $Root "backend")
& $Python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

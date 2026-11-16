# Selene Temple: starts the API (port 8000) and the site (port 5173) in two windows
# and opens the browser. Run scripts\setup-windows.ps1 once before this.
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.

$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $py)) { Write-Error 'Run scripts\setup-windows.ps1 first.'; exit 1 }

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\backend'; & '$py' -m uvicorn app.main:app --port 8000"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\frontend'; npm run dev"

Start-Sleep -Seconds 8
Start-Process 'http://localhost:5173'
Write-Host 'Two windows were opened (API and site). The badge at the top of the page should say "API: online". Close both windows to stop.'

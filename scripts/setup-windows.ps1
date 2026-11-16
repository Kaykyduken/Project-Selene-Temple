# Selene Temple: one-step setup of the live analysis tool on Windows.
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# Run from anywhere:   powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
# It installs Node.js and Python (with winget, if missing), finds the two LOLA files in
# Downloads and puts them in data\raw\dem, creates the Python environment and installs
# the packages for the API and the site. Run scripts\start-windows.ps1 afterwards.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-Tool($name, $args1) {
    try { & $name $args1 *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

# 1. Node.js and Python
$needRestart = $false
if (-not (Test-Tool 'node' '--version')) {
    Write-Host 'Installing Node.js LTS...'
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $needRestart = $true
}
if (-not (Test-Tool 'python' '--version')) {
    Write-Host 'Installing Python 3.12...'
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
    $needRestart = $true
}
if ($needRestart) {
    Write-Host ''
    Write-Host 'Programs installed. CLOSE this window, open a new PowerShell and run this script again.'
    exit 0
}

# 2. Terrain data (LOLA 20 m DEM): the .JP2 and its .LBL label must sit together in data\raw\dem
$demDir = Join-Path $root 'data\raw\dem'
New-Item -ItemType Directory -Force -Path $demDir | Out-Null
foreach ($name in 'LDEM_80S_20M.JP2', 'LDEM_80S_20M.LBL') {
    $target = Join-Path $demDir $name
    if (-not (Test-Path $target)) {
        $found = Get-ChildItem -Path (Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Desktop') -Recurse -Filter $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            Copy-Item $found.FullName $target
            Write-Host "Copied $name from $($found.DirectoryName)"
        } else {
            Write-Warning "$name not found in Downloads or Desktop. Put it in $demDir"
        }
    } else {
        Write-Host "$name already in place"
    }
}

# 3. API: Python environment and packages
$venv = Join-Path $root 'backend\.venv'
if (-not (Test-Path $venv)) { python -m venv $venv }
$py = Join-Path $venv 'Scripts\python.exe'
& $py -m pip install --upgrade pip
& $py -m pip install -r (Join-Path $root 'backend\requirements.txt') -r (Join-Path $root 'pipeline\requirements.txt')

# 4. Site: npm packages
Push-Location (Join-Path $root 'frontend')
npm install
Pop-Location

Write-Host ''
Write-Host 'Setup finished. Start everything with:  powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1'

#Requires -Version 5.1
<#
.SYNOPSIS
  OpenClaw MC – interactive one-liner installer for Windows
.DESCRIPTION
  Downloads, builds, and installs OpenClaw MC, sets up the oclawmc PowerShell
  CLI, optionally installs Tailscale, and registers a Windows service.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -c "irm <url>/scripts/install.ps1 | iex"
  # Non-interactive:
  & install.ps1 -NonInteractive
#>
[CmdletBinding()]
param(
  [switch]$NonInteractive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── constants ──────────────────────────────────────────────────────────────────
$RepoUrl    = if ([string]::IsNullOrWhiteSpace($env:REPO_URL)) { 'https://github.com/imadaitelarabi/openclaw-mc.git' } else { $env:REPO_URL }
$Branch     = if ([string]::IsNullOrWhiteSpace($env:BRANCH)) { 'master' } else { $env:BRANCH }
$ConfigDir  = Join-Path $env:USERPROFILE '.oclawmc'
$ConfigFile = Join-Path $ConfigDir 'config.json'

# ── helpers ───────────────────────────────────────────────────────────────────
function Write-Log   { param([string]$Msg) Write-Host "[openclaw-mc] $Msg" -ForegroundColor Cyan }
function Write-Warn  { param([string]$Msg) Write-Host "[openclaw-mc] $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[openclaw-mc] $Msg" -ForegroundColor Red }
function Write-Ok    { param([string]$Msg) Write-Host "[openclaw-mc] $Msg" -ForegroundColor Green }

function Prompt-Value {
  param([string]$Question, [string]$Default)
  if ($NonInteractive) { return $Default }
  $ans = Read-Host "? $Question [$Default]"
  if ([string]::IsNullOrWhiteSpace($ans)) { return $Default }
  return $ans
}

function Prompt-Bool {
  param([string]$Question, [bool]$Default = $true)
  if ($NonInteractive) { return $Default }
  $hint = if ($Default) { 'Y/n' } else { 'y/N' }
  $ans = Read-Host "? $Question [$hint]"
  if ([string]::IsNullOrWhiteSpace($ans)) { return $Default }
  return $ans -match '^[Yy]'
}

# ── Node.js check ─────────────────────────────────────────────────────────────
function Ensure-Node {
  $minMajor = 18
  $nodePath = Get-Command node -ErrorAction SilentlyContinue
  if ($nodePath) {
    $ver = (node -p 'process.versions.node' 2>$null).Trim()
    $major = [int]($ver -split '\.')[0]
    if ($major -ge $minMajor) {
      Write-Ok "Node.js $ver detected."
      return
    }
    Write-Warn "Node.js $ver detected but >= $minMajor required."
  }

  Write-Log "Attempting to install Node.js via winget…"
  $installed = $false
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    $installed = $true
  } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install nodejs-lts -y
    $installed = $true
  }

  if (-not $installed) {
    Write-Err "Cannot auto-install Node.js. Download from https://nodejs.org and re-run."
    exit 1
  }

  # Refresh PATH so node is available in this session
  $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('PATH', 'User')
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js still not available. Open a new terminal and re-run the installer."
    exit 1
  }
}

function Ensure-Git {
  if (Get-Command git -ErrorAction SilentlyContinue) { return }
  Write-Log "Installing git via winget…"
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('PATH', 'User')
  } else {
    Write-Err "git not found. Install from https://git-scm.com and re-run."
    exit 1
  }
}

# ── Tailscale ─────────────────────────────────────────────────────────────────
function Setup-Tailscale {
  Write-Host "`n── Tailscale setup ──" -ForegroundColor White
  $tsInstalled = [bool](Get-Command tailscale -ErrorAction SilentlyContinue)

  if (-not $tsInstalled) {
    Write-Warn "Tailscale is not installed."
    if (Prompt-Bool "Install Tailscale now?") {
      if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install Tailscale.Tailscale --silent --accept-package-agreements --accept-source-agreements
        $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
                    [System.Environment]::GetEnvironmentVariable('PATH', 'User')
      } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install tailscale -y
      } else {
        Write-Warn "Cannot auto-install Tailscale. Download from https://tailscale.com/download/windows"
        return
      }
    } else {
      Write-Warn "Skipping Tailscale setup."
      return
    }
  }

  Write-Ok "Tailscale is available."
  $tsStatus = tailscale status 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($tsStatus)) {
    if (Prompt-Bool "Run 'tailscale up' to connect this device?") {
      $authKey = Prompt-Value "Tailscale auth key (leave blank for browser login)" ""
      $tsArgs = @()
      if (Prompt-Bool "Enable Tailscale SSH (--ssh)?" $false) { $tsArgs += '--ssh' }
      $routes = Prompt-Value "Advertise routes (e.g. 192.168.1.0/24, blank to skip)" ""
      if ($routes) { $tsArgs += "--advertise-routes=$routes" }

      if ($authKey) {
        tailscale up --auth-key="$authKey" @tsArgs
      } else {
        tailscale up @tsArgs
      }
    }
  } else {
    Write-Ok "Tailscale already connected."
  }
}

# ── OpenClaw detection ────────────────────────────────────────────────────────
function Setup-OpenClaw {
  param([string]$InstallDir, [int]$Port)
  Write-Host "`n── OpenClaw Gateway setup ──" -ForegroundColor White

  $gwUrl = ''; $gwToken = ''

  if (Get-Command openclaw -ErrorAction SilentlyContinue) {
    Write-Ok "openclaw CLI detected."
    $status = openclaw status 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "openclaw gateway is running locally."
      $gwUrl = 'http://127.0.0.1:18789'
    } else {
      Write-Warn "openclaw installed but not running."
    }
  } else {
    Write-Warn "openclaw CLI not found."
    Write-Host "  Options:"
    Write-Host "  1) Install openclaw locally (npm global)"
    Write-Host "  2) Use a remote OpenClaw gateway"
    Write-Host "  3) Skip (configure later via UI)"
    $choice = Prompt-Value "Choose option" "3"
    switch ($choice) {
      '1' {
        Write-Log "Installing openclaw globally…"
        & cmd.exe /c "npm install -g openclaw 2>&1"
        if (Get-Command openclaw -ErrorAction SilentlyContinue) {
          Write-Ok "openclaw installed."
          $gwUrl = 'http://127.0.0.1:18789'
        } else {
          Write-Warn "Install failed. Try 'npm install -g openclaw' manually."
        }
      }
      '2' {
        $gwUrl   = Prompt-Value "Remote gateway URL" ""
        $gwToken = Prompt-Value "Gateway auth token" ""
      }
      default { Write-Log "Skipping. Configure from the UI." }
    }
  }

  if ($gwUrl) {
    $envFile = Join-Path $InstallDir '.env.local'
    $lines = @("OPENCLAW_GATEWAY_URL=$gwUrl")
    if ($gwToken)  { $lines += "OPENCLAW_GATEWAY_TOKEN=$gwToken" }
    $lines += "PORT=$Port"
    $lines | Set-Content -Path $envFile -Encoding UTF8
    Write-Ok "Gateway config written to $envFile"
  }
}

# ── repo management ────────────────────────────────────────────────────────────
function Fetch-Repo {
  param([string]$InstallDir)

  if (Test-Path (Join-Path $InstallDir '.git')) {
    $remote = git -C $InstallDir remote get-url origin 2>$null
    $canonical = $RepoUrl -replace '\.git$', ''
    if ($remote -eq $canonical -or $remote -eq "$canonical.git") {
      Write-Log "Updating existing installation at $InstallDir…"
      git -C $InstallDir fetch --all --prune
      git -C $InstallDir checkout $Branch
      git -C $InstallDir pull --ff-only origin $Branch
      return
    }
  }

  if (Test-Path $InstallDir) {
    $backup = "$InstallDir.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Write-Warn "$InstallDir exists but is not an openclaw-mc checkout. Backing up to $backup"
    Move-Item $InstallDir $backup
  }

  $parent = Split-Path $InstallDir -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Write-Log "Cloning repository into $InstallDir…"
  git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
}

function Build-App {
  param([string]$InstallDir)
  Push-Location $InstallDir
  try {
    Write-Log "Installing Node dependencies…"
    & cmd.exe /c "npm ci --legacy-peer-deps 2>&1"
    if ($LASTEXITCODE -ne 0) {
      Write-Warn "'npm ci' failed, falling back to 'npm install'…"
      & cmd.exe /c "npm install --legacy-peer-deps 2>&1"
      if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
      }
    }
    Write-Log "Building production bundle…"
    & cmd.exe /c "npm run build 2>&1"
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE"
    }
    Write-Ok "Build complete."
  } finally {
    Pop-Location
  }
}

# ── Windows service ───────────────────────────────────────────────────────────
function Setup-WindowsService {
  param([string]$InstallDir, [string]$LogPath, [int]$Port = 3000)

  $nodePath = (Get-Command node).Source
  $svcName  = 'OclawMC'
  $desc     = 'OpenClaw Mission Control Server'
  $binPath  = "`"$nodePath`" `"$InstallDir\dist\server\index.js`""

  # Check for nssm (preferred) then fall back to New-Service
  if (Get-Command nssm -ErrorAction SilentlyContinue) {
    Write-Log "Using nssm to create service '$svcName'…"
    nssm install $svcName $nodePath "$InstallDir\dist\server\index.js"
    nssm set $svcName AppDirectory $InstallDir
    nssm set $svcName AppEnvironmentExtra "NODE_ENV=production"
    nssm set $svcName AppStdout $LogPath
    nssm set $svcName AppStderr $LogPath
    nssm set $svcName Start SERVICE_AUTO_START
    nssm start $svcName
  } else {
    Write-Log "Registering Windows service '$svcName' via New-Service…"
    $existing = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($existing) {
      Stop-Service -Name $svcName -Force -ErrorAction SilentlyContinue
      sc.exe delete $svcName | Out-Null
      Start-Sleep -Seconds 2
    }
    New-Service -Name $svcName -BinaryPathName $binPath -DisplayName $desc `
                -Description $desc -StartupType Automatic | Out-Null
    Start-Service -Name $svcName
    Write-Log "Adding firewall rule for port $Port (if elevated)…"
    try {
      New-NetFirewallRule -DisplayName 'OclawMC' -Direction Inbound -Protocol TCP `
        -LocalPort $Port -Action Allow -ErrorAction Stop | Out-Null
    } catch { Write-Warn "Firewall rule not created (may require elevation)." }
  }
  Write-Ok "Windows service '$svcName' registered and started."
}

# ── CLI installation ───────────────────────────────────────────────────────────
function Install-CLI {
  param([string]$InstallDir, [string]$BinDir)

  $cliSrc = Join-Path $InstallDir 'scripts\oclawmc.ps1'
  if (-not (Test-Path $cliSrc)) {
    Write-Warn "oclawmc.ps1 not found at $cliSrc; skipping CLI install."
    return
  }

  if (-not (Test-Path $BinDir)) { New-Item -ItemType Directory -Path $BinDir -Force | Out-Null }

  # Copy the PowerShell script
  Copy-Item $cliSrc (Join-Path $BinDir 'oclawmc.ps1') -Force

  # Create a .cmd shim so 'oclawmc' works from cmd.exe as well
  $shim = Join-Path $BinDir 'oclawmc.cmd'
  "@echo off`r`npowershell -ExecutionPolicy Bypass -File `"%~dp0oclawmc.ps1`" %*" | Set-Content -Path $shim -Encoding ASCII

  # Add BinDir to user PATH if not already there
  $userPath = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
  if ($null -eq $userPath) { $userPath = '' }
  if ($userPath -notlike "*$BinDir*") {
    [System.Environment]::SetEnvironmentVariable('PATH', "$BinDir;$userPath", 'User')
    Write-Ok "Added $BinDir to user PATH (restart your terminal to pick it up)."
  }

  Write-Ok "oclawmc CLI installed to $BinDir"
}

function Write-Config {
  param([string]$InstallDir, [int]$Port, [string]$ServiceType)
  if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }
  @{
    install_dir  = $InstallDir
    port         = $Port
    branch       = $Branch
    service_type = $ServiceType
  } | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8
  Write-Ok "Config saved to $ConfigFile"
}

# ── main ───────────────────────────────────────────────────────────────────────
function Main {
  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
  Write-Host "  OpenClaw MC Installer (Windows)" -ForegroundColor White
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
  Write-Host ""

  # Collect user input
  Write-Host "── Installation options ──" -ForegroundColor White
  $InstallDir = Prompt-Value "Install directory" "C:\oclawmc"
  $Port       = [int](Prompt-Value "App port" "3000")
  $BinDir     = Prompt-Value "CLI directory (added to PATH)" "$env:USERPROFILE\.local\bin"
  $DoService  = Prompt-Bool "Register Windows service (auto-start on boot)?"
  $DoTailscale = Prompt-Bool "Set up Tailscale?"

  Ensure-Git
  Ensure-Node

  if ($DoTailscale) { Setup-Tailscale }

  Fetch-Repo -InstallDir $InstallDir
  Build-App  -InstallDir $InstallDir
  Setup-OpenClaw -InstallDir $InstallDir -Port $Port

  $serviceType = if ($DoService) { 'windows-service' } else { 'manual' }
  Write-Config -InstallDir $InstallDir -Port $Port -ServiceType $serviceType

  Install-CLI -InstallDir $InstallDir -BinDir $BinDir

  if ($DoService) {
    $logPath = Join-Path $ConfigDir 'oclawmc.log'
    Setup-WindowsService -InstallDir $InstallDir -LogPath $logPath -Port $Port
  } else {
    Write-Log "Skipping service setup. Run 'oclawmc start' to start manually."
  }

  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
  Write-Host "  OpenClaw MC installed successfully!" -ForegroundColor Green
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
  Write-Host "  App URL  : http://localhost:$Port"
  Write-Host "  CLI      : oclawmc <command>"
  Write-Host "  Commands : start | stop | restart | status | logs | update | doctor | uninstall"
  Write-Host ""
}

Main

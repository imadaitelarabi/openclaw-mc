#Requires -Version 5.1
<#
.SYNOPSIS
  oclawmc – OpenClaw MC cross-platform CLI (Windows PowerShell)
.DESCRIPTION
  Manages the OpenClaw MC server on Windows.
  Subcommands: start, daemon, stop, restart, status, logs, update,
               tailscale, doctor, uninstall, help
.EXAMPLE
  oclawmc status
  oclawmc tailscale up
  oclawmc logs 50
#>
[CmdletBinding()]
param(
  [Parameter(Position=0)][string]$Command = 'help',
  [Parameter(Position=1, ValueFromRemainingArguments=$true)][string[]]$Args = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── config ─────────────────────────────────────────────────────────────────────
$ConfigDir  = Join-Path $env:USERPROFILE '.oclawmc'
$ConfigFile = Join-Path $ConfigDir 'config.json'
$PidFile    = Join-Path $ConfigDir 'oclawmc.pid'
$LogFile    = Join-Path $ConfigDir 'oclawmc.log'
$ErrLogFile = Join-Path $ConfigDir 'oclawmc.err.log'

# ── helpers ────────────────────────────────────────────────────────────────────
function Write-Log  { param([string]$Msg) Write-Host "[oclawmc] $Msg" -ForegroundColor Cyan }
function Write-Warn { param([string]$Msg) Write-Host "[oclawmc] $Msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$Msg) Write-Host "[oclawmc] $Msg" -ForegroundColor Red }
function Write-Ok   { param([string]$Msg) Write-Host "[oclawmc] $Msg" -ForegroundColor Green }

# ── config access ─────────────────────────────────────────────────────────────
$Config = $null

function Load-Config {
  if (-not (Test-Path $ConfigFile)) {
    Write-Err "Config not found at $ConfigFile. Run the installer first."
    exit 1
  }
  $script:Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
}

function Get-InstallDir  { $script:Config.install_dir }
function Get-Port        { $script:Config.port }
function Get-ServiceType { $script:Config.service_type }
function Get-Branch      { if ($script:Config.PSObject.Properties['branch']) { $script:Config.branch } else { 'master' } }

# ── process helpers ────────────────────────────────────────────────────────────
function Is-Running {
  if (-not (Test-Path $PidFile)) { return $false }
  $pid = Get-Content $PidFile -ErrorAction SilentlyContinue
  if (-not $pid) { return $false }
  $proc = Get-Process -Id ([int]$pid) -ErrorAction SilentlyContinue
  return $null -ne $proc
}

function Stop-OclawProcess {
  if (Test-Path $PidFile) {
    $pid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($pid) {
      $proc = Get-Process -Id ([int]$pid) -ErrorAction SilentlyContinue
      if ($proc) {
        Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
        Write-Ok "Process $pid stopped."
      }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

# ── env loading ───────────────────────────────────────────────────────────────
function Load-Env {
  $envFile = Join-Path (Get-InstallDir) '.env.local'
  if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^[^#].*=.*' } | ForEach-Object {
      $parts = $_ -split '=', 2
      if ($parts.Count -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
      }
    }
  }
}

# ── subcommands ───────────────────────────────────────────────────────────────
function Cmd-Start {
  Load-Config; Load-Env
  $installDir = Get-InstallDir
  Write-Log "Starting OpenClaw MC in foreground (Ctrl+C to stop)…"
  $env:NODE_ENV = 'production'
  Set-Location $installDir
  & node (Join-Path $installDir 'dist\server\index.js')
}

function Cmd-Daemon {
  Load-Config
  if (Is-Running) {
    Write-Warn "OpenClaw MC is already running (PID $(Get-Content $PidFile))."
    return
  }
  Load-Env
  if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }
  $installDir = Get-InstallDir
  $env:NODE_ENV = 'production'
  Write-Log "Starting OpenClaw MC in background…"
  $proc = Start-Process node -ArgumentList (Join-Path $installDir 'dist\server\index.js') `
    -WorkingDirectory $installDir `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError  $ErrLogFile `
    -PassThru -WindowStyle Hidden
  $proc.Id | Set-Content $PidFile
  Start-Sleep -Seconds 1
  if (-not $proc.HasExited) {
    Write-Ok "OpenClaw MC started (PID $($proc.Id)). Logs: $LogFile (stdout), $ErrLogFile (stderr)"
  } else {
    Write-Err "Process exited immediately. Check logs: $LogFile and $ErrLogFile"
    exit 1
  }
}

function Cmd-Stop {
  Load-Config
  $svcType = Get-ServiceType
  if ($svcType -eq 'windows-service') {
    $svc = Get-Service -Name 'OclawMC' -ErrorAction SilentlyContinue
    if ($svc) { Stop-Service -Name 'OclawMC' -Force; Write-Ok "Service stopped." }
    else { Write-Warn "Service 'OclawMC' not found." }
  } else {
    if (Is-Running) { Stop-OclawProcess }
    else { Write-Warn "OpenClaw MC is not running." }
  }
}

function Cmd-Restart {
  Cmd-Stop
  Start-Sleep -Seconds 1
  Load-Config
  $svcType = Get-ServiceType
  if ($svcType -eq 'windows-service') {
    Start-Service -Name 'OclawMC'
    Write-Ok "Service started."
  } else {
    Cmd-Daemon
  }
}

function Cmd-Status {
  Load-Config
  Write-Host "`nOpenClaw MC status" -ForegroundColor White
  Write-Host "  Install dir : $(Get-InstallDir)"
  Write-Host "  Port        : $(Get-Port)"
  Write-Host "  Service     : $(Get-ServiceType)"
  Write-Host ""

  $svcType = Get-ServiceType
  if ($svcType -eq 'windows-service') {
    Write-Host "Service (Windows):" -ForegroundColor White
    $svc = Get-Service -Name 'OclawMC' -ErrorAction SilentlyContinue
    if ($svc) {
      Write-Host "  Status: $($svc.Status)"
    } else {
      Write-Warn "Service 'OclawMC' not found."
    }
  } else {
    if (Is-Running) {
      Write-Ok "Process running (PID $(Get-Content $PidFile))."
    } else {
      Write-Warn "Process not running."
    }
  }

  Write-Host "`nTailscale:" -ForegroundColor White
  if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    tailscale status 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Warn "Tailscale not connected." }
  } else {
    Write-Warn "Tailscale not installed."
  }
}

function Cmd-Logs {
  Load-Config
  $lines = if ($Args.Count -gt 0) { [int]$Args[0] } else { 100 }
  $svcType = Get-ServiceType
  if ((Test-Path $LogFile) -or (Test-Path $ErrLogFile)) {
    Write-Host "Tailing stdout: $LogFile" -ForegroundColor White
    if (Test-Path $ErrLogFile) {
      Write-Host "Tailing stderr: $ErrLogFile" -ForegroundColor White
    }
    $targets = @()
    if (Test-Path $LogFile) { $targets += $LogFile }
    if (Test-Path $ErrLogFile) { $targets += $ErrLogFile }
    Get-Content $targets -Tail $lines -Wait
  } elseif ($svcType -eq 'windows-service') {
    Write-Warn "Use Windows Event Viewer or check the service log path."
  } else {
    Write-Warn "No log file found at $LogFile"
  }
}

function Cmd-Update {
  Load-Config
  $installDir = Get-InstallDir
  $branch     = Get-Branch
  Write-Log "Pulling latest changes from $branch…"
  git -C $installDir fetch --all --prune
  git -C $installDir checkout $branch
  git -C $installDir pull --ff-only origin $branch

  Write-Log "Reinstalling dependencies…"
  Push-Location $installDir
  try {
    & cmd.exe /c "npm ci --legacy-peer-deps 2>&1"
    if ($LASTEXITCODE -ne 0) {
      & cmd.exe /c "npm install --legacy-peer-deps 2>&1"
      if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
      }
    }
    Write-Log "Rebuilding…"
    & cmd.exe /c "npm run build 2>&1"
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE"
    }
  } finally { Pop-Location }

  Write-Ok "Update complete. Restarting…"
  Cmd-Restart
}

function Cmd-Tailscale {
  $sub = if ($Args.Count -gt 0) { $Args[0] } else { 'status' }
  switch ($sub) {
    'status' { tailscale status }
    'up'     { $rest = $Args[1..($Args.Length-1)]; tailscale up @rest }
    'down'   { tailscale down }
    default  { Write-Err "Unknown tailscale subcommand: $sub. Use status|up|down."; exit 1 }
  }
}

function Cmd-Doctor {
  Load-Config; Load-Env
  $installDir = Get-InstallDir
  $okCount = 0; $failCount = 0

  Write-Host "`nOpenClaw MC doctor`n" -ForegroundColor White

  # Node.js
  if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Ok "Node.js: $(node --version)"
    $okCount++
  } else {
    Write-Err "Node.js: not found"
    $failCount++
  }

  # Build artifacts
  $serverJs = Join-Path $installDir 'dist\server\index.js'
  if (Test-Path $serverJs) {
    Write-Ok "Build: dist\server\index.js exists"
    $okCount++
  } else {
    Write-Err "Build: dist\server\index.js not found (run 'oclawmc update' or rebuild)"
    $failCount++
  }

  # Port check
  $port = Get-Port
  $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listening) {
    Write-Ok "Port $port`: in use (app may already be running)"
    $okCount++
  } else {
    Write-Warn "Port $port`: not in use (app not running?)"
  }

  # Gateway URL
  $gwUrl = [System.Environment]::GetEnvironmentVariable('OPENCLAW_GATEWAY_URL', 'Process')
  if ($gwUrl) {
    Write-Ok "Gateway URL: $gwUrl"
    $okCount++
  } else {
    Write-Warn "Gateway URL: not configured (set OPENCLAW_GATEWAY_URL in $(Get-InstallDir)\.env.local)"
  }

  # Gateway token
  $gwToken = [System.Environment]::GetEnvironmentVariable('OPENCLAW_GATEWAY_TOKEN', 'Process')
  if ($gwToken) {
    Write-Ok "Gateway token: configured (***masked***)"
    $okCount++
  } else {
    Write-Warn "Gateway token: not configured (set OPENCLAW_GATEWAY_TOKEN in $(Get-InstallDir)\.env.local)"
  }

  # Tailscale
  if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    tailscale status 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "Tailscale: connected"
      $okCount++
    } else {
      Write-Warn "Tailscale: installed but not connected (run 'oclawmc tailscale up')"
    }
  } else {
    Write-Warn "Tailscale: not installed (optional)"
  }

  Write-Host "`nResult: $okCount OK  $failCount FAIL`n"
  if ($failCount -gt 0) { exit 1 }
}

function Cmd-Uninstall {
  Load-Config
  Write-Host "This will stop OpenClaw MC and remove the CLI." -ForegroundColor Red
  $ans = Read-Host "? Continue? [y/N]"
  if ($ans -notmatch '^[Yy]') { Write-Log "Uninstall cancelled."; return }

  $svcType = Get-ServiceType
  if ($svcType -eq 'windows-service') {
    $svc = Get-Service -Name 'OclawMC' -ErrorAction SilentlyContinue
    if ($svc) {
      Stop-Service -Name 'OclawMC' -Force -ErrorAction SilentlyContinue
      sc.exe delete 'OclawMC' | Out-Null
      Write-Ok "Windows service removed."
    }
  } else {
    Stop-OclawProcess 2>$null
  }

  # Remove CLI from common locations
  $binDirs = @(
    (Join-Path $env:USERPROFILE '.local\bin'),
    'C:\oclawmc\bin',
    (Join-Path $env:ProgramFiles 'oclawmc')
  )
  foreach ($bd in $binDirs) {
    $ps1  = Join-Path $bd 'oclawmc.ps1'
    $cmd  = Join-Path $bd 'oclawmc.cmd'
    if (Test-Path $ps1)  { Remove-Item $ps1  -Force; Write-Ok "Removed $ps1" }
    if (Test-Path $cmd)  { Remove-Item $cmd  -Force; Write-Ok "Removed $cmd" }
  }

  $ans = Read-Host "? Delete config directory $ConfigDir? [y/N]"
  if ($ans -match '^[Yy]') {
    Remove-Item $ConfigDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Ok "Config directory removed."
  }

  $installDir = Get-InstallDir
  $ans = Read-Host "? Delete installation directory $installDir? [y/N]"
  if ($ans -match '^[Yy]') {
    Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Ok "Installation directory removed."
  }

  Write-Ok "Uninstall complete."
}

function Show-Usage {
  Write-Host "Usage: oclawmc <command> [args]" -ForegroundColor White
  Write-Host ""
  Write-Host "Commands:" -ForegroundColor White
  Write-Host "  start                   Start in foreground"
  Write-Host "  daemon                  Start in background"
  Write-Host "  stop                    Stop the running server"
  Write-Host "  restart                 Restart the server"
  Write-Host "  status                  Show server + Tailscale status"
  Write-Host "  logs [lines]            Tail log output (default 100 lines)"
  Write-Host "  update                  Pull latest, rebuild, and restart"
  Write-Host "  tailscale <status|up|down>"
  Write-Host "                          Manage Tailscale connection"
  Write-Host "  doctor                  Run preflight health checks"
  Write-Host "  uninstall               Remove service, CLI, and optionally data"
  Write-Host "  help                    Show this message"
  Write-Host ""
}

# ── dispatch ──────────────────────────────────────────────────────────────────
switch ($Command) {
  'start'     { Cmd-Start }
  'daemon'    { Cmd-Daemon }
  'stop'      { Cmd-Stop }
  'restart'   { Cmd-Restart }
  'status'    { Cmd-Status }
  'logs'      { Cmd-Logs }
  'update'    { Cmd-Update }
  'tailscale' { Cmd-Tailscale }
  'doctor'    { Cmd-Doctor }
  'uninstall' { Cmd-Uninstall }
  { $_ -in 'help', '-h', '--help' } { Show-Usage }
  default {
    Write-Err "Unknown command: $Command"
    Show-Usage
    exit 1
  }
}

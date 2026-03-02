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
  $processIdValue = Get-Content $PidFile -ErrorAction SilentlyContinue
  if (-not $processIdValue) { return $false }
  $proc = Get-Process -Id ([int]$processIdValue) -ErrorAction SilentlyContinue
  return $null -ne $proc
}

function Stop-OclawProcess {
  if (Test-Path $PidFile) {
    $processIdValue = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($processIdValue) {
      $proc = Get-Process -Id ([int]$processIdValue) -ErrorAction SilentlyContinue
      if ($proc) {
        Stop-Process -Id ([int]$processIdValue) -Force -ErrorAction SilentlyContinue
        Write-Ok "Process $processIdValue stopped."
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
  Write-Log "Starting OpenClaw MC in foreground (Ctrl+C to stop)..."
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
  Write-Log "Starting OpenClaw MC in background..."
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
    try {
      Start-Service -Name 'OclawMC' -ErrorAction Stop
      Write-Ok "Service started."
    } catch {
      Write-Err "Service failed to start: $($_.Exception.Message)"
      $svc = Get-Service -Name 'OclawMC' -ErrorAction SilentlyContinue
      if ($svc) {
        Write-Warn "Service status: $($svc.Status)"
      }
      $event = Get-WinEvent -FilterHashtable @{
        LogName = 'System'
        ProviderName = 'Service Control Manager'
        StartTime = (Get-Date).AddMinutes(-10)
      } -ErrorAction SilentlyContinue | Where-Object { $_.Message -like '*OclawMC*' } | Select-Object -First 1
      if ($event) {
        $eventMsg = ($event.Message -replace "`r`n", ' ')
        Write-Warn "Recent SCM event: $eventMsg"
      }
      Write-Warn "Run 'Get-WinEvent -LogName Application -MaxEvents 100 | ? Message -like \"*OclawMC*\"' for app startup errors."
      exit 1
    }
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
  Write-Log "Pulling latest changes from $branch..."
  git -C $installDir fetch --all --prune
  git -C $installDir checkout $branch
  git -C $installDir pull --ff-only origin $branch

  Write-Log "Reinstalling dependencies..."
  Push-Location $installDir
  try {
    & cmd.exe /c "npm ci --legacy-peer-deps 2>&1"
    if ($LASTEXITCODE -ne 0) {
      & cmd.exe /c "npm install --legacy-peer-deps 2>&1"
      if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
      }
    }
    Write-Log "Rebuilding..."
    & cmd.exe /c "npm run build 2>&1"
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE"
    }
  } finally { Pop-Location }

  Write-Ok "Update complete. Restarting..."
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

# ── openclaw subcommand ────────────────────────────────────────────────────────

function Get-OclawConfig {
  if ($env:OPENCLAW_CONFIG_PATH -and (Test-Path $env:OPENCLAW_CONFIG_PATH)) {
    return $env:OPENCLAW_CONFIG_PATH
  }
  if (Get-Command openclaw -ErrorAction SilentlyContinue) {
    $cfg = openclaw config path 2>$null
    if ($cfg -and (Test-Path $cfg)) { return $cfg }
  }
  $candidates = @(
    (Join-Path $env:USERPROFILE '.openclaw\config.yaml'),
    (Join-Path ($env:XDG_CONFIG_HOME ?? (Join-Path $env:USERPROFILE '.config')) 'openclaw\config.yaml'),
    'C:\ProgramData\openclaw\config.yaml'
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}

function Invoke-OcYamlPatch {
  param([string]$ConfigFile, [string]$Op, [string[]]$OpArgs = @())
  if (-not (Get-Command python3 -ErrorAction SilentlyContinue) -and
      -not (Get-Command python  -ErrorAction SilentlyContinue)) {
    Write-Err "python3 is required to modify the OpenClaw config."
    exit 1
  }
  $py = if (Get-Command python3 -ErrorAction SilentlyContinue) { 'python3' } else { 'python' }
  $pyScript = @'
import sys, os
config_file = sys.argv[1]; op = sys.argv[2]; args = sys.argv[3:]
try:
    import yaml
except ImportError:
    print("Error: PyYAML not installed. Run: pip3 install pyyaml", file=sys.stderr); sys.exit(2)
try:
    with open(config_file, 'r') as f: data = yaml.safe_load(f) or {}
except FileNotFoundError: data = {}
def deep_get(d, keys, default=None):
    for k in keys:
        if not isinstance(d, dict) or k not in d: return default
        d = d[k]
    return d
def deep_set(d, keys, value):
    for k in keys[:-1]:
        if k not in d or not isinstance(d[k], dict): d[k] = {}
        d = d[k]
    d[keys[-1]] = value
if op == 'add_origin':
    origin = args[0]; origins = deep_get(data, ['gateway','controlUi','allowedOrigins'], [])
    if not isinstance(origins, list): origins = []
    if origin not in origins:
        origins.append(origin); deep_set(data, ['gateway','controlUi','allowedOrigins'], origins)
        print(f"Added origin: {origin}")
    else: print(f"Origin already present (no change): {origin}"); sys.exit(0)
elif op == 'clear_origins':
    deep_set(data, ['gateway','controlUi','allowedOrigins'], []); print("Cleared allowedOrigins.")
elif op == 'set_basepath':
    path = args[0]; deep_set(data, ['gateway','controlUi','basePath'], path); print(f"Set basePath: {path}")
elif op == 'get_info':
    origins = deep_get(data, ['gateway','controlUi','allowedOrigins'], [])
    base_path = deep_get(data, ['gateway','controlUi','basePath'], None)
    print(f"  allowedOrigins : {origins if origins else '(none)'}")
    print(f"  basePath       : {base_path if base_path else '(not set)'}"); sys.exit(0)
else: print(f"Unknown op: {op}", file=sys.stderr); sys.exit(1)
os.makedirs(os.path.dirname(os.path.abspath(config_file)), exist_ok=True)
with open(config_file, 'w') as f: yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
'@
  $allArgs = @($ConfigFile, $Op) + $OpArgs
  & $py -c $pyScript @allArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Assert-OcValidOrigin {
  param([string]$Origin)
  $o = $Origin.TrimEnd('/')
  if ($o -notmatch '^https?://') {
    Write-Err "Invalid origin '$o': must start with http:// or https://"
    exit 1
  }
  return $o
}

function Assert-OcValidPath {
  param([string]$Path)
  if ($Path -notmatch '^/') {
    Write-Err "Invalid path '$Path': must start with /"
    exit 1
  }
  if ($Path -ne '/') { $Path = $Path.TrimEnd('/') }
  return $Path
}

function Invoke-OcTailscale {
  param([string]$Mode, [string]$SetPath = '/', [string]$Target = '')
  if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
    Write-Err "Tailscale is not installed. See https://tailscale.com/download"
    exit 1
  }
  switch ($Mode) {
    'off' {
      Write-Log "Removing Tailscale serve configuration..."
      tailscale serve reset 2>$null
      Write-Ok "Tailscale serve disabled."
    }
    { $_ -in 'serve','funnel' } {
      Load-Config
      $port   = if (Get-Port) { Get-Port } else { 3000 }
      $mcUrl  = if ($Target) { $Target } else { "http://localhost:$port" }
      Write-Log "Configuring Tailscale ${Mode}: path=${SetPath} -> ${mcUrl}"
      if ($Mode -eq 'funnel') {
        tailscale funnel --set-path $SetPath $mcUrl
      } else {
        tailscale serve --set-path $SetPath $mcUrl
      }
      if ($LASTEXITCODE -ne 0) { Write-Err "tailscale $Mode failed."; exit 1 }
      Write-Ok "Tailscale ${Mode} active: ${SetPath} -> ${mcUrl}"
    }
  }
}

function Show-OclawUsage {
  Write-Host "Usage: oclawmc openclaw <subcommand> [flags]" -ForegroundColor White
  Write-Host ""
  Write-Host "Subcommands:" -ForegroundColor White
  Write-Host "  setup    Configure gateway.controlUi settings"
  Write-Host "  status   Show current OpenClaw Gateway configuration"
  Write-Host "  doctor   Run health checks (--fix to auto-remediate)"
  Write-Host ""
  Write-Host "Setup flags:" -ForegroundColor White
  Write-Host "  --origin <url>             Add to allowedOrigins (repeatable, deduped)"
  Write-Host "  --clear-origins            Clear all allowedOrigins"
  Write-Host "  --base-path <path>         Set gateway.controlUi.basePath"
  Write-Host "  --tailscale <mode>         Configure Tailscale: off|serve|funnel"
  Write-Host "  --tailscale-set-path <p>   Path prefix for Tailscale mapping"
  Write-Host "  --tailscale-target <url>   Override local target URL"
  Write-Host "  --restart-gateway          Restart gateway after changes"
  Write-Host "  --non-interactive          Disable all interactive prompts"
  Write-Host "  --yes                      Auto-confirm prompts"
  Write-Host "  --json                     Output result as JSON"
  Write-Host ""
  Write-Host "Examples:" -ForegroundColor White
  Write-Host "  oclawmc openclaw setup --origin https://mc.example.com"
  Write-Host "  oclawmc openclaw setup --base-path /mc --tailscale serve --tailscale-set-path /mc"
  Write-Host "  oclawmc openclaw setup --origin https://mc.example.com --non-interactive --yes --json"
  Write-Host "  oclawmc openclaw doctor --fix"
  Write-Host "  oclawmc openclaw status"
  Write-Host ""
}

function Cmd-Openclaw {
  $sub = if ($Args.Count -gt 0) { $Args[0] } else { 'help' }
  $rest = if ($Args.Count -gt 1) { $Args[1..($Args.Length - 1)] } else { @() }

  switch ($sub) {
    'setup' {
      $origins = @(); $clearOrigins = $false; $basePath = ''
      $tsMode = ''; $tsSetPath = '/'; $tsTarget = ''
      $restartGw = $false; $nonInteractive = $false; $yesFlag = $false; $jsonOut = $false

      $i = 0
      while ($i -lt $rest.Count) {
        switch ($rest[$i]) {
          '--origin'             { $origins += $rest[$i+1]; $i += 2 }
          '--clear-origins'      { $clearOrigins = $true; $i++ }
          '--base-path'          { $basePath = $rest[$i+1]; $i += 2 }
          '--tailscale'          { $tsMode = $rest[$i+1]; $i += 2 }
          '--tailscale-set-path' { $tsSetPath = $rest[$i+1]; $i += 2 }
          '--tailscale-target'   { $tsTarget = $rest[$i+1]; $i += 2 }
          '--restart-gateway'    { $restartGw = $true; $i++ }
          '--non-interactive'    { $nonInteractive = $true; $i++ }
          { $_ -in '--yes','-y' }{ $yesFlag = $true; $i++ }
          '--json'               { $jsonOut = $true; $i++ }
          default { Write-Err "Unknown flag: $($rest[$i])"; exit 1 }
        }
      }

      # Validate origins
      $normOrigins = @()
      foreach ($o in $origins) { $normOrigins += Assert-OcValidOrigin $o }

      # Validate base path
      if ($basePath) { $basePath = Assert-OcValidPath $basePath }

      # Validate tailscale mode
      if ($tsMode -and $tsMode -notin @('off','serve','funnel')) {
        Write-Err "--tailscale must be one of: off, serve, funnel"; exit 1
      }

      # Find config
      $configFile = Get-OclawConfig
      if (-not $configFile) {
        if ($jsonOut) {
          Write-Host '{"status":"error","error":"OpenClaw Gateway config not found."}'
        } else {
          Write-Err "OpenClaw Gateway config not found."
          Write-Warn "Searched: %USERPROFILE%\.openclaw\config.yaml and common paths."
          Write-Warn "Override with: `$env:OPENCLAW_CONFIG_PATH = 'C:\path\to\config.yaml'"
        }
        exit 1
      }

      $changed = $false

      if ($clearOrigins) {
        $confirmed = $yesFlag -or $nonInteractive
        if (-not $confirmed) {
          $ans = Read-Host "? Clear all allowedOrigins in $configFile? [y/N]"
          $confirmed = $ans -match '^[Yy]'
        }
        if ($confirmed) { Invoke-OcYamlPatch $configFile 'clear_origins'; $changed = $true }
      }

      foreach ($origin in $normOrigins) {
        Invoke-OcYamlPatch $configFile 'add_origin' @($origin); $changed = $true
      }

      if ($basePath) { Invoke-OcYamlPatch $configFile 'set_basepath' @($basePath); $changed = $true }

      if ($tsMode) { Invoke-OcTailscale $tsMode $tsSetPath $tsTarget; $changed = $true }

      if ($restartGw -and $changed) {
        if (Get-Command openclaw -ErrorAction SilentlyContinue) {
          Write-Log "Restarting OpenClaw Gateway..."
          openclaw restart 2>$null
          if ($LASTEXITCODE -ne 0) { Write-Warn "Could not restart gateway; restart it manually." }
        } else {
          Write-Warn "openclaw CLI not found; restart the gateway manually to apply changes."
        }
      }

      if ($jsonOut) {
        $out = [ordered]@{status='ok'; config=$configFile; changed=$changed}
        Write-Host ($out | ConvertTo-Json -Compress)
      } else {
        Write-Ok "Setup complete. Config: $configFile"
        if (-not $changed) { Write-Warn "No changes made (no flags provided)." }
      }
    }

    'status' {
      $jsonOut = $rest -contains '--json'
      $configFile = Get-OclawConfig
      if (-not $configFile) {
        if ($jsonOut) { Write-Host '{"status":"error","error":"OpenClaw Gateway config not found."}' }
        else { Write-Warn "OpenClaw Gateway config not found." }
        return
      }
      if ($jsonOut) {
        Invoke-OcYamlPatch $configFile 'get_info'
      } else {
        Write-Host "`nOpenClaw Gateway config: $configFile`n" -ForegroundColor White
        Invoke-OcYamlPatch $configFile 'get_info'
        Write-Host ""
      }
    }

    'doctor' {
      $fix     = $rest -contains '--fix'
      $jsonOut = $rest -contains '--json'
      $okCount = 0; $failCount = 0
      $checks  = @()

      function Add-Check { param($Label, $Status, $Detail)
        $checks += [PSCustomObject]@{label=$Label;status=$Status;detail=$Detail}
        if ($Status -eq 'ok')   { $script:okCount++;   if (-not $jsonOut) { Write-Ok   "$Label`: $Detail" } }
        elseif ($Status -eq 'fail') { $script:failCount++; if (-not $jsonOut) { Write-Err  "$Label`: $Detail" } }
        else { if (-not $jsonOut) { Write-Warn "$Label`: $Detail" } }
      }

      if (-not $jsonOut) { Write-Host "`nOpenClaw doctor`n" -ForegroundColor White }

      if (Get-Command openclaw -ErrorAction SilentlyContinue) {
        $ver = openclaw --version 2>$null
        Add-Check 'openclaw CLI' 'ok' "found ($ver)"
      } else { Add-Check 'openclaw CLI' 'warn' 'not found (optional)' }

      $configFile = Get-OclawConfig
      if ($configFile) { Add-Check 'Config file' 'ok' $configFile }
      else { Add-Check 'Config file' 'fail' 'not found' }

      if (Get-Command tailscale -ErrorAction SilentlyContinue) {
        tailscale status 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { Add-Check 'Tailscale' 'ok' 'connected' }
        else { Add-Check 'Tailscale' 'warn' 'installed but not connected' }
      } else { Add-Check 'Tailscale' 'warn' 'not installed (optional)' }

      $pyCmd = if (Get-Command python3 -ErrorAction SilentlyContinue) { 'python3' }
               elseif (Get-Command python -ErrorAction SilentlyContinue) { 'python' }
               else { $null }
      if ($pyCmd) {
        & $pyCmd -c "import yaml" 2>$null
        if ($LASTEXITCODE -eq 0) { Add-Check 'python3+PyYAML' 'ok' 'available' }
        else {
          Add-Check 'python3+PyYAML' 'warn' 'python found but PyYAML missing (run: pip3 install pyyaml)'
          if ($fix) { Write-Log "Installing PyYAML..."; & $pyCmd -m pip install --user pyyaml 2>$null }
        }
      } else { Add-Check 'python3+PyYAML' 'warn' 'python not found (needed for config editing)' }

      if ($jsonOut) {
        $json = [ordered]@{checks=@($checks|ForEach-Object{[ordered]@{label=$_.label;status=$_.status;detail=$_.detail}});ok_count=$okCount;fail_count=$failCount}
        Write-Host ($json | ConvertTo-Json -Compress)
      } else {
        Write-Host "`nResult: $okCount OK  $failCount FAIL`n"
      }
      if ($failCount -gt 0) { exit 1 }
    }

    { $_ -in 'help','-h','--help' } { Show-OclawUsage }

    default {
      Write-Err "Unknown openclaw subcommand: $sub"
      Show-OclawUsage
      exit 1
    }
  }
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
  Write-Host "  openclaw <setup|status|doctor>"
  Write-Host "                          Configure OpenClaw Gateway integration"
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
  'openclaw'  { Cmd-Openclaw }
  'doctor'    { Cmd-Doctor }
  'uninstall' { Cmd-Uninstall }
  { $_ -in 'help', '-h', '--help' } { Show-Usage }
  default {
    Write-Err "Unknown command: $Command"
    Show-Usage
    exit 1
  }
}

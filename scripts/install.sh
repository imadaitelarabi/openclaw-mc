#!/usr/bin/env bash
# OpenClaw MC – interactive one-liner installer
# Usage: curl -fsSL <url>/scripts/install.sh | bash
#        or: bash install.sh [--non-interactive]
set -euo pipefail

# ── constants ──────────────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/imadaitelarabi/openclaw-mc.git}"
BRANCH="${BRANCH:-master}"
MIN_NODE_MAJOR="18"
TARGET_NODE_MAJOR="20"
CONFIG_DIR="${HOME}/.oclawmc"
CONFIG_FILE="${CONFIG_DIR}/config.json"
SCRIPT_NAME="oclawmc"

NON_INTERACTIVE=false
for arg in "$@"; do
  [[ "$arg" == "--non-interactive" ]] && NON_INTERACTIVE=true
done

# ── colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

log()  { printf "${BLUE}[openclaw-mc]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[openclaw-mc]${NC} %s\n" "$*"; }
err()  { printf "${RED}[openclaw-mc]${NC} %s\n" "$*" >&2; }
ok()   { printf "${GREEN}[openclaw-mc]${NC} %s\n" "$*"; }
banner() {
  printf "\n${BOLD}%s${NC}\n" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "${BOLD}  OpenClaw MC Installer${NC}\n"
  printf "${BOLD}%s${NC}\n\n" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ── sudo helper ────────────────────────────────────────────────────────────────
SUDO=""
if [[ "${EUID:-$(id -u)}" -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi
run_with_sudo() { [[ -n "$SUDO" ]] && $SUDO "$@" || "$@"; }

# ── prompt helper ──────────────────────────────────────────────────────────────
# Read input from the controlling terminal when available.
# This is required for one-liner installs (curl ... | bash), where stdin is the
# script stream and not user input.
read_user_input() {
  local __var_name="$1" __prompt="$2"
  local __answer=""

  if [[ -r /dev/tty ]]; then
    IFS= read -r -p "$__prompt" __answer </dev/tty || __answer=""
  else
    IFS= read -r -p "$__prompt" __answer || __answer=""
  fi

  printf -v "$__var_name" '%s' "$__answer"
}

# prompt <var_name> <question> <default>
prompt() {
  local var="$1" question="$2" default="$3"
  if [[ "$NON_INTERACTIVE" == true ]]; then
    printf -v "$var" '%s' "$default"
    return
  fi
  local answer
  read_user_input answer "$(printf "${BOLD}?${NC} ${question} [${GREEN}${default}${NC}]: ")"
  printf -v "$var" '%s' "${answer:-$default}"
}

# prompt_yn <question> <default y|n>  → returns 0 for yes, 1 for no
prompt_yn() {
  local question="$1" default="$2"
  if [[ "$NON_INTERACTIVE" == true ]]; then
    [[ "$default" == "y" ]] && return 0 || return 1
  fi
  local answer
  local hint; [[ "$default" == "y" ]] && hint="Y/n" || hint="y/N"
  read_user_input answer "$(printf "${BOLD}?${NC} ${question} [${hint}]: ")"
  answer="${answer:-$default}"
  [[ "${answer,,}" == "y" || "${answer,,}" == "yes" ]]
}

# ── package-manager detection ──────────────────────────────────────────────────
detect_pkg_manager() {
  command -v apt-get >/dev/null 2>&1 && { echo "apt";    return; }
  command -v dnf     >/dev/null 2>&1 && { echo "dnf";    return; }
  command -v yum     >/dev/null 2>&1 && { echo "yum";    return; }
  command -v pacman  >/dev/null 2>&1 && { echo "pacman"; return; }
  command -v brew    >/dev/null 2>&1 && { echo "brew";   return; }
  echo "none"
}

# ── base tools ────────────────────────────────────────────────────────────────
install_base_tools() {
  local pm="$1"
  case "$pm" in
    apt)    run_with_sudo apt-get update -qq; run_with_sudo apt-get install -y git curl ca-certificates ;;
    dnf)    run_with_sudo dnf install -y git curl ca-certificates ;;
    yum)    run_with_sudo yum install -y git curl ca-certificates ;;
    pacman) run_with_sudo pacman -Sy --noconfirm git curl ca-certificates ;;
    brew)   brew install git curl ;;
    *)      err "No supported package manager found. Please install git and curl manually."; exit 1 ;;
  esac
}

# ── Node.js ────────────────────────────────────────────────────────────────────
install_or_upgrade_node() {
  local pm="$1"
  case "$pm" in
    apt)
      curl -fsSL "https://deb.nodesource.com/setup_${TARGET_NODE_MAJOR}.x" | run_with_sudo -E bash -
      run_with_sudo apt-get install -y nodejs
      ;;
    dnf|yum)
      curl -fsSL "https://rpm.nodesource.com/setup_${TARGET_NODE_MAJOR}.x" | run_with_sudo bash -
      run_with_sudo "$pm" install -y nodejs
      ;;
    pacman) run_with_sudo pacman -Sy --noconfirm nodejs npm ;;
    brew)   brew install node ;;
    *)
      err "Cannot auto-install Node.js on this system. Install Node.js >= ${MIN_NODE_MAJOR} and re-run."
      exit 1
      ;;
  esac
}

ensure_cmds() {
  local pm; pm="$(detect_pkg_manager)"

  if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    log "Installing missing base tools (git/curl)…"
    install_base_tools "$pm"
  fi

  local install_node=false
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    install_node=true
  else
    local node_major
    node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [[ "$node_major" -lt "$MIN_NODE_MAJOR" ]]; then
      warn "Detected Node.js v${node_major}. Need >= ${MIN_NODE_MAJOR}."
      install_node=true
    fi
  fi

  if [[ "$install_node" == true ]]; then
    log "Installing/upgrading Node.js…"
    install_or_upgrade_node "$pm"
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    err "Node.js/npm still not available after installation attempt."
    exit 1
  fi
}

# ── Tailscale ─────────────────────────────────────────────────────────────────
detect_tailscale() { command -v tailscale >/dev/null 2>&1; }

install_tailscale() {
  local pm; pm="$(detect_pkg_manager)"
  log "Installing Tailscale…"
  case "$pm" in
    apt|dnf|yum)
      curl -fsSL https://tailscale.com/install.sh | run_with_sudo sh
      ;;
    brew) brew install tailscale ;;
    *)
      warn "Could not auto-install Tailscale. Visit https://tailscale.com/download to install manually."
      return 1
      ;;
  esac
}

setup_tailscale() {
  printf "\n${BOLD}── Tailscale setup ──${NC}\n"
  if ! detect_tailscale; then
    warn "Tailscale is not installed."
    if prompt_yn "Install Tailscale now?" "y"; then
      install_tailscale || return 0
    else
      warn "Skipping Tailscale setup."
      return 0
    fi
  fi

  ok "Tailscale is available."

  if ! tailscale status >/dev/null 2>&1; then
    if prompt_yn "Run 'tailscale up' now to connect this device?" "y"; then
      local auth_key=""
      prompt auth_key "Tailscale auth key (leave blank to use browser login)" ""
      local ts_args=""
      if prompt_yn "Enable Tailscale SSH (--ssh)?" "n"; then
        ts_args="$ts_args --ssh"
      fi
      local routes=""
      prompt routes "Advertise routes (e.g. 192.168.1.0/24, or blank to skip)" ""
      if [[ -n "$routes" ]]; then
        ts_args="$ts_args --advertise-routes=$routes"
      fi

      if [[ -n "$auth_key" ]]; then
        run_with_sudo tailscale up --auth-key="$auth_key" $ts_args
      else
        run_with_sudo tailscale up $ts_args
      fi
    fi
  else
    ok "Tailscale is already connected: $(tailscale status --json 2>/dev/null | grep -o '"Self":{[^}]*}' | head -1 || echo 'unknown')"
  fi
}

# ── OpenClaw detection ────────────────────────────────────────────────────────
setup_openclaw() {
  printf "\n${BOLD}── OpenClaw Gateway setup ──${NC}\n"

  local gw_url="" gw_token="" gw_origin=""

  if command -v openclaw >/dev/null 2>&1; then
    ok "openclaw CLI detected."
    if openclaw status >/dev/null 2>&1; then
      ok "openclaw gateway is running locally."
      gw_url="http://127.0.0.1:18789"
      local token_out
      token_out="$(openclaw status 2>/dev/null || true)"
      if echo "$token_out" | grep -q "token"; then
        gw_token="$(echo "$token_out" | grep -oP '(?<=token:? )\S+' | head -1 || true)"
      fi
    else
      warn "openclaw is installed but not running. You may need to start it separately."
    fi
  else
    warn "openclaw CLI not found."
    printf "  ${BOLD}Options:${NC}\n"
    printf "  1) Install openclaw locally (npm global install)\n"
    printf "  2) Use a remote OpenClaw gateway\n"
    printf "  3) Skip for now (configure later via UI)\n"
    local choice=""
    prompt choice "Choose an option" "3"

    case "$choice" in
      1)
        log "Installing openclaw CLI globally…"
        npm install -g openclaw 2>/dev/null || warn "Global npm install failed; try 'sudo npm install -g openclaw' manually."
        if command -v openclaw >/dev/null 2>&1; then
          ok "openclaw installed. Please start it and re-run installer, or configure via the UI."
          gw_url="http://127.0.0.1:18789"
        fi
        ;;
      2)
        prompt gw_url "Remote gateway URL (e.g. https://my-gateway.example.com)" ""
        prompt gw_token "Gateway auth token" ""
        ;;
      3)
        log "Skipping OpenClaw setup. You can configure the gateway from the in-app settings."
        ;;
    esac
  fi

  # Write gateway config into .env.local if we have values
  if [[ -n "$gw_url" ]]; then
    local env_file="${INSTALL_DIR}/.env.local"
    {
      echo "OPENCLAW_GATEWAY_URL=${gw_url}"
      [[ -n "$gw_token"  ]] && echo "OPENCLAW_GATEWAY_TOKEN=${gw_token}"
      [[ -n "$gw_origin" ]] && echo "OPENCLAW_GATEWAY_ORIGIN=${gw_origin}"
      echo "PORT=${APP_PORT}"
    } > "$env_file"
    ok "Gateway config written to ${env_file}"
  fi
}

# ── repo management ────────────────────────────────────────────────────────────
fetch_repo() {
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    local remote
    remote="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
    local canonical="${REPO_URL%.git}"
    if [[ "$remote" == "$canonical" || "$remote" == "${canonical}.git" ]]; then
      log "Updating existing installation at ${INSTALL_DIR}…"
      git -C "$INSTALL_DIR" fetch --all --prune
      git -C "$INSTALL_DIR" checkout "$BRANCH"
      git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
      return
    fi
  fi

  if [[ -d "$INSTALL_DIR" ]]; then
    local backup="${INSTALL_DIR}.bak.$(date +%Y%m%d%H%M%S)"
    warn "Directory ${INSTALL_DIR} exists but is not an openclaw-mc checkout. Backing up to ${backup}."
    mv "$INSTALL_DIR" "$backup"
  fi

  mkdir -p "$(dirname "$INSTALL_DIR")"
  log "Cloning repository into ${INSTALL_DIR}…"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
}

build_app() {
  cd "$INSTALL_DIR"
  log "Installing Node dependencies…"
  if ! npm ci --legacy-peer-deps 2>/dev/null; then
    warn "'npm ci' failed, falling back to 'npm install'…"
    npm install --legacy-peer-deps
  fi
  log "Building production bundle (tsc + next build)…"
  npm run build
  ok "Build complete."
}

# ── service setup ─────────────────────────────────────────────────────────────
setup_systemd() {
  local service_file="/etc/systemd/system/oclawmc.service"
  local log_file="${CONFIG_DIR}/oclawmc.log"
  log "Creating systemd unit at ${service_file}…"
  run_with_sudo tee "$service_file" > /dev/null <<EOF
[Unit]
Description=OpenClaw MC
After=network.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=-${INSTALL_DIR}/.env.local
ExecStart=$(command -v node) dist/server/index.js
Restart=on-failure
RestartSec=5
StandardOutput=append:${log_file}
StandardError=append:${log_file}

[Install]
WantedBy=multi-user.target
EOF
  run_with_sudo systemctl daemon-reload
  run_with_sudo systemctl enable oclawmc
  run_with_sudo systemctl start  oclawmc
  ok "systemd service 'oclawmc' started and enabled on boot."
}

setup_launchd() {
  local plist="${HOME}/Library/LaunchAgents/com.oclawmc.plist"
  local log_file="${CONFIG_DIR}/oclawmc.log"
  local node_bin; node_bin="$(command -v node)"
  log "Creating launchd plist at ${plist}…"
  mkdir -p "${HOME}/Library/LaunchAgents"
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.oclawmc</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node_bin}</string>
    <string>${INSTALL_DIR}/dist/server/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>${INSTALL_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict><key>NODE_ENV</key><string>production</string></dict>
  <key>StandardOutPath</key><string>${log_file}</string>
  <key>StandardErrorPath</key><string>${log_file}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
EOF
  launchctl load -w "$plist" 2>/dev/null || launchctl bootstrap gui/"$(id -u)" "$plist" 2>/dev/null || true
  ok "launchd service loaded and will start on login."
}

setup_nohup() {
  local pid_file="${CONFIG_DIR}/oclawmc.pid"
  local log_file="${CONFIG_DIR}/oclawmc.log"
  log "Starting OpenClaw MC in background with nohup…"
  cd "$INSTALL_DIR"
  # Source env file if present
  if [[ -f ".env.local" ]]; then
    set -o allexport
    # shellcheck disable=SC1091
    source .env.local
    set +o allexport
  fi
  export NODE_ENV=production
  nohup node dist/server/index.js >> "$log_file" 2>&1 &
  echo $! > "$pid_file"
  ok "OpenClaw MC started (PID $(cat "$pid_file")). Logs: ${log_file}"
}

setup_service() {
  local os; os="$(uname -s)"
  if [[ "$os" == "Linux" ]] && command -v systemctl >/dev/null 2>&1; then
    setup_systemd
  elif [[ "$os" == "Darwin" ]]; then
    setup_launchd
  else
    setup_nohup
  fi
}

# ── CLI installation ───────────────────────────────────────────────────────────
install_cli() {
  local cli_src="${INSTALL_DIR}/scripts/oclawmc"
  if [[ ! -f "$cli_src" ]]; then
    warn "oclawmc CLI script not found at ${cli_src}; skipping CLI install."
    return 0
  fi
  chmod +x "$cli_src"

  local bin_dir="$CLI_BIN_DIR"
  mkdir -p "$bin_dir"
  local dest="${bin_dir}/${SCRIPT_NAME}"
  ln -sf "$cli_src" "$dest"
  ok "oclawmc CLI installed to ${dest}"

  # PATH integration
  if ! echo "$PATH" | tr ':' '\n' | grep -qxF "$bin_dir"; then
    warn "${bin_dir} is not in your PATH."
    local shell_rc=""
    case "${SHELL:-}" in
      */zsh)  shell_rc="${HOME}/.zshrc" ;;
      */fish) shell_rc="${HOME}/.config/fish/config.fish" ;;
      *)      shell_rc="${HOME}/.bashrc" ;;
    esac
    local export_line="export PATH=\"${bin_dir}:\$PATH\""
    if [[ -n "$shell_rc" ]] && ! grep -qF "$export_line" "$shell_rc" 2>/dev/null; then
      echo "" >> "$shell_rc"
      echo "# Added by openclaw-mc installer" >> "$shell_rc"
      echo "$export_line" >> "$shell_rc"
      ok "Added ${bin_dir} to PATH in ${shell_rc}"
      warn "Restart your shell or run: export PATH=\"${bin_dir}:\$PATH\""
    fi
  fi
}

# ── config ────────────────────────────────────────────────────────────────────
write_config() {
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_FILE" <<EOF
{
  "install_dir": "${INSTALL_DIR}",
  "port": ${APP_PORT},
  "branch": "${BRANCH}",
  "service_type": "${SERVICE_TYPE}"
}
EOF
  ok "Config saved to ${CONFIG_FILE}"
}

# ── interactive prompts ────────────────────────────────────────────────────────
collect_user_input() {
  printf "\n${BOLD}── Installation options ──${NC}\n"

  prompt INSTALL_DIR \
    "Install directory" \
    "${INSTALL_DIR:-${HOME}/.local/share/openclaw-mc}"

  prompt APP_PORT "App port" "3000"

  # Determine a sensible default bin dir
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    local default_bin="/usr/local/bin"
  else
    local default_bin="${HOME}/.local/bin"
  fi
  prompt CLI_BIN_DIR "CLI bin directory (will be added to PATH)" "$default_bin"

  if prompt_yn "Set up a background service (auto-start on boot)?" "y"; then
    SETUP_SERVICE=true
  else
    SETUP_SERVICE=false
  fi

  if prompt_yn "Set up Tailscale?" "y"; then
    SETUP_TAILSCALE=true
  else
    SETUP_TAILSCALE=false
  fi
}

# ── main ───────────────────────────────────────────────────────────────────────
main() {
  banner

  # Defaults (may be overridden by collect_user_input)
  INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/share/openclaw-mc}"
  APP_PORT="3000"
  CLI_BIN_DIR="${HOME}/.local/bin"
  SETUP_SERVICE=true
  SETUP_TAILSCALE=true
  SERVICE_TYPE="nohup"

  collect_user_input

  log "Ensuring required tools are installed…"
  ensure_cmds

  if [[ "$SETUP_TAILSCALE" == true ]]; then
    setup_tailscale
  fi

  fetch_repo
  build_app
  setup_openclaw

  # Determine service type for config
  local os; os="$(uname -s)"
  if [[ "$os" == "Linux" ]] && command -v systemctl >/dev/null 2>&1; then
    SERVICE_TYPE="systemd"
  elif [[ "$os" == "Darwin" ]]; then
    SERVICE_TYPE="launchd"
  else
    SERVICE_TYPE="nohup"
  fi

  write_config
  install_cli

  if [[ "$SETUP_SERVICE" == true ]]; then
    setup_service
  else
    log "Skipping service setup. To start manually: oclawmc start"
  fi

  printf "\n${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  printf "${BOLD}${GREEN}  OpenClaw MC installed successfully!${NC}\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  printf "  App URL  : ${BOLD}http://localhost:${APP_PORT}${NC}\n"
  printf "  CLI      : ${BOLD}oclawmc <command>${NC}\n"
  printf "  Commands : start | stop | restart | status | logs | update | doctor | uninstall\n\n"
}

main "$@"

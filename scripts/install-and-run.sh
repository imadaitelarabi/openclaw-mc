#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/imadaitelarabi/openclaw-mc.git}"
BRANCH="${BRANCH:-master}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/openclaw-mc}"
MIN_NODE_MAJOR="18"
TARGET_NODE_MAJOR="20"

SUDO=""
if [[ "${EUID:-$(id -u)}" -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

log() {
  printf "\033[1;34m[openclaw-mc]\033[0m %s\n" "$*"
}

warn() {
  printf "\033[1;33m[openclaw-mc]\033[0m %s\n" "$*"
}

err() {
  printf "\033[1;31m[openclaw-mc]\033[0m %s\n" "$*" >&2
}

run_with_sudo() {
  if [[ -n "$SUDO" ]]; then
    $SUDO "$@"
  else
    "$@"
  fi
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo "apt"
  elif command -v dnf >/dev/null 2>&1; then
    echo "dnf"
  elif command -v yum >/dev/null 2>&1; then
    echo "yum"
  elif command -v pacman >/dev/null 2>&1; then
    echo "pacman"
  elif command -v brew >/dev/null 2>&1; then
    echo "brew"
  else
    echo "none"
  fi
}

install_base_tools() {
  local pm="$1"
  case "$pm" in
    apt)
      run_with_sudo apt-get update
      run_with_sudo apt-get install -y git curl ca-certificates
      ;;
    dnf)
      run_with_sudo dnf install -y git curl ca-certificates
      ;;
    yum)
      run_with_sudo yum install -y git curl ca-certificates
      ;;
    pacman)
      run_with_sudo pacman -Sy --noconfirm git curl ca-certificates
      ;;
    brew)
      brew install git curl
      ;;
    *)
      err "No supported package manager found. Please install git and curl manually."
      exit 1
      ;;
  esac
}

install_or_upgrade_node() {
  local pm="$1"
  case "$pm" in
    apt)
      curl -fsSL "https://deb.nodesource.com/setup_${TARGET_NODE_MAJOR}.x" | run_with_sudo -E bash -
      run_with_sudo apt-get install -y nodejs
      ;;
    dnf)
      curl -fsSL "https://rpm.nodesource.com/setup_${TARGET_NODE_MAJOR}.x" | run_with_sudo bash -
      run_with_sudo dnf install -y nodejs
      ;;
    yum)
      curl -fsSL "https://rpm.nodesource.com/setup_${TARGET_NODE_MAJOR}.x" | run_with_sudo bash -
      run_with_sudo yum install -y nodejs
      ;;
    pacman)
      run_with_sudo pacman -Sy --noconfirm nodejs npm
      ;;
    brew)
      brew install node
      ;;
    *)
      err "Cannot auto-install Node.js on this system. Please install Node.js >= ${MIN_NODE_MAJOR}."
      exit 1
      ;;
  esac
}

ensure_cmds() {
  local pm
  pm="$(detect_pkg_manager)"

  if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    log "Installing missing base tools (git/curl)..."
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
    log "Installing/upgrading Node.js..."
    install_or_upgrade_node "$pm"
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    err "Node.js/npm still not available after installation."
    exit 1
  fi
}

fetch_repo() {
  mkdir -p "$(dirname "$INSTALL_DIR")"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "Updating existing installation at $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --all --prune
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
  else
    log "Cloning repository into $INSTALL_DIR"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi
}

build_and_run() {
  cd "$INSTALL_DIR"

  log "Installing dependencies..."
  npm install --legacy-peer-deps

  log "Building production bundle..."
  npm run build

  log "Starting Mission Control in production mode (Ctrl+C to stop)..."
  exec npm start
}

main() {
  log "Preparing Mission Control installer"
  ensure_cmds
  fetch_repo
  build_and_run
}

main "$@"

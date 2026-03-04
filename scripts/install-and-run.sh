#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/imadaitelarabi/openclaw-mc.git}"
BRANCH="${BRANCH:-master}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/openclaw-mc}"
MIN_NODE_MAJOR="18"
TARGET_NODE_MAJOR="20"
TAILSCALE_BASE_PATH="${TAILSCALE_BASE_PATH:-}"   # may be set by env for CI/headless installs

# Common locations to search for an existing installation (in priority order).
# The default INSTALL_DIR is always included first.
SEARCH_DIRS=(
  "$HOME/.local/share/openclaw-mc"
  "$HOME/.openclaw/openclaw-mc"
)

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

# Search common locations (and the explicit INSTALL_DIR) for an existing
# openclaw-mc git checkout.  Returns the first matching directory path.
find_existing_install() {
  # Build a de-duplicated search list: explicit INSTALL_DIR first, then the
  # well-known fallback directories.
  local -a dirs=("$INSTALL_DIR")
  for d in "${SEARCH_DIRS[@]}"; do
    if [[ "$d" != "$INSTALL_DIR" ]]; then
      dirs+=("$d")
    fi
  done

  for dir in "${dirs[@]}"; do
    if [[ -d "$dir/.git" ]]; then
      local remote
      remote="$(git -C "$dir" remote get-url origin 2>/dev/null || true)"
      # Match the canonical repo URL (without .git suffix for flexibility).
      local canonical="${REPO_URL%.git}"
      if [[ "$remote" == "$canonical" || "$remote" == "${canonical}.git" ]]; then
        echo "$dir"
        return 0
      fi
    fi
  done

  return 1
}

fetch_repo() {
  # Detect an existing installation before deciding what to do.
  local found_dir
  if found_dir="$(find_existing_install)"; then
    if [[ "$found_dir" != "$INSTALL_DIR" ]]; then
      warn "Existing installation found at $found_dir (not $INSTALL_DIR)."
      log  "Using existing installation at $found_dir instead of re-cloning."
      INSTALL_DIR="$found_dir"
    fi

    log "Updating existing installation at $INSTALL_DIR"
    if ! git -C "$INSTALL_DIR" fetch --all --prune; then
      err "Failed to fetch updates for $INSTALL_DIR. Check your network connection."
      exit 1
    fi
    if ! git -C "$INSTALL_DIR" checkout "$BRANCH"; then
      err "Failed to checkout branch '$BRANCH' in $INSTALL_DIR."
      exit 1
    fi
    if ! git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"; then
      err "Failed to pull updates in $INSTALL_DIR (try resolving any local changes manually)."
      exit 1
    fi
    return
  fi

  # No existing git checkout found.
  if [[ -d "$INSTALL_DIR" ]]; then
    # Directory exists but is not a git repo — back it up and re-clone.
    local backup_dir="${INSTALL_DIR}.bak.$(date +%Y%m%d%H%M%S)"
    warn "$INSTALL_DIR exists but is not a git repository."
    warn "Moving it to $backup_dir and performing a fresh clone."
    if ! mv "$INSTALL_DIR" "$backup_dir"; then
      err "Failed to back up $INSTALL_DIR to $backup_dir. Check permissions and try again."
      exit 1
    fi
  fi

  mkdir -p "$(dirname "$INSTALL_DIR")"
  log "Cloning repository into $INSTALL_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
}

build_and_run() {
  cd "$INSTALL_DIR"

  # Write NEXT_PUBLIC_BASE_PATH to .env.local if TAILSCALE_BASE_PATH is set
  if [[ -n "$TAILSCALE_BASE_PATH" ]]; then
    local env_file="${INSTALL_DIR}/.env.local"
    log "Setting NEXT_PUBLIC_BASE_PATH=${TAILSCALE_BASE_PATH} in ${env_file}"
    # Append to .env.local if it exists, or create it
    echo "NEXT_PUBLIC_BASE_PATH=${TAILSCALE_BASE_PATH}" >> "$env_file"
  fi

  log "Installing dependencies..."
  npm install --legacy-peer-deps

  log "Building production bundle..."
  npm run build

  log "Starting OpenClaw MC in production mode (Ctrl+C to stop)..."
  exec npm start
}

setup_tailscale() {
  # If TAILSCALE_BASE_PATH is set via environment, configure Tailscale Serve
  if [[ -n "$TAILSCALE_BASE_PATH" ]] && command -v tailscale >/dev/null 2>&1; then
    log "Configuring Tailscale Serve with base path: ${TAILSCALE_BASE_PATH}"
    local ts_port="3000"
    local ts_target="http://localhost:${ts_port}"
    local serve_ok=false
    local ts_err_file; ts_err_file="$(mktemp)"

    # Attempt 1: serve with the requested path
    if run_with_sudo tailscale serve --bg --set-path "$TAILSCALE_BASE_PATH" "$ts_target" 2>"$ts_err_file"; then
      serve_ok=true
    elif grep -q "listener already exists" "$ts_err_file" 2>/dev/null; then
      # A listener already exists on that path — prompt the user to try a different one
      warn "A Tailscale Serve listener already exists for path '${TAILSCALE_BASE_PATH}'."
      local alt_path=""
      if [[ -r /dev/tty ]]; then
        printf "\033[1;34m[openclaw-mc]\033[0m Enter a different base path to try (e.g. /app), or leave blank to skip: " >/dev/tty
        IFS= read -r alt_path </dev/tty || alt_path=""
      fi
      if [[ -n "$alt_path" ]]; then
        if run_with_sudo tailscale serve --bg --set-path "$alt_path" "$ts_target" 2>/dev/null; then
          serve_ok=true
          TAILSCALE_BASE_PATH="$alt_path"
        fi
      fi
    fi

    rm -f "$ts_err_file"

    if [[ "$serve_ok" == true ]]; then
      log "Tailscale Serve configured with base path ${TAILSCALE_BASE_PATH}"
    else
      warn "Failed to configure Tailscale Serve. You can configure it manually with: tailscale serve --bg --set-path ${TAILSCALE_BASE_PATH} ${ts_target}"
    fi
  fi
}

main() {
  log "Preparing OpenClaw MC installer"
  ensure_cmds
  fetch_repo

  # Setup Tailscale if configured via environment variable
  setup_tailscale

  build_and_run
}

main "$@"

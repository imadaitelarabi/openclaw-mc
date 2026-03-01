/**
 * VsCodeService
 *
 * Server-side utility for opening a GitHub PR branch in VS Code.
 *
 * Strategy:
 * 1. Detect whether the server is running on a remote machine (SSH session).
 *    If remote, skip desktop open and return `mode: "web"` so the client falls
 *    back to vscode.dev.
 * 2. Search a configurable list of local directories for an existing clone of
 *    the repository (matched by remote URL or by owner/repo path component).
 * 3. If a clone is found: `git fetch && git checkout <branch>`.
 *    If not: `git clone <url> <path> && git checkout -b <branch> origin/<branch>`.
 * 4. Run `code <path>` to open VS Code desktop.
 *
 * Exposed as a reusable service so any future extension can call
 * `VsCodeService.open(...)`.
 *
 * Security: all external values are passed via argument arrays (never
 * interpolated into shell strings) to prevent command injection.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Runs a subprocess with the supplied argument array (no shell interpolation).
 * Resolves with stdout; rejects with an Error carrying stderr on failure.
 */
function spawnAsync(cmd: string, args: string[], options: { cwd?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `Process exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

/**
 * Returns true when the server process is running inside an SSH session,
 * indicating a remote/VPS environment where `code` cannot open a local window.
 */
export function isRemoteEnvironment(): boolean {
  return !!(process.env.SSH_CLIENT || process.env.SSH_TTY);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type VsCodeOpenMode = "desktop" | "web";

export interface VsCodeOpenResult {
  mode: VsCodeOpenMode;
  /** Absolute local path (populated for mode=desktop) */
  localPath?: string;
  /** vscode.dev URL to open (populated for mode=web) */
  webUrl: string;
  /** Non-fatal information message */
  message?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Directories searched (in order) for an existing clone. */
const SEARCH_ROOTS = [
  path.join(os.homedir(), "Projects"),
  path.join(os.homedir(), "dev"),
  path.join(os.homedir(), "workspace"),
  path.join(os.homedir(), "src"),
  os.homedir(),
];

/** Directory used when no existing clone is found. */
const DEFAULT_CLONE_ROOT = path.join(os.homedir(), "Projects");

/** Validate that fullName matches the expected `owner/repo` GitHub pattern. */
const FULL_NAME_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

// ── Internals ─────────────────────────────────────────────────────────────────

function buildWebUrl(fullName: string, branch: string): string {
  return `https://vscode.dev/github/${fullName}/tree/${encodeURIComponent(branch)}`;
}

/**
 * Normalises a git remote URL so that https and ssh forms compare equal and
 * trailing `.git` suffixes are ignored.
 */
function normaliseRemoteUrl(url: string): string {
  return url
    .trim()
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .toLowerCase();
}

/**
 * Runs `git remote get-url origin` in `dir` and returns the URL, or null on
 * failure.
 */
async function getGitRemoteUrl(dir: string): Promise<string | null> {
  try {
    const stdout = await spawnAsync("git", ["remote", "get-url", "origin"], { cwd: dir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Searches `SEARCH_ROOTS` for a directory whose git remote URL matches
 * `cloneUrl`. Checks both `<root>/<repo>` and `<root>/<owner>/<repo>` paths.
 */
async function findLocalClone(cloneUrl: string, fullName: string): Promise<string | null> {
  const repoName = path.basename(fullName); // safe: fullName validated above
  const normTarget = normaliseRemoteUrl(cloneUrl);

  for (const root of SEARCH_ROOTS) {
    if (!fs.existsSync(root)) continue;

    const candidates = [path.join(root, repoName), path.join(root, fullName)];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const remoteUrl = await getGitRemoteUrl(candidate);
      if (remoteUrl && normaliseRemoteUrl(remoteUrl) === normTarget) {
        return candidate;
      }
    }
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Core open flow.  Exported so it can be called by the HTTP handler and, in
 * the future, by WebSocket handlers from other extensions.
 */
export async function open(
  cloneUrl: string,
  fullName: string,
  branch: string
): Promise<VsCodeOpenResult> {
  // Validate fullName to prevent path traversal.
  if (!FULL_NAME_RE.test(fullName)) {
    throw new Error("Invalid repository name");
  }

  const webUrl = buildWebUrl(fullName, branch);

  if (isRemoteEnvironment()) {
    return { mode: "web", webUrl, message: "Remote environment detected – opening vscode.dev" };
  }

  let localPath = await findLocalClone(cloneUrl, fullName);

  if (localPath) {
    // Existing clone found – sync it.
    try {
      await spawnAsync("git", ["fetch", "origin"], { cwd: localPath });
      try {
        await spawnAsync("git", ["checkout", branch], { cwd: localPath });
      } catch {
        await spawnAsync("git", ["checkout", "-b", branch, `origin/${branch}`], {
          cwd: localPath,
        });
      }
    } catch (err) {
      console.warn("[VsCodeService] git ops failed:", (err as Error).message);
    }
  } else {
    // No existing clone – create one.
    if (!fs.existsSync(DEFAULT_CLONE_ROOT)) {
      fs.mkdirSync(DEFAULT_CLONE_ROOT, { recursive: true });
    }
    const repoName = path.basename(fullName);
    localPath = path.join(DEFAULT_CLONE_ROOT, repoName);

    try {
      await spawnAsync("git", ["clone", cloneUrl, localPath]);
      try {
        await spawnAsync("git", ["checkout", branch], { cwd: localPath });
      } catch {
        await spawnAsync("git", ["checkout", "-b", branch, `origin/${branch}`], {
          cwd: localPath,
        });
      }
    } catch (err) {
      console.error("[VsCodeService] git clone failed:", (err as Error).message);
      return {
        mode: "web",
        webUrl,
        message: `Clone failed – opening vscode.dev instead: ${(err as Error).message}`,
      };
    }
  }

  // Launch VS Code.
  try {
    await spawnAsync("code", [localPath]);
  } catch (err) {
    console.warn("[VsCodeService] `code` launch failed:", (err as Error).message);
    return {
      mode: "web",
      webUrl,
      localPath,
      message: "`code` command not found – opening vscode.dev instead",
    };
  }

  return { mode: "desktop", localPath, webUrl };
}

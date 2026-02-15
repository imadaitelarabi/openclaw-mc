import fs from "fs/promises";
import path from "path";
import os from "os";

const DEFAULT_WORKSPACE = path.join(os.homedir(), ".openclaw", "workspace");
const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE || DEFAULT_WORKSPACE;

export async function readWorkspaceFile(relativePath: string) {
  try {
    const fullPath = path.join(WORKSPACE_PATH, relativePath);
    const content = await fs.readFile(fullPath, "utf-8");
    if (relativePath.endsWith(".json")) {
      return JSON.parse(content);
    }
    return content;
  } catch (error) {
    console.error(`Error reading ${relativePath}:`, error);
    return null;
  }
}

export async function writeWorkspaceFile(relativePath: string, content: string) {
  try {
    const fullPath = path.join(WORKSPACE_PATH, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return true;
  } catch (error) {
    console.error(`Error writing ${relativePath}:`, error);
    return false;
  }
}

export async function listFiles(dirPath: string) {
  try {
    const fullPath = path.join(WORKSPACE_PATH, dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name)
    }));
  } catch (error) {
    return [];
  }
}

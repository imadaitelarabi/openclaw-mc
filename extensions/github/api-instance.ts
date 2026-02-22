/**
 * GitHub API instance accessor
 *
 * Shared singleton reference used by panel components to access the API
 * without importing from the extension entry point (avoids circular deps).
 */

import { GitHubAPI } from "./api";

let instance: GitHubAPI | null = null;

export function setApiInstance(api: GitHubAPI | null): void {
  instance = api;
}

export function getApiInstance(): GitHubAPI | null {
  return instance;
}

/**
 * GitHub Onboarding Panel Component
 */

"use client";

import { useState, useEffect } from "react";
import type { OnboardingProps } from "@/types/extension";
import { saveConfig } from "../setup";
import { GitHubAPI } from "../api";
import type { GitHubConfig } from "../config";

export function OnboardingPanel({
  extensionName: _extensionName,
  onComplete,
  onCancel,
  connectionStatus,
}: OnboardingProps) {
  const [token, setToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatedUser, setValidatedUser] = useState<string | null>(null);

  // If already connected, show the connected state
  const isConnected = connectionStatus?.isConnected ?? false;
  const connectedUsername = connectionStatus?.username;

  useEffect(() => {
    // If there's a connection error, show it
    if (connectionStatus?.error && !connectionStatus.isConnected) {
      setError(connectionStatus.error);
    }
  }, [connectionStatus]);

  const handleTestConnection = async () => {
    // Validate inputs
    if (!token.trim()) {
      setError("GitHub Personal Access Token is required");
      return;
    }

    setIsValidating(true);
    setError(null);
    setValidatedUser(null);

    try {
      // Test connection
      const api = new GitHubAPI({ token });
      const user = await api.getUser();

      if (!user) {
        setError("Failed to validate GitHub token. Please check your credentials.");
        return;
      }

      setValidatedUser(user.login);
      setError(null);
    } catch (err) {
      console.error("[GitHub Onboarding] Connection test failed:", err);
      const message = err instanceof Error ? err.message : "Failed to validate GitHub token";
      setError(message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    // Validate inputs
    if (!token.trim()) {
      setError("GitHub Personal Access Token is required");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Test connection and get user
      const api = new GitHubAPI({ token });
      const user = await api.getUser();

      if (!user) {
        setError("Failed to validate GitHub token. Please check your credentials.");
        return;
      }

      // Validate that we can access organization/repository graph
      try {
        await api.getOrganizations();
      } catch {
        setError(
          "Failed to access your organizations and repositories. Please check token permissions."
        );
        return;
      }

      // Save configuration
      const config: GitHubConfig = {
        refreshInterval: 300000,
        maxResults: 5,
        showClosed: false,
        maxOrganizations: 8,
        maxReposPerOrg: 6,
      };

      await saveConfig(config, token);

      // Complete onboarding
      onComplete();
    } catch (err) {
      console.error("[GitHub Onboarding] Failed to save config:", err);
      const message = err instanceof Error ? err.message : "Failed to save configuration";
      setError(message);
    } finally {
      setIsValidating(false);
    }
  };

  // If already connected, show connected state
  if (isConnected && connectedUsername) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-2">GitHub Integration</h2>

        <div className="space-y-4">
          {/* Connected Status */}
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-medium text-green-600">Connected</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connected as <span className="font-mono font-medium">{connectedUsername}</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-border rounded hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Setup GitHub Integration</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Connect to GitHub to browse organizations, repositories, pull requests, and issues directly
        from OpenClaw MC.
      </p>

      <div className="space-y-4">
        {/* GitHub Token Input */}
        <div>
          <label htmlFor="githubToken" className="block text-sm font-medium mb-1">
            GitHub Personal Access Token
          </label>
          <input
            id="githubToken"
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setValidatedUser(null);
              setError(null);
            }}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full px-3 py-2 border border-border rounded bg-background text-sm"
            disabled={isValidating}
          />
          <p className="text-xs text-muted-foreground mt-1">
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Mission%20Control"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Create a token
            </a>{" "}
            with <code className="px-1 py-0.5 bg-muted rounded">repo</code> and{" "}
            <code className="px-1 py-0.5 bg-muted rounded">read:org</code> scopes
          </p>
        </div>

        {/* Success Message */}
        {validatedUser && !error && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm rounded flex items-center gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              Connection successful! Connected as{" "}
              <span className="font-mono font-medium">{validatedUser}</span>
            </span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded flex items-start gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onCancel}
            disabled={isValidating}
            className="px-4 py-2 text-sm border border-border rounded hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleTestConnection}
            disabled={isValidating || !token.trim()}
            className="px-4 py-2 text-sm border border-border rounded hover:bg-accent disabled:opacity-50"
          >
            {isValidating ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleSave}
            disabled={isValidating || !validatedUser}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isValidating ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

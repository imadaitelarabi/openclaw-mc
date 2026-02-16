/**
 * GitHub Onboarding Panel Component
 */

'use client';

import { useState } from 'react';
import type { OnboardingProps } from '@/types/extension';
import { saveConfig } from '../setup';
import { GitHubAPI } from '../api';
import type { GitHubConfig } from '../config';

export function OnboardingPanel({ extensionName, onComplete, onCancel }: OnboardingProps) {
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    // Validate inputs
    if (!token.trim()) {
      setError('GitHub Personal Access Token is required');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Test connection
      const api = new GitHubAPI({ token });
      const isValid = await api.testConnection();

      if (!isValid) {
        setError('Failed to validate GitHub token. Please check your credentials.');
        return;
      }

      // Validate that we can access organization/repository graph
      try {
        await api.getOrganizations();
      } catch (err) {
        setError('Failed to access your organizations and repositories. Please check token permissions.');
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
      console.error('[GitHub Onboarding] Failed to save config:', err);
      setError('Failed to save configuration. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-2">Setup GitHub Integration</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Connect to GitHub to browse organizations, repositories, pull requests, and issues directly from Mission Control.
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
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full px-3 py-2 border border-border rounded bg-background text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            <a 
              href="https://github.com/settings/tokens/new?scopes=repo&description=Mission%20Control" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Create a token
            </a>
            {' '}with <code className="px-1 py-0.5 bg-muted rounded">repo</code> and <code className="px-1 py-0.5 bg-muted rounded">read:org</code> scopes
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">
            {error}
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
            onClick={handleSave}
            disabled={isValidating}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isValidating ? 'Validating...' : 'Validate & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

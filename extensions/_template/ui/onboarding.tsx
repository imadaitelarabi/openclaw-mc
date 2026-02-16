/**
 * Onboarding Panel Component
 * 
 * React component for extension setup/configuration.
 * Shown when extension is first enabled or setup is incomplete.
 */

'use client';

import { useState } from 'react';
import type { OnboardingProps } from '@/types/extension';
import { saveConfig } from '../setup';
import { ExtensionAPI } from '../api';
import type { ExtensionConfig } from '../config';

export function OnboardingPanel({ extensionName, onComplete, onCancel }: OnboardingProps) {
  const [apiToken, setApiToken] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api.example.com');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!apiToken.trim()) {
      setError('API token is required');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Validate credentials
      const api = new ExtensionAPI({ apiToken, apiUrl });
      const isValid = await api.testConnection();

      if (!isValid) {
        setError('Failed to validate API token. Please check your credentials.');
        return;
      }

      // Save configuration
      const config: ExtensionConfig = {
        apiUrl,
        enabled: true,
        refreshInterval: 60000,
      };

      await saveConfig(config, apiToken);

      // Complete onboarding
      onComplete();
    } catch (err) {
      console.error('[Onboarding] Failed to save config:', err);
      setError('Failed to save configuration. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Setup {extensionName}</h2>
      
      <div className="space-y-4">
        {/* API Token Input */}
        <div>
          <label htmlFor="apiToken" className="block text-sm font-medium mb-1">
            API Token
          </label>
          <input
            id="apiToken"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Enter your API token"
            className="w-full px-3 py-2 border border-border rounded bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            <a 
              href="https://example.com/settings/tokens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline"
            >
              Create a token
            </a>
          </p>
        </div>

        {/* API URL Input */}
        <div>
          <label htmlFor="apiUrl" className="block text-sm font-medium mb-1">
            API URL
          </label>
          <input
            id="apiUrl"
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com"
            className="w-full px-3 py-2 border border-border rounded bg-background"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isValidating}
            className="px-4 py-2 text-sm border border-border rounded hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isValidating}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            {isValidating ? 'Validating...' : 'Validate & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

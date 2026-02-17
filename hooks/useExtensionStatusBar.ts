/**
 * Extension Hook: Status Bar
 * 
 * Hook for extensions to provide status bar items with dropdown functionality.
 */

import { useEffect, useState, useCallback } from 'react';
import { useExtensions } from '@/contexts/ExtensionContext';
import type { StatusBarItem } from '@/types/extension';

const STATUS_BAR_REFRESH_INTERVAL_MS = 5000;

/**
 * Hook to get status bar items from all enabled extensions
 * Safe for SSR - returns empty state if context not available
 */
export function useExtensionStatusBar() {
  const [statusBarItems, setStatusBarItems] = useState<Map<string, StatusBarItem>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Try to get extension context - may not be available in SSR
  let enabledExtensions: any[] = [];
  try {
    const context = useExtensions();
    enabledExtensions = context.enabledExtensions;
  } catch (error) {
    // Context not available (SSR or provider not set up)
    // Return empty state gracefully
  }

  const refreshStatusBar = useCallback(async () => {
    if (enabledExtensions.length === 0) {
      setStatusBarItems(new Map());
      return;
    }

    setIsLoading(true);
    const items = new Map<string, StatusBarItem>();

    try {
      // Get status bar items from all enabled extensions
      const promises = enabledExtensions
        .filter(ext => ext.manifest.hooks.includes('status-bar'))
        .map(async (ext) => {
          if (ext.hooks.statusBar) {
            try {
              const item = await ext.hooks.statusBar();
              if (item) {
                items.set(ext.manifest.name, item);
              }
            } catch (error) {
              console.error(`[StatusBarHook] Error getting item from ${ext.manifest.name}:`, error);
            }
          }
        });

      await Promise.all(promises);
      setStatusBarItems(items);
    } catch (error) {
      console.error('[StatusBarHook] Error refreshing status bar:', error);
    } finally {
      setIsLoading(false);
    }
  }, [enabledExtensions]);

  // Refresh on mount and when extensions change
  useEffect(() => {
    if (enabledExtensions.length === 0) {
      setStatusBarItems(new Map());
      return;
    }

    // Initial refresh
    refreshStatusBar();

    // Poll for updates (e.g. GitHub commits/PR changes)
    const intervalId = window.setInterval(() => {
      refreshStatusBar();
    }, STATUS_BAR_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabledExtensions.length, refreshStatusBar]);

  return {
    statusBarItems,
    isLoading,
    refreshStatusBar
  };
}

/**
 * Hook to get status bar item for a specific extension
 */
export function useExtensionStatusBarItem(extensionName: string) {
  const { getExtension, isExtensionEnabled } = useExtensions();
  const [item, setItem] = useState<StatusBarItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isExtensionEnabled(extensionName)) {
      setItem(null);
      return;
    }

    const extension = getExtension(extensionName);
    if (!extension?.hooks.statusBar) {
      setItem(null);
      return;
    }

    setIsLoading(true);
    try {
      const statusItem = await extension.hooks.statusBar();
      setItem(statusItem);
    } catch (error) {
      console.error(`[StatusBarHook] Error getting item from ${extensionName}:`, error);
      setItem(null);
    } finally {
      setIsLoading(false);
    }
  }, [extensionName, isExtensionEnabled, getExtension]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    item,
    isLoading,
    refresh
  };
}

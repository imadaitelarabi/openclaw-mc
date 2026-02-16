/**
 * Extension Hook: Status Bar
 * 
 * Hook for extensions to provide status bar items with dropdown functionality.
 */

import { useEffect, useState, useCallback } from 'react';
import { useExtensions } from '@/contexts/ExtensionContext';
import type { StatusBarItem } from '@/types/extension';

/**
 * Hook to get status bar items from all enabled extensions
 */
export function useExtensionStatusBar() {
  const { enabledExtensions } = useExtensions();
  const [statusBarItems, setStatusBarItems] = useState<Map<string, StatusBarItem>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const refreshStatusBar = useCallback(async () => {
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
    refreshStatusBar();
  }, [refreshStatusBar]);

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

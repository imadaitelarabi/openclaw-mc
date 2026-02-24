/**
 * Extension Hook: Status Bar
 *
 * Hook for extensions to provide status bar items with dropdown functionality.
 */

import { useEffect, useState, useCallback } from "react";
import { useExtensions } from "@/contexts/ExtensionContext";
import type {
  StatusBarItem,
  StatusBarDropdownItem,
  ExtensionPanelDefinition,
} from "@/types/extension";

const STATUS_BAR_REFRESH_INTERVAL_MS = 5000;

/**
 * Build "Open Panel" submenu items for an extension that declares panels in its manifest
 */
function buildOpenPanelItems(panels: ExtensionPanelDefinition[]): StatusBarDropdownItem[] {
  return panels.map((panel) => ({
    id: `open-panel:${panel.id}`,
    text: panel.title,
    subtext: panel.description,
    openPanelId: panel.id,
  }));
}

/**
 * Augment a status bar item with an "Open Panel" submenu if the extension has panels.
 * Skips injection if the item already contains a panel-open entry to avoid duplication.
 * For multiple panels the default panel (or first) appears first in the submenu.
 */
function augmentWithPanelSubmenu(
  item: StatusBarItem,
  panels: ExtensionPanelDefinition[]
): StatusBarItem {
  if (panels.length === 0) return item;

  // De-dupe: skip if an existing item already has id "__open-panel__" or openPanelId set
  const existingItems = item.items || [];
  const alreadyHasPanelEntry = existingItems.some(
    (i) => i.id === "__open-panel__" || i.openPanelId !== undefined
  );
  if (alreadyHasPanelEntry) return item;

  let openPanelEntry: StatusBarDropdownItem;

  if (panels.length === 1) {
    // Single panel: direct open action
    openPanelEntry = {
      id: "__open-panel__",
      text: "Open Panel",
      openPanelId: panels[0].id,
    };
  } else {
    // Multiple panels: sort so the default panel comes first in the submenu.
    // If no panel is marked default, use the manifest order as-is (first = implicit default).
    const defaultPanel = panels.find((p) => p.default);
    const orderedPanels = defaultPanel
      ? [defaultPanel, ...panels.filter((p) => p.id !== defaultPanel.id)]
      : panels;
    openPanelEntry = {
      id: "__open-panel__",
      text: "Open Panel",
      children: buildOpenPanelItems(orderedPanels),
    };
  }

  return {
    ...item,
    items: [...existingItems, openPanelEntry],
  };
}

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
  } catch {
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
      const promises = enabledExtensions.map(async (ext) => {
        const hasPanels = ext.manifest.panels && ext.manifest.panels.length > 0;
        const hasStatusBarHook = ext.manifest.hooks.includes("status-bar");

        let item: StatusBarItem | null = null;

        if (hasStatusBarHook && ext.hooks.statusBar) {
          try {
            item = await ext.hooks.statusBar();
          } catch (error) {
            console.error(`[StatusBarHook] Error getting item from ${ext.manifest.name}:`, error);
          }
        }

        // If extension has panels, ensure it has a status bar item to host the submenu
        if (hasPanels && ext.manifest.panels) {
          if (!item) {
            // Create a minimal status bar item so the "Open Panel" menu can appear
            item = {
              label: ext.manifest.name,
              icon: ext.manifest.statusBar?.icon || "Box",
              items: [],
            };
          }
          // Inject "Open Panel" submenu
          item = augmentWithPanelSubmenu(item, ext.manifest.panels);
        }

        if (item) {
          items.set(ext.manifest.name, item);
        }
      });

      await Promise.all(promises);
      setStatusBarItems(items);
    } catch (error) {
      console.error("[StatusBarHook] Error refreshing status bar:", error);
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
    refreshStatusBar,
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
    refresh,
  };
}

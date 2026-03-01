/**
 * Extension Hook: Status Bar
 *
 * Hook for extensions to provide status bar items with dropdown functionality.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useExtensions } from "@/contexts/ExtensionContext";
import type {
  Extension,
  StatusBarItem,
  StatusBarResult,
  StatusBarDropdownItem,
  ExtensionPanelDefinition,
  StatusBarConfig,
} from "@/types/extension";

/** Fallback refresh interval when the extension / manifest doesn't specify one */
const DEFAULT_REFRESH_INTERVAL_MS = 5000;

/**
 * Normalise a StatusBarResult into a plain shape with resolved refresh/cache settings.
 * Accepts manifest-level defaults as fallback.
 */
function parseStatusBarResult(
  result: StatusBarResult | null,
  manifestStatusBar?: StatusBarConfig
): { item: StatusBarItem | null; refreshIntervalMs: number; cacheTtlMs: number } {
  const fallbackRefresh = manifestStatusBar?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  const fallbackCache = manifestStatusBar?.cacheTtlMs ?? 0;

  if (result === null || result === undefined) {
    return { item: null, refreshIntervalMs: fallbackRefresh, cacheTtlMs: fallbackCache };
  }

  // Extended form: { item, refreshIntervalMs?, cacheTtlMs? }
  if ("item" in result) {
    return {
      item: result.item,
      refreshIntervalMs: result.refreshIntervalMs ?? fallbackRefresh,
      cacheTtlMs: result.cacheTtlMs ?? fallbackCache,
    };
  }

  // Plain StatusBarItem (backward-compatible)
  return { item: result, refreshIntervalMs: fallbackRefresh, cacheTtlMs: fallbackCache };
}

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
  let enabledExtensions: Extension[] = [];
  try {
    const context = useExtensions();
    enabledExtensions = context.enabledExtensions;
  } catch {
    // Context not available (SSR or provider not set up)
    // Return empty state gracefully
  }

  // ─── Stable refs (never trigger re-renders) ───────────────────────────────
  /** Extensions currently being fetched (in-flight guard, prevents overlapping calls) */
  const inFlightRef = useRef(new Set<string>());
  /** Active setTimeout handles keyed by extension name */
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /**
   * The refresh function is stored in a ref so setTimeout callbacks can always
   * call the latest version without creating stale closures.
   */
  const refreshExtRef = useRef<(ext: Extension) => Promise<void>>();

  // Rebuild refreshExtRef on every render so it always captures the latest
  // enabledExtensions / setStatusBarItems without needing additional deps.
  refreshExtRef.current = async (ext: Extension): Promise<void> => {
    const name: string = ext.manifest.name;

    // In-flight guard – skip if a fetch is already running for this extension.
    if (inFlightRef.current.has(name)) return;

    // Visibility guard – don't waste API calls while the tab is hidden.
    // Refreshing is resumed via the visibilitychange listener below.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    inFlightRef.current.add(name);
    try {
      const hasPanels = !!ext.manifest.panels?.length;
      const hasStatusBarHook = ext.manifest.hooks.includes("status-bar");
      let item: StatusBarItem | null = null;
      let refreshIntervalMs =
        ext.manifest.statusBar?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;

      if (hasStatusBarHook && ext.hooks.statusBar) {
        try {
          const result: StatusBarResult | null = await ext.hooks.statusBar();
          const parsed = parseStatusBarResult(result, ext.manifest.statusBar);
          item = parsed.item;
          refreshIntervalMs = parsed.refreshIntervalMs;
        } catch (error) {
          console.error(`[StatusBarHook] Error getting item from ${name}:`, error);
        }
      }

      // If the extension declares panels, ensure it has a status bar entry to host the submenu.
      if (hasPanels && ext.manifest.panels) {
        if (!item) {
          item = {
            label: ext.manifest.name,
            icon: ext.manifest.statusBar?.icon || "Box",
            items: [],
          };
        }
        item = augmentWithPanelSubmenu(item, ext.manifest.panels);
      }

      setStatusBarItems((prev) => {
        const next = new Map(prev);
        if (item) {
          next.set(name, item);
        } else {
          next.delete(name);
        }
        return next;
      });

      // Schedule the next refresh for this extension using the resolved interval.
      const timer = setTimeout(() => refreshExtRef.current?.(ext), refreshIntervalMs);
      timersRef.current.set(name, timer);
    } finally {
      inFlightRef.current.delete(name);
    }
  };

  // ─── Visibility-aware refresh ─────────────────────────────────────────────
  // When the tab regains focus, cancel any outstanding timers and refresh
  // each extension immediately so the UI is never stale on re-activation.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        enabledExtensions.forEach((ext) => {
          const existing = timersRef.current.get(ext.manifest.name);
          if (existing !== undefined) {
            clearTimeout(existing);
            timersRef.current.delete(ext.manifest.name);
          }
          refreshExtRef.current?.(ext);
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabledExtensions]);

  // ─── Per-extension polling setup ─────────────────────────────────────────
  useEffect(() => {
    if (enabledExtensions.length === 0) {
      setStatusBarItems(new Map());
      return;
    }

    const enabledNames = new Set(enabledExtensions.map((e) => e.manifest.name));

    // Cancel timers for extensions that are no longer enabled.
    timersRef.current.forEach((timer, name) => {
      if (!enabledNames.has(name)) {
        clearTimeout(timer);
        timersRef.current.delete(name);
      }
    });

    // Remove stale items from state for extensions that were disabled.
    setStatusBarItems((prev) => {
      let changed = false;
      const next = new Map(prev);
      prev.forEach((_, name) => {
        if (!enabledNames.has(name)) {
          next.delete(name);
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    // Kick off an initial fetch for newly-enabled extensions.
    enabledExtensions.forEach((ext) => {
      const name: string = ext.manifest.name;
      // Only start a new cycle if one isn't already running/scheduled.
      if (!timersRef.current.has(name) && !inFlightRef.current.has(name)) {
        refreshExtRef.current?.(ext);
      }
    });

    return () => {
      // On cleanup cancel all pending timers (component unmount or dep change).
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [enabledExtensions]);

  /** Manually trigger an immediate refresh for all enabled extensions */
  const refreshStatusBar = useCallback(() => {
    setIsLoading(true);
    const pending = enabledExtensions.map((ext) => {
      const existing = timersRef.current.get(ext.manifest.name);
      if (existing !== undefined) {
        clearTimeout(existing);
        timersRef.current.delete(ext.manifest.name);
      }
      return refreshExtRef.current?.(ext);
    });
    Promise.all(pending).finally(() => setIsLoading(false));
  }, [enabledExtensions]);

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
      const result = await extension.hooks.statusBar();
      const { item: statusItem } = parseStatusBarResult(result, extension.manifest.statusBar);
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

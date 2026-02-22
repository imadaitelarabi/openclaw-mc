/**
 * Chat Link Matcher Registry
 *
 * A small, extension-agnostic registry that lets extensions intercept link
 * clicks inside chat messages and open an in-app panel instead of a new tab.
 *
 * Usage
 * -----
 * 1. Extensions call `chatLinkMatcherRegistry.register(matcher)` in their
 *    `setup()` function and `chatLinkMatcherRegistry.unregister(id)` in
 *    their `cleanup()` function.
 * 2. ChatMessageItem calls `chatLinkMatcherRegistry.match(url)` on every
 *    anchor click and opens the returned panel if a matcher fires.
 */

import type { PanelType } from "@/types/panel";

/**
 * The result returned by a matcher when it recognises a URL.
 * These values are forwarded directly to `openPanel(panelType, panelData)`.
 */
export interface ChatLinkMatchResult {
  panelType: PanelType;
  panelData: Record<string, unknown>;
}

/**
 * A single URL matcher contributed by an extension.
 */
export interface ChatLinkMatcher {
  /** Unique identifier for this matcher (typically the extension name). */
  id: string;

  /**
   * Optional priority — higher values are checked first.
   * Defaults to 0.
   */
  priority?: number;

  /**
   * Return a `ChatLinkMatchResult` when the URL should be handled in-app,
   * or `null` to let other matchers (and ultimately the browser) handle it.
   */
  match(url: string): ChatLinkMatchResult | null;
}

class ChatLinkMatcherRegistry {
  private matchers: ChatLinkMatcher[] = [];

  /**
   * Register a URL matcher.
   * Registering an id that already exists is a no-op (idempotent).
   */
  register(matcher: ChatLinkMatcher): void {
    if (this.matchers.some((m) => m.id === matcher.id)) {
      return;
    }
    this.matchers.push(matcher);
    // Keep sorted so higher-priority matchers run first.
    this.matchers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Unregister a URL matcher by its id (called when an extension is disabled).
   */
  unregister(id: string): void {
    this.matchers = this.matchers.filter((m) => m.id !== id);
  }

  /**
   * Try each registered matcher in priority order and return the first hit,
   * or `null` if no matcher claims the URL.
   */
  match(url: string): ChatLinkMatchResult | null {
    for (const matcher of this.matchers) {
      const result = matcher.match(url);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }
}

/** Singleton registry shared across the application. */
export const chatLinkMatcherRegistry = new ChatLinkMatcherRegistry();

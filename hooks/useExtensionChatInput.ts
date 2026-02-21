/**
 * Extension Hook: Chat Input Tagging
 * 
 * Hook for extensions to provide @ tagging functionality in chat input.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useExtensions } from '@/contexts/ExtensionContext';
import type { ChatInputTagOption, TaggerConfig } from '@/types/extension';
import { uiStateStore } from '@/lib/ui-state-db';

// Cache TTL: 5 minutes
const CACHE_MAX_AGE = 5 * 60 * 1000;

// Extension option ID prefix for identifying extension-level options (Level 1)
export const EXTENSION_OPTION_ID_PREFIX = 'ext-';

/**
 * Recursively extracts leaf nodes from a tree of ChatInputTagOptions.
 * Leaf nodes are options without children (or with empty children arrays).
 * For each leaf, the path of ancestor labels is joined and used as the subLevel
 * source attribute to provide context about where the result came from.
 *
 * @param options - Tree of tag options
 * @param sourceName - Top-level extension name (e.g. "Github")
 * @param ancestorLabels - Labels of ancestor nodes accumulated during recursion
 */
function flattenToLeaves(
  options: ChatInputTagOption[],
  sourceName: string,
  ancestorLabels: string[] = []
): ChatInputTagOption[] {
  const leaves: ChatInputTagOption[] = [];

  for (const option of options) {
    const hasChildren = Boolean(option.children && option.children.length > 0);

    if (hasChildren) {
      leaves.push(
        ...flattenToLeaves(option.children!, sourceName, [...ancestorLabels, option.label])
      );
    } else {
      const subLevel = ancestorLabels.length > 0 ? ancestorLabels.join(' › ') : undefined;
      leaves.push({ ...option, source: { name: sourceName, subLevel } });
    }
  }

  return leaves;
}

/**
 * Scores a leaf option against a normalized query for relevance sorting.
 * Returns 2 if the leaf's own content matches directly,
 * 1 if only the ancestor breadcrumb path matches,
 * 0 if there is no match at all.
 */
function scoreLeafRelevance(option: ChatInputTagOption, normalizedQuery: string): number {
  if (!normalizedQuery) {
    return 1;
  }

  const selfHaystack = [option.label, option.tag, option.description, option.value]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (selfHaystack.includes(normalizedQuery)) {
    return 2;
  }

  const pathHaystack = [option.source?.name, option.source?.subLevel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (pathHaystack.includes(normalizedQuery)) {
    return 1;
  }

  return 0;
}

function optionMatchesQuery(option: ChatInputTagOption, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    option.label,
    option.tag,
    option.description,
    option.value,
    option.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }

  return tokens.some(token => haystack.includes(token));
}

function filterTagOptions(options: ChatInputTagOption[], query: string): ChatInputTagOption[] {
  return options.reduce<ChatInputTagOption[]>((acc, option) => {
    const hasChildren = Boolean(option.children && option.children.length > 0);
    const filteredChildren = hasChildren ? filterTagOptions(option.children!, query) : undefined;
    const selfMatches = optionMatchesQuery(option, query);

    if (!selfMatches && (!filteredChildren || filteredChildren.length === 0)) {
      return acc;
    }

    if (selfMatches) {
      acc.push(option);
      return acc;
    }

    acc.push({
      ...option,
      children: filteredChildren,
    });

    return acc;
  }, []);
}

/**
 * Hook to get tag options from extensions based on query
 * 
 * Note: In-memory cache (cacheRef) is per-component instance. If multiple tabs/windows are open,
 * each maintains its own cache. IndexedDB provides persistence across sessions but not real-time
 * synchronization between tabs. This is acceptable since cache TTL is short (5 minutes) and
 * extension data changes infrequently.
 */
export function useExtensionChatInput() {
  const { enabledExtensions } = useExtensions();
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<Map<string, { data: ChatInputTagOption[]; timestamp: number }>>(new Map());

  // Load cached data on mount
  useEffect(() => {
    const loadCache = async () => {
      for (const ext of enabledExtensions) {
        if (ext.manifest.hooks.includes('chat-input')) {
          const cached = await uiStateStore.getExtensionDataCache(ext.manifest.name);
          if (cached && cached.data) {
            cacheRef.current.set(ext.manifest.name, {
              data: cached.data,
              timestamp: cached.timestamp
            });
          }
        }
      }
    };
    loadCache();
  }, [enabledExtensions]);

  /**
   * Get available taggers from enabled extensions
   */
  const getAvailableTaggers = useCallback((): TaggerConfig[] => {
    const taggers: TaggerConfig[] = [];

    for (const ext of enabledExtensions) {
      if (ext.manifest.hooks.includes('chat-input') && ext.manifest.taggers) {
        taggers.push(...ext.manifest.taggers);
      }
    }

    return taggers;
  }, [enabledExtensions]);

  const getExtensionOptionsWithChildren = useCallback(async (searchTerm?: string): Promise<ChatInputTagOption[]> => {
    const normalizedTerm = searchTerm?.trim().toLowerCase() ?? '';

    const matchingExtensions = enabledExtensions.filter(ext => {
      if (!ext.manifest.hooks.includes('chat-input')) {
        return false;
      }

      if (!normalizedTerm) {
        return true;
      }

      return (
        ext.manifest.name.toLowerCase().includes(normalizedTerm) ||
        ext.manifest.description.toLowerCase().includes(normalizedTerm)
      );
    });

    const extensionOptions = await Promise.all(
      matchingExtensions.map(async (ext): Promise<ChatInputTagOption> => {
        const extName = ext.manifest.name;
        const cached = cacheRef.current.get(extName);
        const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;

        let children = cached?.data ?? [];

        if ((!cached || cacheAge >= CACHE_MAX_AGE) && ext.hooks.chatInput) {
          try {
            const freshData = await ext.hooks.chatInput('');
            children = freshData;
            cacheRef.current.set(extName, {
              data: freshData,
              timestamp: Date.now()
            });
            await uiStateStore.saveExtensionDataCache(extName, freshData);
          } catch (error) {
            console.error(`[ChatInputHook] Error preloading options from ${extName}:`, error);
          }
        }

        return {
          id: `${EXTENSION_OPTION_ID_PREFIX}${extName}`,
          label: extName.charAt(0).toUpperCase() + extName.slice(1),
          tag: `@${extName}`,
          value: extName,
          description: ext.manifest.description,
          children,
        };
      })
    );

    return extensionOptions;
  }, [enabledExtensions]);

  /**
   * Search for tag options based on query
   * @param query - The search query (e.g., "@" shows extensions, "@GitHub PR" shows GitHub PRs)
   */
  const searchTags = useCallback(async (query: string): Promise<ChatInputTagOption[]> => {
    if (!query || !query.startsWith('@')) {
      return [];
    }

    // Remove @ and get the search term
    const searchTerm = query.slice(1).trim();

    // If query is just "@" or "@" with no specific extension, show extension list
    if (!searchTerm) {
      setIsLoading(true);
      try {
        return await getExtensionOptionsWithChildren();
      } finally {
        setIsLoading(false);
      }
    }

    // Check if searchTerm starts with an extension name
    const matchingExtension = enabledExtensions.find(ext => 
      ext.manifest.hooks.includes('chat-input') &&
      searchTerm.toLowerCase().startsWith(ext.manifest.name.toLowerCase())
    );

    if (matchingExtension) {
      // User is querying a specific extension (e.g., "@GitHub PR" or "@GitHub ")
      const extName = matchingExtension.manifest.name;
      const extQuery = searchTerm.slice(extName.length).trim();
      
      setIsLoading(true);
      
      try {
        // Check cache first
        const cached = cacheRef.current.get(extName);
        const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;

        // Return cached data immediately if fresh
        if (cached && cacheAge < CACHE_MAX_AGE) {
          setIsLoading(false);
          return filterTagOptions(cached.data, extQuery);
        }

        // Fetch fresh data and update cache (synchronous to ensure data consistency)
        // Pass empty string to fetch all unfiltered data for caching
        // Client-side filtering allows faster perceived performance on subsequent searches
        if (matchingExtension.hooks.chatInput) {
          const freshData = await matchingExtension.hooks.chatInput('');
          
          // Update cache with unfiltered data
          cacheRef.current.set(extName, {
            data: freshData,
            timestamp: Date.now()
          });
          await uiStateStore.saveExtensionDataCache(extName, freshData);

          return filterTagOptions(freshData, extQuery);
        }

        // Return cached data as fallback
        if (cached) {
          return filterTagOptions(cached.data, extQuery);
        }
      } catch (error) {
        console.error(`[ChatInputHook] Error getting options from ${extName}:`, error);
        
        // Return cached data on error if available
        const cached = cacheRef.current.get(extName);
        if (cached) {
          setIsLoading(false);
          return filterTagOptions(cached.data, extQuery);
        }
      } finally {
        setIsLoading(false);
      }

      return [];
    }

    // Generic query – run parallel search across all enabled extensions
    setIsLoading(true);
    try {
      const chatInputExtensions = enabledExtensions.filter(
        ext => ext.manifest.hooks.includes('chat-input') && ext.hooks.chatInput
      );

      const resultsPerExt = await Promise.all(
        chatInputExtensions.map(async (ext): Promise<ChatInputTagOption[]> => {
          try {
            const options = await ext.hooks.chatInput!(searchTerm);
            const sourceName = ext.manifest.name.charAt(0).toUpperCase() + ext.manifest.name.slice(1);
            return flattenToLeaves(options, sourceName);
          } catch (error) {
            console.error(`[ChatInputHook] Error searching ${ext.manifest.name}:`, error);
            return [];
          }
        })
      );

      const normalizedQuery = searchTerm.toLowerCase();
      return resultsPerExt
        .flat()
        .map(leaf => ({ leaf, score: scoreLeafRelevance(leaf, normalizedQuery) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ leaf }) => leaf);
    } finally {
      setIsLoading(false);
    }
  }, [enabledExtensions, getExtensionOptionsWithChildren]);

  /**
   * Get suggestions for a tagger prefix (e.g., "PR", "issue")
   */
  const getSuggestions = useCallback(async (prefix: string): Promise<ChatInputTagOption[]> => {
    setIsLoading(true);
    const options: ChatInputTagOption[] = [];

    try {
      // Find extensions that support this tagger prefix
      const relevantExtensions = enabledExtensions.filter(ext => 
        ext.manifest.hooks.includes('chat-input') &&
        ext.manifest.taggers?.some(t => 
          t.prefix.toLowerCase() === prefix.toLowerCase()
        ) &&
        ext.hooks.chatInput
      );

      const promises = relevantExtensions.map(async (ext) => {
        try {
          const extOptions = await ext.hooks.chatInput!(prefix);
          options.push(...extOptions);
        } catch (error) {
          console.error(`[ChatInputHook] Error getting suggestions from ${ext.manifest.name}:`, error);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('[ChatInputHook] Error getting suggestions:', error);
    } finally {
      setIsLoading(false);
    }

    return options;
  }, [enabledExtensions]);

  return {
    getAvailableTaggers,
    searchTags,
    getSuggestions,
    isLoading
  };
}

/**
 * Hook for managing tag input state in chat
 */
export function useChatTagging() {
  const [isTagging, setIsTagging] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [tagPosition, setTagPosition] = useState<number | null>(null);

  /**
   * Detect @ or # trigger near cursor and start tagging mode
   */
  const handleInput = useCallback((value: string, cursorPosition: number) => {
    const beforeCursor = value.slice(0, cursorPosition);

    // Match the active mention token nearest to cursor.
    // Rules:
    // - trigger (@ or #) must be at start of input or preceded by whitespace
    // - query may include spaces (supports "@github pr" and "#notes ideas")
    // - stop at newline or another trigger character
    const mentionMatch = beforeCursor.match(/(?:^|\s)([@#][^\n@#]*)$/);

    if (mentionMatch) {
      const activeToken = mentionMatch[1];
      const mentionStart = beforeCursor.length - activeToken.length;

      setIsTagging(true);
      setTagQuery(activeToken);
      setTagPosition(mentionStart);
      return;
    }

    // Not in tagging mode
    setIsTagging(false);
    setTagQuery('');
    setTagPosition(null);
  }, []);

  /**
   * Insert a tag into the input
   */
  const insertTag = useCallback((
    currentValue: string,
    tag: string,
    cursorCallback: (newPosition: number) => void
  ) => {
    if (tagPosition === null) {
      return currentValue;
    }

    // Replace @query with tag
    const before = currentValue.slice(0, tagPosition);
    const after = currentValue.slice(tagPosition + tagQuery.length);
    const newValue = `${before}${tag} ${after}`;

    // Update cursor position
    const newCursorPos = tagPosition + tag.length + 1;
    cursorCallback(newCursorPos);

    // Exit tagging mode
    setIsTagging(false);
    setTagQuery('');
    setTagPosition(null);

    return newValue;
  }, [tagPosition, tagQuery]);

  /**
   * Cancel tagging mode
   */
  const cancelTagging = useCallback(() => {
    setIsTagging(false);
    setTagQuery('');
    setTagPosition(null);
  }, []);

  return {
    isTagging,
    tagQuery,
    tagPosition,
    handleInput,
    insertTag,
    cancelTagging
  };
}

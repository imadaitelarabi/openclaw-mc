/**
 * Extension Hook: Chat Input Tagging
 * 
 * Hook for extensions to provide @ tagging functionality in chat input.
 */

import { useState, useCallback, useEffect } from 'react';
import { useExtensions } from '@/contexts/ExtensionContext';
import type { ChatInputTagOption, TaggerConfig } from '@/types/extension';

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
 */
export function useExtensionChatInput() {
  const { enabledExtensions } = useExtensions();
  const [isLoading, setIsLoading] = useState(false);

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

  /**
   * Search for tag options based on query
   * @param query - The search query (e.g., "@PR" or "@issue")
   */
  const searchTags = useCallback(async (query: string): Promise<ChatInputTagOption[]> => {
    if (!query || !query.startsWith('@')) {
      return [];
    }

    setIsLoading(true);
    const options: ChatInputTagOption[] = [];

    try {
      // Remove @ and get the search term
      const searchTerm = query.slice(1).trim();

      // Query all enabled extensions with chat-input hook
      const promises = enabledExtensions
        .filter(ext => 
          ext.manifest.hooks.includes('chat-input') && 
          ext.hooks.chatInput
        )
        .map(async (ext) => {
          try {
            const extOptions = await ext.hooks.chatInput!(searchTerm);
            options.push(...extOptions);
          } catch (error) {
            console.error(`[ChatInputHook] Error getting options from ${ext.manifest.name}:`, error);
          }
        });

      await Promise.all(promises);

      // Apply broad client-side filtering across labels, tags, descriptions,
      // and nested options. Keep nested structure for submenu UX.
      return filterTagOptions(options, searchTerm);
    } catch (error) {
      console.error('[ChatInputHook] Error searching tags:', error);
    } finally {
      setIsLoading(false);
    }

    return [];
  }, [enabledExtensions]);

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
   * Detect @ character and start tagging mode
   */
  const handleInput = useCallback((value: string, cursorPosition: number) => {
    // Find @ before cursor
    const beforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's a space after @
      const afterAt = beforeCursor.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        // We're in tagging mode
        setIsTagging(true);
        setTagQuery(beforeCursor.slice(lastAtIndex));
        setTagPosition(lastAtIndex);
        return;
      }
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

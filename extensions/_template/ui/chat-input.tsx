/**
 * Chat Input Component
 * 
 * Provides tagging options for chat input.
 * Called when user types @ in the chat input.
 */

import type { ChatInputTagOption } from '@/types/extension';
import { ExtensionAPI } from '../api';

/**
 * Get tag options based on query
 * @param query - Search query from user (without @ prefix)
 */
export async function getChatInputOptions(
  api: ExtensionAPI,
  query: string
): Promise<ChatInputTagOption[]> {
  try {
    // Search for items based on query
    const items = await api.searchItems(query);
    
    if (!items || items.length === 0) {
      return [];
    }

    // Map items to tag options
    return items.map(item => ({
      id: item.id,
      label: item.title || item.name,
      tag: `@TAG-${item.number || item.id}`,
      value: item.url || item.link,
      description: item.description || item.status,
      // Optionally add nested children
      children: item.children?.map((child: any) => ({
        id: child.id,
        label: child.title,
        tag: `@TAG-${child.number}`,
        value: child.url,
      })),
    }));
  } catch (error) {
    console.error('[ChatInput] Failed to get tag options:', error);
    return [];
  }
}

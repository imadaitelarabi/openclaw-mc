/**
 * Status Bar Component
 * 
 * Provides status bar data for the extension.
 * Called periodically to update the status bar.
 */

import type { StatusBarItem, StatusBarDropdownItem } from '@/types/extension';
import { ExtensionAPI } from '../api';

/**
 * Get status bar data
 * This function is called by the status bar hook
 */
export async function getStatusBarData(api: ExtensionAPI): Promise<StatusBarItem | null> {
  try {
    // Fetch data from API
    const data = await api.getStatusData();
    
    if (!data) {
      return null;
    }

    // Example: Return a status bar item with count and dropdown
    const items: StatusBarDropdownItem[] = [
      {
        id: 'item-1',
        text: 'Example Item 1',
        subtext: 'Additional info',
        copyValue: 'value-to-copy',
        openUrl: 'https://example.com/item-1',
      },
      {
        id: 'item-2',
        text: 'Example Item 2',
        copyValue: 'value-to-copy-2',
      },
    ];

    return {
      label: 'Extension',
      value: data.count || 0,
      icon: 'Box', // Match manifest.json
      items,
    };
  } catch (error) {
    console.error('[StatusBar] Failed to get status data:', error);
    return null;
  }
}

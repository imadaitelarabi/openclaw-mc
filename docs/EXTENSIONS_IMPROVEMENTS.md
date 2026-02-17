# Extensions System Improvements

This document describes the improvements made to the Extensions system for caching, menu hierarchy, and z-index handling.

## 1. Extension Data Caching

### Overview
Extension chat input data is now cached in IndexedDB to improve perceived performance on page refreshes.

### Implementation Details
- **Storage**: `ui-state-db` now includes an `extension-data-cache` store (version 5)
- **Cache TTL**: 5 minutes (300,000ms)
- **Cache Strategy**: Cache-first with background refresh
  - On mount, cached data is loaded immediately
  - Fresh data is fetched in background and cache is updated
  - If fresh fetch fails, cached data is used as fallback

### Code References
- `lib/ui-state-db.ts`: Database schema and cache methods
- `hooks/useExtensionChatInput.ts`: Cache loading and management logic

### Benefits
- Faster initial display of extension data
- Reduced API calls (respects 5-minute freshness window)
- Graceful fallback on network errors
- Persists across page refreshes

## 2. Hierarchical Menu for ChatInput "@" Tags

### Overview
The ChatInput "@" menu now uses a two-level hierarchy to reduce visual clutter when multiple extensions are enabled.

### User Flow
1. **Level 1 - Extension Selection**
   - User types `@`
   - Dropdown shows list of enabled extensions (e.g., "GitHub", "Linear")
   - Each extension shows its name and description

2. **Level 2 - Extension Data**
   - User selects an extension or types `@ExtensionName ` (with space)
   - Dropdown shows extension-specific data (PRs, Issues, etc.)
   - Cached data loads immediately while fresh data fetches in background

### Implementation Details
- Extension detection: Checks if search term starts with an extension name
- Extension options have `id` prefix of `ext-` for identification
- Dropdown stays open when selecting extension from Level 1
- After inserting extension tag, `handleInput` is called to show Level 2

### Code References
- `hooks/useExtensionChatInput.ts`: `searchTags()` method implements hierarchy logic
- `components/chat/ChatInput.tsx`: `handleSelectTagOption()` handles extension selection

### Benefits
- Cleaner UI with progressive disclosure
- Scales better with multiple extensions
- Reduces cognitive load on users
- Maintains fast access to frequently used items (via cache)

## 3. Dropdown Z-Index Fix with React Portal

### Overview
Extension dropdowns now use React Portal to escape panel stacking contexts, ensuring visibility in multi-panel layouts.

### Problem Solved
Previously, dropdowns rendered within panels were clipped or covered by adjacent panels in multi-panel view due to CSS stacking context limitations.

### Implementation Details
- **Portal Usage**: `createPortal()` renders dropdown to `document.body`
- **Positioning**: Fixed positioning based on input element's `getBoundingClientRect()`
- **Z-Index**: `z-index: 9999` ensures dropdown appears above all panels
- **Dynamic Updates**: Position recalculates on:
  - Initial render
  - Window resize
  - Window scroll
  - Options change

### Code References
- `components/extensions/ChatInputTagDropdown.tsx`: Portal implementation
- `components/chat/ChatInput.tsx`: Passes `inputRef` to dropdown

### Benefits
- Dropdowns always visible above panel boundaries
- Works in any layout configuration (1-panel, 2-panel, etc.)
- Handles edge cases (resize, scroll) gracefully
- No CSS hacks or workarounds needed

## Testing Recommendations

### Manual Testing Checklist
- [ ] Open app with GitHub extension enabled
- [ ] Type `@` in chat input → verify extension list appears
- [ ] Click "GitHub" → verify GitHub data loads
- [ ] Verify dropdown position is correct
- [ ] Open 2-panel layout → verify dropdown visible above both panels
- [ ] Refresh page → verify cached data loads immediately
- [ ] Wait 1-2 seconds → verify fresh data replaces cache
- [ ] Type `@GitHub PR` → verify PR list appears
- [ ] Close and reopen app → verify cache persists

### Edge Cases to Test
- [ ] Dropdown positioning near screen edges
- [ ] Dropdown with long option lists (scroll behavior)
- [ ] Multiple rapid extension selections
- [ ] Network failure (should show cached data)
- [ ] Cache expiry after 5 minutes
- [ ] Typing quickly through extension name

## Migration Notes

### Breaking Changes
None. This is a backward-compatible enhancement.

### Database Migration
- IndexedDB version bumped from 4 to 5
- New store `extension-data-cache` created automatically
- No manual migration needed

### Performance Impact
- **Positive**: Faster perceived load times due to caching
- **Positive**: Reduced API calls (respects cache TTL)
- **Neutral**: Minimal storage overhead in IndexedDB
- **Positive**: Portal rendering has negligible performance impact

## Future Enhancements

### Potential Improvements
1. **Configurable Cache TTL**: Allow users or extensions to configure cache duration
2. **Smart Cache Invalidation**: Invalidate cache on relevant events (e.g., new PR created)
3. **Prefetching**: Preload extension data when dropdown opens
4. **Keyboard Shortcuts**: Add hotkeys for common extension actions
5. **Extension Groups**: Allow grouping related extensions in the menu

### Extensibility Points
- Extensions can implement custom caching strategies via `setup()` hook
- Future extensions can leverage the same caching infrastructure
- Portal pattern can be reused for other dropdowns (status bar, etc.)

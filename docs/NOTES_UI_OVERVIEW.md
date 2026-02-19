# Notes Feature UI Overview

## Main Interface Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🎯 OpenClaw Mission Control                   [Agent] [+ New Agent]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────┬─────────────────────────────────────┐  │
│  │ Notes Panel             │ Chat Panel                          │  │
│  ├─────────────────────────┼─────────────────────────────────────┤  │
│  │ Commands Notes          │ Chat: ChatBot-01                    │  │
│  │ 3 notes                 │ Active session                      │  │
│  ├─────────────────────────┼─────────────────────────────────────┤  │
│  │                         │                                     │  │
│  │ ┌───────────────────┐  │                                     │  │
│  │ │ [Commands] 📋 🗑️ │  │    Chat messages would              │  │
│  │ │ npm install --... │  │    appear here                      │  │
│  │ │ 5 minutes ago     │  │                                     │  │
│  │ └───────────────────┘  │                                     │  │
│  │                         │                                     │  │
│  │ ┌───────────────────┐  │                                     │  │
│  │ │ [Commands] 📋 🗑️ │  │                                     │  │
│  │ │ docker-compose... │  │                                     │  │
│  │ │ 2 hours ago       │  │                                     │  │
│  │ └───────────────────┘  │                                     │  │
│  │                         │                                     │  │
│  │ ┌───────────────────┐  │                                     │  │
│  │ │ [Commands] 📋 🗑️ │  │                                     │  │
│  │ │ git checkout -b...│  │                                     │  │
│  │ │ 1 day ago         │  │                                     │  │
│  │ └───────────────────┘  │                                     │  │
│  │                         │                                     │  │
│  ├─────────────────────────┴─────────────────────────────────────┤  │
│  │ Group: [Commands ▼]                                           │  │
│  │ ┌──────────────────────────────┐ [🖼️]                        │  │
│  │ │ Write a note...              │ [Add]                        │  │
│  │ └──────────────────────────────┘                              │  │
│  │ Press Cmd/Ctrl + Enter to add note                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│ 🤖 ChatBot-01  │  ⏰ Next: Daily Backup in 2h  │                     │
│                │  📝 Notes (8) ▼  │  ⚙️ Settings  │  ● Connected     │
└──────────────────────────────────────────────────────────────────────┘
```

## Status Bar Notes Menu (Expanded)

When clicking "Notes (8) ▼" in the status bar:

```
                         ┌─────────────────────┐
                         │ Groups          [+] │
                         ├─────────────────────┤
                         │ All Notes         8 │
                         │ Commands          3 │
                         │ General           2 │
                         │ Ideas             2 │
                         │ Snippets          1 │
                         └─────────────────────┘
```

Clicking a group opens the Notes panel with that group pre-filtered.

## Key Features Illustrated

### 1. **Notes Panel Header**
   - Shows selected group name and count
   - Example: "Commands Notes - 3 notes"

### 2. **Note Cards**
   Each note displays:
   - Group badge (colored pill)
   - Copy button (📋) - Copies note content to clipboard
   - Delete button (🗑️) - Removes the note
   - Note content (text)
   - Timestamp (relative time, e.g., "5 minutes ago")
   - Optional: Image attachment (if imageUrl provided)

### 3. **Note Input Area**
   - Group selector dropdown
   - Multi-line text input
   - Image URL button (🖼️)
   - Add button
   - Keyboard hint: "Press Cmd/Ctrl + Enter to add note"

### 4. **Status Bar Integration**
   - Shows total note count: "Notes (8)"
   - Click to open dropdown menu
   - Groups listed with counts
   - "All Notes" option to view unfiltered

## Interaction Flow

### Adding a Note
1. User types content in textarea
2. User selects group from dropdown (or keeps current selection)
3. (Optional) User clicks 🖼️ to add image URL
4. User clicks "Add" or presses Cmd/Ctrl+Enter
5. Note appears at top of list (most recent first)
6. Input clears, ready for next note

### Filtering Notes
1. User clicks "Notes (8)" in status bar
2. Dropdown menu appears with groups
3. User selects a group (e.g., "Commands")
4. Notes panel opens with filter applied
5. Header shows "Commands Notes - 3 notes"

### Copying Notes
1. User hovers over a note card
2. Copy and Delete buttons become visible
3. User clicks 📋 copy button
4. Note content is copied to clipboard
5. Toast notification: "Copied to clipboard"

### Deleting Notes
1. User hovers over a note card
2. User clicks 🗑️ delete button
3. Note is immediately removed from list
4. Toast notification: "Note deleted"
5. Count updates in status bar

## Default Groups

The feature comes with 4 default groups:
- **General** - Miscellaneous notes
- **Commands** - CLI commands, scripts
- **Ideas** - Ideas and brainstorming
- **Snippets** - Code snippets

Users can create custom groups by typing a new name in the selector.

## Responsive Design

- Desktop: Notes panel appears side-by-side with chat panel
- Panel can be opened/closed independently
- Supports 2-panel layout (configurable)
- Status bar always visible at bottom

## Visual Highlights

- **Active Selection**: Status bar item highlighted when notes menu is open
- **Hover Effects**: Note cards highlight border on hover
- **Group Badges**: Color-coded by category
- **Copy/Delete**: Icons appear on hover for cleaner interface
- **Timestamps**: Human-readable relative times (e.g., "5 minutes ago", "2 hours ago")

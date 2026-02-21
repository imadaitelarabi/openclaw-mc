# Notes Feature Documentation

## Overview

The Notes feature allows users to store and categorize quick information directly within OpenClaw MC. Notes are persisted locally to `~/.oc-mission-control/notes.json` and synchronized in real-time via WebSocket.

## Architecture

### Backend Components

#### NotesManager (`server/core/NotesManager.ts`)

Handles persistent storage of notes to the file system.

**Key Methods:**

- `listNotes()` - Returns all notes
- `listAllTags()` - Returns sorted unique tags from all notes
- `listTagColors()` - Returns map of tag names to hex colors
- `setTagColor(tag, color)` - Sets custom hex color for a specific tag
- `addNote(content, group, tags?, imageUrl?)` - Creates a new note with optional tags
- `updateNote(id, updates)` - Updates an existing note (including tags)
- `deleteNote(id)` - Removes a note

**Storage:**

- File: `~/.oc-mission-control/notes.json`
- Format: JSON storage including notes, groups, and `tagColors` map
- Images: `~/.oc-mission-control/notes-images/` for local uploads
- Auto-creates directories if missing

#### Notes Handler (`server/handlers/notes.handler.ts`)

WebSocket message handlers for notes CRUD operations.

**Supported Messages:**

- `notes.list` - List all notes, groups, tags, and colors
- `notes.add` - Add a new note
- `notes.update` - Update a note
- `notes.delete` - Delete a note
- `notes.tags.color.set` - Set custom color for a tag

**Response Types:**

- `notes.list.response` - Returns array of notes, groups, allTags, and tagColors
- `notes.add.ack` - Confirms note creation and returns updated tagColors
- `notes.update.ack` - Confirms note update and returns updated tagColors
- `notes.delete.ack` - Confirms note deletion
- `notes.tags.color.set.ack` - Confirms new tag color
- `notes.*.error` - Error responses

### Frontend Components

#### NotesPanel (`components/notes/NotesPanel.tsx`)

Main panel component for displaying and managing notes.

**Features:**

- Lists notes filtered by selected group and active tag filters
- Tag filtering: Click tags to toggle multi-tag filter inclusion
- Sort by most recent first
- Inline copy button for each note
- Image attachment actions: Copy image to clipboard or download
- Delete button with confirmation
- Chat-like input for adding notes
- Group/category selector
- Multi-tag input with autocomplete and inline creation
- Image support: Upload, paste from clipboard, or URL
- Keyboard shortcut: `Enter` to add note (Shift+Enter for newline)

**Props:**

```typescript
interface NotesPanelProps {
  notes: Note[];
  groups: string[];
  allTags: string[];
  selectedGroup?: string | null;
  onAddNote: (content: string, group: string, tags?: string[], imageUrl?: string) => Promise<void>;
  onCreateGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => Promise<void>;
  onUploadNoteImage: (file: File) => Promise<string>;
  onDeleteNote: (id: string) => Promise<void>;
}
```

#### TagInput (`components/notes/TagInput.tsx`)

Inline multi-tag input with autocomplete support.

#### NotesStatusBarItem (`components/notes/NotesStatusBarItem.tsx`)

Status bar component showing notes count with dropdown for group selection.

**Features:**

- Shows total note count
- Dropdown menu with groups and counts
- "All Notes" option to show unfiltered view
- Quick access to open Notes panel

**Props:**

```typescript
interface NotesStatusBarItemProps {
  notes: Note[];
  groups?: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectGroup: (group: string | null) => void;
  onOpenNotes: () => void;
}
```

#### useNotes Hook (`hooks/useNotes.ts`)

React hook for WebSocket integration with notes backend.

**Features:**

- Auto-loads notes on mount or socket reconnect
- Real-time updates via WebSocket
- Promise-based async operations (add, update, delete, tag colors)
- Error handling and loading states

**Returns:**

```typescript
interface UseNotesReturn {
  notes: Note[];
  groups: string[];
  allTags: string[];
  tagColors: Record<string, string>;
  loading: boolean;
  error: string | null;
  addNote: (content, group, tags?, imageUrl?) => Promise<Note>;
  setTagColor: (tag, color) => Promise<Record<string, string>>;
  addGroup: (group) => Promise<string[]>;
  deleteGroup: (group) => Promise<string[]>;
  uploadNoteImage: (file) => Promise<string>;
  updateNote: (id, updates) => Promise<Note>;
  deleteNote: (id) => Promise<boolean>;
  refreshNotes: () => Promise<void>;
}
```

#### Native chat mentions (`hooks/useNativeChatInput.ts` + `components/chat/ChatInput.tsx`)

OpenClaw MC also exposes Notes directly in chat input via `#` mentions.

**Behavior:**

- Typing `#` opens native providers (currently Notes)
- `#notes` shows note groups, then notes within each group
- Selecting a note inserts its content into the chat input wrapped in `<note>...</note>`
- If the note includes an image, OpenClaw MC attempts to fetch and attach that image automatically
- The textarea auto-resizes after mention insertion for cleaner UX

### Type Definitions

#### Note (`types/note.ts`)

```typescript
interface Note {
  id: string; // UUID
  content: string; // Note text
  group: string; // Category (e.g., "Commands", "Ideas")
  tags?: string[]; // Multi-context tags
  createdAt: number; // Timestamp (ms)
  updatedAt: number; // Timestamp (ms)
  imageUrl?: string; // Optional image attachment (local or URL)
}
```

#### NoteGroup

```typescript
interface NoteGroup {
  name: string; // Group name
  count: number; // Number of notes in group
}
```

## Usage

### Opening Notes Panel

**From Status Bar:**

1. Click "Notes (X)" in the status bar
2. Select a group from the dropdown to filter
3. Click "+" icon to open notes panel with all notes

**From Code:**

```typescript
openPanel("notes", { selectedGroup: "Commands" });
```

### Adding a Note

1. Type content in the textarea
2. Select a group from the dropdown
3. Add tags in the tag input (autocomplete for existing, type for new)
4. Optionally add an image:
   - Click the image icon to upload
   - Paste an image directly into the textarea
   - Type an image URL (available via `updateNote` or internal methods)
5. Click the send icon or press `Enter`

### Managing Notes

- **Filter by Tags**: Click tags in the header or on cards to filter notes by one or more tags.
- **Copy Content**: Hover over a note and click the copy icon.
- **Copy/Download Image**: If a note has an image, hover to see copy-to-clipboard (browser permitting) or download icons.
- **Delete**: Hover over a note and click the trash icon.
- **Manage Groups**: In the input area group dropdown, hover over custom groups to see the delete icon. Note: "General" is a permanent fallback group.

### Using Notes in Chat via `#` Mentions

1. In any chat panel, type `#` to open native mention providers.
2. Select `Notes`, then optionally narrow by group (for example: `#notes Ideas`).
3. Pick a note from the dropdown.
4. OpenClaw MC inserts:
   ```text
   <note>
   ...note content...
   </note>
   ```
5. If the selected note has an image, it is auto-attached to the outgoing message when possible.

This workflow is useful for quickly grounding an agent with structured note context without copy/paste.

## WebSocket Protocol

### Client → Server

**List Notes:**

```json
{ "type": "notes.list", "requestId": "uuid" }
```

**Add Note:**

```json
{
  "type": "notes.add",
  "requestId": "uuid",
  "content": "Note content",
  "group": "Commands",
  "tags": ["cli", "setup"],
  "imageUrl": "..."
}
```

**Set Tag Color:**

```json
{
  "type": "notes.tags.color.set",
  "requestId": "uuid",
  "tag": "cli",
  "color": "#3b82f6"
}
```

**Update Note:**

```json
{
  "type": "notes.update",
  "requestId": "uuid",
  "id": "note-uuid",
  "content": "Updated content",
  "group": "Ideas",
  "tags": ["new-tag"]
}
```

**Delete Note:**

```json
{
  "type": "notes.delete",
  "requestId": "uuid",
  "id": "note-uuid"
}
```

### Server → Client

**List Response:**

```json
{
  "type": "notes.list.response",
  "requestId": "uuid",
  "notes": [...],
  "groups": [...],
  "allTags": [...],
  "tagColors": { "cli": "#3b82f6", ... }
}
```

**Add/Update Acknowledgment:**

```json
{
  "type": "notes.add.ack",
  "requestId": "uuid",
  "note": { /* Note object */ },
  "tagColors": { ... }
}
```

**Tag Color Acknowledgment:**

```json
{
  "type": "notes.tags.color.set.ack",
  "requestId": "uuid",
  "tag": "cli",
  "color": "#3b82f6",
  "tagColors": { ... }
}
```

**Delete Acknowledgment:**

```json
{
  "type": "notes.delete.ack",
  "requestId": "uuid",
  "id": "note-uuid"
}
```

**Error Response:**

```json
{
  "type": "notes.*.error",
  "requestId": "uuid",
  "error": "Error message"
}
```

## File Structure

```
openclaw-mc/
├── server/
│   ├── core/
│   │   └── NotesManager.ts          # Note persistence manager + color generation
│   ├── handlers/
│   │   ├── index.ts                 # Handler registration
│   │   └── notes.handler.ts         # WebSocket handlers
│   └── types/
│       └── internal.ts              # ClientMessage/ServerMessage types
├── lib/
│   └── tag-colors.ts                # Client-side color normalization and RGBA conversion
├── components/
│   └── notes/
│       ├── index.ts                 # Barrel export
│       ├── NotesPanel.tsx           # Main notes panel
│       ├── TagInput.tsx             # Multi-tag input component
│       └── NotesStatusBarItem.tsx   # Status bar component
├── hooks/
│   ├── index.ts                     # Hook exports
│   └── useNotes.ts                  # Notes hook
└── types/
    ├── index.ts                     # Type exports
    ├── note.ts                      # Note types
    └── panel.ts                     # Panel type union
```

## Testing

The NotesManager has been tested with the following operations:

- ✅ Instantiation and initialization
- ✅ Adding notes with content, group, and multiple tags
- ✅ Image paste and upload support
- ✅ Listing all notes and associated tag colors
- ✅ Setting custom tag colors with hex validation
- ✅ Deleting notes and groups (moving orphaned notes to General)
- ✅ Persistence to file system and binary image storage
- ✅ Tag filter multi-selection logic

## Future Enhancements

Possible improvements for future versions:

- Rich text / Markdown rendering in note content
- Note search by text content
- Tag color picker UI (currently hex via API/manual config)
- Drag-and-drop reordering for groups
- Export notes to PDF/Markdown bundle
- Note versioning and change history

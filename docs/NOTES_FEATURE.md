# Notes Feature Documentation

## Overview
The Notes feature allows users to store and categorize quick information directly within Mission Control. Notes are persisted locally to `~/.oc-mission-control/notes.json` and synchronized in real-time via WebSocket.

## Architecture

### Backend Components

#### NotesManager (`server/core/NotesManager.ts`)
Handles persistent storage of notes to the file system.

**Key Methods:**
- `listNotes()` - Returns all notes
- `addNote(content, group, imageUrl?)` - Creates a new note
- `updateNote(id, updates)` - Updates an existing note
- `deleteNote(id)` - Removes a note

**Storage:**
- File: `~/.oc-mission-control/notes.json`
- Format: JSON array of Note objects
- Auto-creates directory if missing

#### Notes Handler (`server/handlers/notes.handler.ts`)
WebSocket message handlers for notes CRUD operations.

**Supported Messages:**
- `notes.list` - List all notes
- `notes.add` - Add a new note
- `notes.update` - Update a note
- `notes.delete` - Delete a note

**Response Types:**
- `notes.list.response` - Returns array of notes
- `notes.add.ack` - Confirms note creation
- `notes.update.ack` - Confirms note update
- `notes.delete.ack` - Confirms note deletion
- `notes.*.error` - Error responses

### Frontend Components

#### NotesPanel (`components/notes/NotesPanel.tsx`)
Main panel component for displaying and managing notes.

**Features:**
- Lists notes filtered by selected group
- Sort by most recent first
- Inline copy button for each note
- Delete button with confirmation
- Chat-like input for adding notes
- Group/category selector
- Optional image URL attachment
- Keyboard shortcut: `Cmd/Ctrl + Enter` to add note

**Props:**
```typescript
interface NotesPanelProps {
  notes: Note[];
  selectedGroup?: string | null;
  onAddNote: (content: string, group: string, imageUrl?: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}
```

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
  isOpen: boolean;
  onToggle: () => void;
  onSelectGroup: (group: string | null) => void;
  onOpenNotes: () => void;
}
```

#### useNotes Hook (`hooks/useNotes.ts`)
React hook for WebSocket integration with notes backend.

**Features:**
- Auto-loads notes on mount
- Real-time updates via WebSocket
- Promise-based async operations
- Error handling and loading states

**Returns:**
```typescript
interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: string | null;
  addNote: (content, group, imageUrl?) => Promise<Note>;
  updateNote: (id, updates) => Promise<Note>;
  deleteNote: (id) => Promise<boolean>;
  refreshNotes: () => Promise<void>;
}
```

### Type Definitions

#### Note (`types/note.ts`)
```typescript
interface Note {
  id: string;              // UUID
  content: string;         // Note text
  group: string;           // Category (e.g., "Commands", "Ideas")
  createdAt: number;       // Timestamp (ms)
  updatedAt: number;       // Timestamp (ms)
  imageUrl?: string;       // Optional image attachment
}
```

#### NoteGroup
```typescript
interface NoteGroup {
  name: string;            // Group name
  count: number;           // Number of notes in group
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
openPanel('notes', { selectedGroup: 'Commands' });
```

### Adding a Note

1. Type content in the textarea
2. Select a group from the dropdown (General, Commands, Ideas, Snippets, or custom)
3. Optionally add an image URL by clicking the image icon
4. Click "Add" or press `Cmd/Ctrl + Enter`

### Managing Notes

- **Copy**: Hover over a note and click the copy icon
- **Delete**: Hover over a note and click the trash icon
- **Filter**: Use the status bar dropdown to filter by group

## Default Groups

The Notes feature comes with 4 default groups:
- **General** - Miscellaneous notes
- **Commands** - CLI commands, scripts
- **Ideas** - Ideas and brainstorming
- **Snippets** - Code snippets

Users can create custom groups by typing a new name in the group selector.

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
  "imageUrl": "https://example.com/image.png"
}
```

**Update Note:**
```json
{
  "type": "notes.update",
  "requestId": "uuid",
  "id": "note-uuid",
  "content": "Updated content",
  "group": "Ideas"
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
  "notes": [
    {
      "id": "uuid",
      "content": "Note content",
      "group": "Commands",
      "createdAt": 1234567890,
      "updatedAt": 1234567890,
      "imageUrl": "https://example.com/image.png"
    }
  ]
}
```

**Add/Update Acknowledgment:**
```json
{
  "type": "notes.add.ack",
  "requestId": "uuid",
  "note": { /* Note object */ }
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
│   │   └── NotesManager.ts          # Note persistence manager
│   ├── handlers/
│   │   ├── index.ts                 # Handler registration
│   │   └── notes.handler.ts         # WebSocket handlers
│   └── types/
│       └── internal.ts              # ClientMessage/ServerMessage types
├── components/
│   └── notes/
│       ├── index.ts                 # Barrel export
│       ├── NotesPanel.tsx           # Main notes panel
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
- ✅ Adding notes with content and group
- ✅ Adding notes with optional image URLs
- ✅ Listing all notes
- ✅ Updating note content
- ✅ Deleting notes
- ✅ Persistence to file system

## Future Enhancements

Possible improvements for future versions:
- Rich text formatting support
- File attachments (not just URLs)
- Search/filter functionality
- Tags in addition to groups
- Export notes to markdown
- Note sharing between team members
- Markdown rendering in note content

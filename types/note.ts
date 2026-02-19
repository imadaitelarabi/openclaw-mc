/**
 * Notes Feature Type Definitions
 */

export interface Note {
  id: string;              // Unique note ID (UUID)
  content: string;         // Note text content
  group: string;           // Category/group (e.g., "Commands", "Ideas", "Snippets")
  createdAt: number;       // Timestamp in milliseconds
  updatedAt: number;       // Timestamp in milliseconds
  imageUrl?: string;       // Optional image attachment URL/path
}

export interface NoteGroup {
  name: string;            // Group name
  count: number;           // Number of notes in this group
}

export interface NotesState {
  notes: Note[];
  groups: NoteGroup[];
}

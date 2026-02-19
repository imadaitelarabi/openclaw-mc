/**
 * Notes Handler
 * Handles notes CRUD operations
 */

import type { ExtendedWebSocket } from '../types/internal';
import { NotesManager } from '../core/NotesManager';

// Singleton notes manager
const notesManager = new NotesManager();

/**
 * List all notes
 */
export async function handleNotesList(
  msg: any,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId } = msg;

  try {
    const notes = notesManager.listNotes();
    ws.send(
      JSON.stringify({
        type: 'notes.list.response',
        requestId,
        notes,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.list.error',
        requestId,
        error: (err as Error).message || 'Failed to list notes',
      })
    );
  }
}

/**
 * Add a new note
 */
export async function handleNotesAdd(
  msg: any,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, content, group, imageUrl } = msg;

  if (!content || !group) {
    ws.send(
      JSON.stringify({
        type: 'notes.add.error',
        requestId,
        error: 'Content and group are required',
      })
    );
    return;
  }

  try {
    const note = notesManager.addNote(content, group, imageUrl);
    ws.send(
      JSON.stringify({
        type: 'notes.add.ack',
        requestId,
        note,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.add.error',
        requestId,
        error: (err as Error).message || 'Failed to add note',
      })
    );
  }
}

/**
 * Update an existing note
 */
export async function handleNotesUpdate(
  msg: any,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, id, content, group, imageUrl } = msg;

  if (!id) {
    ws.send(
      JSON.stringify({
        type: 'notes.update.error',
        requestId,
        error: 'Note ID is required',
      })
    );
    return;
  }

  try {
    const updates: any = {};
    if (content !== undefined) updates.content = content;
    if (group !== undefined) updates.group = group;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

    const note = notesManager.updateNote(id, updates);
    ws.send(
      JSON.stringify({
        type: 'notes.update.ack',
        requestId,
        note,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.update.error',
        requestId,
        error: (err as Error).message || 'Failed to update note',
      })
    );
  }
}

/**
 * Delete a note
 */
export async function handleNotesDelete(
  msg: any,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, id } = msg;

  if (!id) {
    ws.send(
      JSON.stringify({
        type: 'notes.delete.error',
        requestId,
        error: 'Note ID is required',
      })
    );
    return;
  }

  try {
    const deleted = notesManager.deleteNote(id);
    if (!deleted) {
      ws.send(
        JSON.stringify({
          type: 'notes.delete.error',
          requestId,
          error: 'Note not found',
        })
      );
      return;
    }

    ws.send(
      JSON.stringify({
        type: 'notes.delete.ack',
        requestId,
        id,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.delete.error',
        requestId,
        error: (err as Error).message || 'Failed to delete note',
      })
    );
  }
}

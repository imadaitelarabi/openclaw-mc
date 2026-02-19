/**
 * Notes Handler
 * Handles notes CRUD operations
 */

import type { ExtendedWebSocket, ClientMessage, Note } from '../types/internal';
import { NotesManager } from '../core/NotesManager';

// Singleton notes manager
const notesManager = new NotesManager();

/**
 * List all notes
 */
export async function handleNotesList(
  msg: Extract<ClientMessage, { type: 'notes.list' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId } = msg;

  try {
    const notes = notesManager.listNotes();
    const groups = notesManager.listGroups();
    const allTags = notesManager.listAllTags();
    const tagColors = notesManager.listTagColors();
    ws.send(
      JSON.stringify({
        type: 'notes.list.response',
        requestId,
        notes,
        groups,
        allTags,
        tagColors,
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
 * List note groups
 */
export async function handleNotesGroupsList(
  msg: Extract<ClientMessage, { type: 'notes.groups.list' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId } = msg;

  try {
    const groups = notesManager.listGroups();
    ws.send(
      JSON.stringify({
        type: 'notes.groups.list.response',
        requestId,
        groups,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.groups.list.error',
        requestId,
        error: (err as Error).message || 'Failed to list groups',
      })
    );
  }
}

/**
 * Add note group
 */
export async function handleNotesGroupsAdd(
  msg: Extract<ClientMessage, { type: 'notes.groups.add' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, group } = msg;

  if (!group?.trim()) {
    ws.send(
      JSON.stringify({
        type: 'notes.groups.add.error',
        requestId,
        error: 'Group name is required',
      })
    );
    return;
  }

  try {
    const groups = notesManager.addGroup(group);
    ws.send(
      JSON.stringify({
        type: 'notes.groups.add.ack',
        requestId,
        groups,
        group: group.trim(),
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.groups.add.error',
        requestId,
        error: (err as Error).message || 'Failed to add group',
      })
    );
  }
}

/**
 * Delete note group
 */
export async function handleNotesGroupsDelete(
  msg: Extract<ClientMessage, { type: 'notes.groups.delete' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, group } = msg;

  if (!group?.trim()) {
    ws.send(
      JSON.stringify({
        type: 'notes.groups.delete.error',
        requestId,
        error: 'Group name is required',
      })
    );
    return;
  }

  try {
    const groups = notesManager.deleteGroup(group);
    const notes = notesManager.listNotes();
    ws.send(
      JSON.stringify({
        type: 'notes.groups.delete.ack',
        requestId,
        groups,
        notes,
        group: group.trim(),
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.groups.delete.error',
        requestId,
        error: (err as Error).message || 'Failed to delete group',
      })
    );
  }
}

/**
 * Upload note image
 */
export async function handleNotesImageUpload(
  msg: Extract<ClientMessage, { type: 'notes.image.upload' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, media, mimeType, fileName } = msg;

  if (!media) {
    ws.send(
      JSON.stringify({
        type: 'notes.image.upload.error',
        requestId,
        error: 'Image payload is required',
      })
    );
    return;
  }

  try {
    const imageUrl = notesManager.saveImage(media, mimeType, fileName);
    ws.send(
      JSON.stringify({
        type: 'notes.image.upload.ack',
        requestId,
        imageUrl,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.image.upload.error',
        requestId,
        error: (err as Error).message || 'Failed to upload image',
      })
    );
  }
}

/**
 * Add a new note
 */
export async function handleNotesAdd(
  msg: Extract<ClientMessage, { type: 'notes.add' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, content, group, tags, imageUrl } = msg;

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
    const note = notesManager.addNote(content, group, tags, imageUrl);
    const tagColors = notesManager.listTagColors();
    ws.send(
      JSON.stringify({
        type: 'notes.add.ack',
        requestId,
        note,
        tagColors,
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
  msg: Extract<ClientMessage, { type: 'notes.update' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, id, content, group, tags, imageUrl } = msg;

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
    const updates: Partial<Omit<Note, 'id' | 'createdAt'>> = {};
    if (content !== undefined) updates.content = content;
    if (group !== undefined) updates.group = group;
    if (tags !== undefined) updates.tags = tags;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

    const note = notesManager.updateNote(id, updates);
    const tagColors = notesManager.listTagColors();
    ws.send(
      JSON.stringify({
        type: 'notes.update.ack',
        requestId,
        note,
        tagColors,
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
  msg: Extract<ClientMessage, { type: 'notes.delete' }>,
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

/**
 * Set a global color for a tag
 */
export async function handleNotesTagColorSet(
  msg: Extract<ClientMessage, { type: 'notes.tags.color.set' }>,
  ws: ExtendedWebSocket
): Promise<void> {
  const { requestId, tag, color } = msg;

  if (!tag?.trim() || !color?.trim()) {
    ws.send(
      JSON.stringify({
        type: 'notes.tags.color.set.error',
        requestId,
        error: 'Tag and color are required',
      })
    );
    return;
  }

  try {
    const tagColors = notesManager.setTagColor(tag, color);
    ws.send(
      JSON.stringify({
        type: 'notes.tags.color.set.ack',
        requestId,
        tag,
        color,
        tagColors,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'notes.tags.color.set.error',
        requestId,
        error: (err as Error).message || 'Failed to set tag color',
      })
    );
  }
}

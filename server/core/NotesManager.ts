/**
 * Notes Manager
 * Manages notes persistence to ~/.oc-mission-control/notes.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { Note } from '../types/internal';

export class NotesManager {
  private notesPath: string;
  private notes: Note[] = [];

  constructor() {
    const configDir = path.join(os.homedir(), '.oc-mission-control');
    this.notesPath = path.join(configDir, 'notes.json');
    this.ensureConfigDir(configDir);
    this.loadNotes();
  }

  private ensureConfigDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadNotes(): void {
    try {
      if (fs.existsSync(this.notesPath)) {
        const data = fs.readFileSync(this.notesPath, 'utf-8');
        this.notes = JSON.parse(data);
      }
    } catch (err) {
      console.error('[NotesManager] Failed to load notes:', err);
      this.notes = [];
    }
  }

  private saveNotes(): void {
    try {
      fs.writeFileSync(this.notesPath, JSON.stringify(this.notes, null, 2), 'utf-8');
    } catch (err) {
      console.error('[NotesManager] Failed to save notes:', err);
      throw new Error('Failed to save notes');
    }
  }

  /**
   * List all notes
   */
  public listNotes(): Note[] {
    return this.notes;
  }

  /**
   * Add a new note
   */
  public addNote(content: string, group: string, imageUrl?: string): Note {
    const now = Date.now();
    const note: Note = {
      id: uuidv4(),
      content,
      group,
      createdAt: now,
      updatedAt: now,
      imageUrl,
    };

    this.notes.push(note);
    this.saveNotes();
    return note;
  }

  /**
   * Update an existing note
   */
  public updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>): Note {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) {
      throw new Error(`Note not found: ${id}`);
    }

    const note = this.notes[index];
    this.notes[index] = {
      ...note,
      ...updates,
      updatedAt: Date.now(),
    };

    this.saveNotes();
    return this.notes[index];
  }

  /**
   * Delete a note
   */
  public deleteNote(id: string): boolean {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) {
      return false;
    }

    this.notes.splice(index, 1);
    this.saveNotes();
    return true;
  }
}

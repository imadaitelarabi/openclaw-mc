/**
 * Notes Manager
 * Manages notes persistence to ~/.oc-mission-control/notes.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { Note } from '../types/internal';

interface NotesStorage {
  notes: Note[];
  groups: string[];
  tagColors?: Record<string, string>;
}

const DEFAULT_NOTE_GROUPS = ['General', 'Commands', 'Ideas', 'Snippets'];
const FALLBACK_GROUP = 'General';

export class NotesManager {
  private configDir: string;
  private notesPath: string;
  private imagesDir: string;
  private notes: Note[] = [];
  private groups: string[] = [...DEFAULT_NOTE_GROUPS];
  private tagColors: Record<string, string> = {};

  constructor() {
    this.configDir = path.join(os.homedir(), '.oc-mission-control');
    this.notesPath = path.join(this.configDir, 'notes.json');
    this.imagesDir = path.join(this.configDir, 'notes-images');
    this.ensureConfigDir(this.configDir);
    this.ensureConfigDir(this.imagesDir);
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
        const parsed = JSON.parse(data) as Note[] | NotesStorage;

        if (Array.isArray(parsed)) {
          this.notes = parsed;
          this.groups = this.mergeGroups([FALLBACK_GROUP], this.notes.map(note => note.group));
          this.tagColors = {};
        } else {
          this.notes = Array.isArray(parsed.notes) ? parsed.notes : [];
          const persistedGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
          this.groups = this.mergeGroups([FALLBACK_GROUP], persistedGroups, this.notes.map(note => note.group));
          this.tagColors = (parsed.tagColors && typeof parsed.tagColors === 'object')
            ? parsed.tagColors
            : {};
        }

        this.ensureTagColors(this.listAllTags());
      } else {
        this.groups = [...DEFAULT_NOTE_GROUPS];
        this.tagColors = {};
        this.saveNotes();
      }
    } catch (err) {
      console.error('[NotesManager] Failed to load notes:', err);
      this.notes = [];
      this.groups = [...DEFAULT_NOTE_GROUPS];
      this.tagColors = {};
    }
  }

  private saveNotes(): void {
    try {
      const payload: NotesStorage = {
        notes: this.notes,
        groups: this.groups,
        tagColors: this.tagColors,
      };

      fs.writeFileSync(this.notesPath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('[NotesManager] Failed to save notes:', err);
      throw new Error('Failed to save notes');
    }
  }

  private mergeGroups(...groupSets: string[][]): string[] {
    const normalized = new Map<string, string>();

    for (const set of groupSets) {
      for (const group of set) {
        const trimmed = typeof group === 'string' ? group.trim() : '';
        if (!trimmed) {
          continue;
        }

        const key = trimmed.toLowerCase();
        if (!normalized.has(key)) {
          normalized.set(key, trimmed);
        }
      }
    }

    return Array.from(normalized.values()).sort((a, b) => a.localeCompare(b));
  }

  private normalizeGroupName(group: string): string {
    const normalized = group.trim();
    if (!normalized) {
      throw new Error('Group name cannot be empty');
    }
    return normalized;
  }

  private isManagedImageUrl(imageUrl: string): boolean {
    return imageUrl.startsWith('/api/notes/images/');
  }

  private resolveImagePathFromUrl(imageUrl: string): string {
    const fileName = path.basename(decodeURIComponent(imageUrl.replace('/api/notes/images/', '')));
    return path.join(this.imagesDir, fileName);
  }

  private deleteImageIfUnused(imageUrl?: string): void {
    if (!imageUrl || !this.isManagedImageUrl(imageUrl)) {
      return;
    }

    const isStillReferenced = this.notes.some(note => note.imageUrl === imageUrl);
    if (isStillReferenced) {
      return;
    }

    const imagePath = this.resolveImagePathFromUrl(imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  private extensionFromMimeType(mimeType: string): string {
    const lookup: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };

    return lookup[mimeType.toLowerCase()] ?? '.bin';
  }

  public getImagesDir(): string {
    return this.imagesDir;
  }

  /**
   * List all notes
   */
  public listNotes(): Note[] {
    return this.notes;
  }

  public listGroups(): string[] {
    return this.groups;
  }

  public addGroup(group: string): string[] {
    const normalized = this.normalizeGroupName(group);
    this.groups = this.mergeGroups(this.groups, [normalized]);
    this.saveNotes();
    return this.groups;
  }

  public deleteGroup(group: string): string[] {
    const normalized = this.normalizeGroupName(group);

    if (normalized.toLowerCase() === FALLBACK_GROUP.toLowerCase()) {
      throw new Error('General group cannot be deleted');
    }

    const existingGroup = this.groups.find(
      existing => existing.toLowerCase() === normalized.toLowerCase()
    );

    if (!existingGroup) {
      throw new Error(`Group not found: ${normalized}`);
    }

    this.groups = this.groups.filter(
      existing => existing.toLowerCase() !== normalized.toLowerCase()
    );
    this.groups = this.mergeGroups(this.groups, [FALLBACK_GROUP]);

    const now = Date.now();
    this.notes = this.notes.map(note => {
      if (note.group.toLowerCase() !== normalized.toLowerCase()) {
        return note;
      }

      return {
        ...note,
        group: FALLBACK_GROUP,
        updatedAt: now,
      };
    });

    this.saveNotes();
    return this.groups;
  }

  public saveImage(media: string, mimeType?: string, fileName?: string): string {
    const dataUriMatch = /^data:(?<mime>[^;]+);base64,(?<content>[\s\S]+)$/i.exec(media);
    const base64Content = dataUriMatch?.groups?.content;
    const detectedMimeType = mimeType || dataUriMatch?.groups?.mime;

    if (!base64Content || !detectedMimeType || !detectedMimeType.startsWith('image/')) {
      throw new Error('Invalid image payload');
    }

    const safeBaseName = fileName
      ? path.parse(path.basename(fileName)).name.replace(/[^a-zA-Z0-9-_]/g, '_')
      : 'note-image';
    const extension = this.extensionFromMimeType(detectedMimeType);
    const storedFileName = `${safeBaseName || 'note-image'}-${uuidv4()}${extension}`;
    const imagePath = path.join(this.imagesDir, storedFileName);

    fs.writeFileSync(imagePath, Buffer.from(base64Content, 'base64'));

    return `/api/notes/images/${encodeURIComponent(storedFileName)}`;
  }

  public listAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const note of this.notes) {
      if (Array.isArray(note.tags)) {
        for (const tag of note.tags) {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        }
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  private normalizeHexColor(color: string): string {
    const trimmed = color.trim();
    const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
    if (!hexMatch) {
      throw new Error('Invalid color. Use hex format like #3b82f6');
    }

    const hex = hexMatch[1];
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
    }

    return `#${hex.toLowerCase()}`;
  }

  private hashTag(tag: string): number {
    let hash = 0;
    for (let index = 0; index < tag.length; index += 1) {
      hash = ((hash << 5) - hash) + tag.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private hslToHex(hue: number, saturation: number, lightness: number): string {
    const normalizedS = saturation / 100;
    const normalizedL = lightness / 100;
    const chroma = (1 - Math.abs((2 * normalizedL) - 1)) * normalizedS;
    const huePrime = hue / 60;
    const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

    let redPrime = 0;
    let greenPrime = 0;
    let bluePrime = 0;

    if (huePrime >= 0 && huePrime < 1) {
      redPrime = chroma;
      greenPrime = secondComponent;
    } else if (huePrime >= 1 && huePrime < 2) {
      redPrime = secondComponent;
      greenPrime = chroma;
    } else if (huePrime >= 2 && huePrime < 3) {
      greenPrime = chroma;
      bluePrime = secondComponent;
    } else if (huePrime >= 3 && huePrime < 4) {
      greenPrime = secondComponent;
      bluePrime = chroma;
    } else if (huePrime >= 4 && huePrime < 5) {
      redPrime = secondComponent;
      bluePrime = chroma;
    } else {
      redPrime = chroma;
      bluePrime = secondComponent;
    }

    const offset = normalizedL - (chroma / 2);
    const red = Math.round((redPrime + offset) * 255);
    const green = Math.round((greenPrime + offset) * 255);
    const blue = Math.round((bluePrime + offset) * 255);

    const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
  }

  private generateTagColor(tag: string): string {
    const hash = this.hashTag(tag.toLowerCase());
    const hue = hash % 360;
    const saturation = 58 + (hash % 12);
    const lightness = 42 + (hash % 10);
    return this.hslToHex(hue, saturation, lightness);
  }

  private ensureTagColors(tags: string[]): boolean {
    let changed = false;
    for (const tag of tags) {
      if (!this.tagColors[tag]) {
        this.tagColors[tag] = this.generateTagColor(tag);
        changed = true;
      }
    }
    return changed;
  }

  public listTagColors(): Record<string, string> {
    const tags = this.listAllTags();
    const changed = this.ensureTagColors(tags);
    if (changed) {
      this.saveNotes();
    }

    const response: Record<string, string> = {};
    for (const tag of tags) {
      if (this.tagColors[tag]) {
        response[tag] = this.tagColors[tag];
      }
    }
    return response;
  }

  public setTagColor(tag: string, color: string): Record<string, string> {
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
      throw new Error('Tag is required');
    }

    const allTags = this.listAllTags();
    if (!allTags.some(existing => existing.toLowerCase() === normalizedTag.toLowerCase())) {
      throw new Error(`Unknown tag: ${normalizedTag}`);
    }

    const canonicalTag = allTags.find(existing => existing.toLowerCase() === normalizedTag.toLowerCase()) || normalizedTag;
    this.tagColors[canonicalTag] = this.normalizeHexColor(color);
    this.saveNotes();
    return this.listTagColors();
  }

  public deleteTag(tag: string): { notes: Note[]; allTags: string[]; tagColors: Record<string, string> } {
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
      throw new Error('Tag is required');
    }

    const allTags = this.listAllTags();
    const canonicalTag = allTags.find(existing => existing.toLowerCase() === normalizedTag.toLowerCase());
    if (!canonicalTag) {
      throw new Error(`Unknown tag: ${normalizedTag}`);
    }

    const now = Date.now();
    this.notes = this.notes.map(note => {
      if (!Array.isArray(note.tags) || note.tags.length === 0) {
        return note;
      }

      const nextTags = note.tags.filter(existing => existing.toLowerCase() !== canonicalTag.toLowerCase());
      if (nextTags.length === note.tags.length) {
        return note;
      }

      return {
        ...note,
        tags: nextTags,
        updatedAt: now,
      };
    });

    delete this.tagColors[canonicalTag];

    this.saveNotes();

    const remainingTags = this.listAllTags();
    const tagColors = this.listTagColors();
    return {
      notes: this.notes,
      allTags: remainingTags,
      tagColors,
    };
  }

  /**
   * Add a new note
   */
  public addNote(content: string, group: string, tags?: string[], imageUrl?: string): Note {
    const normalizedGroup = this.normalizeGroupName(group);
    this.groups = this.mergeGroups(this.groups, [normalizedGroup]);

    const now = Date.now();
    const note: Note = {
      id: uuidv4(),
      content,
      group: normalizedGroup,
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
      imageUrl,
    };

    this.notes.push(note);
    if (Array.isArray(note.tags) && note.tags.length > 0) {
      this.ensureTagColors(note.tags);
    }
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

    const previousNote = this.notes[index];
    const nextGroup = updates.group !== undefined ? this.normalizeGroupName(updates.group) : undefined;
    if (nextGroup) {
      this.groups = this.mergeGroups(this.groups, [nextGroup]);
    }

    const normalizedTags = updates.tags !== undefined
      ? updates.tags.map(t => t.trim()).filter(Boolean)
      : undefined;

    const note = this.notes[index];
    this.notes[index] = {
      ...note,
      ...updates,
      ...(nextGroup ? { group: nextGroup } : {}),
      ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
      updatedAt: Date.now(),
    };

    if (normalizedTags !== undefined && normalizedTags.length > 0) {
      this.ensureTagColors(normalizedTags);
    }

    this.saveNotes();

    if (updates.imageUrl !== undefined && previousNote.imageUrl !== updates.imageUrl) {
      this.deleteImageIfUnused(previousNote.imageUrl);
    }

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

    const [deletedNote] = this.notes.splice(index, 1);
    this.saveNotes();

    this.deleteImageIfUnused(deletedNote?.imageUrl);

    return true;
  }
}

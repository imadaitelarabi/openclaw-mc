/**
 * Native Chat Input Mentions
 *
 * Provides #mention options for built-in Mission Control data sources.
 * Initial provider: Notes
 */

import { useCallback, useMemo, useState } from 'react';
import type { Note } from '@/types';
import type { ChatInputTagOption } from '@/types/extension';

export const NATIVE_PROVIDER_OPTION_ID_PREFIX = 'native-provider-';

interface UseNativeChatInputProps {
  notes: Note[];
  groups?: string[];
}

function uniqueOrderedGroups(notes: Note[], groups?: string[]): string[] {
  const ordered = new Map<string, string>();

  (groups || []).forEach((group) => {
    const trimmed = group?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!ordered.has(key)) ordered.set(key, trimmed);
  });

  notes.forEach((note) => {
    const trimmed = note.group?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!ordered.has(key)) ordered.set(key, trimmed);
  });

  return Array.from(ordered.values());
}

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildNoteLabel(note: Note): string {
  const firstLine = note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return `Note ${note.id.slice(0, 8)}`;
  }

  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function buildNoteDescription(note: Note): string {
  const parts: string[] = [];
  if (Array.isArray(note.tags) && note.tags.length > 0) {
    parts.push(note.tags.slice(0, 3).map((tag) => `#${tag}`).join(' '));
  }
  if (note.imageUrl) {
    parts.push('Includes image');
  }
  return parts.join(' • ');
}

function buildNoteOptions(notes: Note[]): ChatInputTagOption[] {
  return [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((note) => ({
      id: `native-note-${note.id}`,
      label: buildNoteLabel(note),
      tag: `#note ${note.id.slice(0, 8)}`,
      value: note.content,
      description: buildNoteDescription(note) || undefined,
      meta: {
        kind: 'native-note',
        noteId: note.id,
        imageUrl: note.imageUrl,
      },
    }));
}

function buildNotesProvider(
  notes: Note[],
  groups: string[],
  filterText: string
): ChatInputTagOption {
  const normalizedFilter = normalizeQuery(filterText);

  const groupOptions: ChatInputTagOption[] = groups
    .map((group) => {
      const groupNotes = notes
        .filter((note) => note.group.toLowerCase() === group.toLowerCase())
        .filter((note) => {
          if (!normalizedFilter) return true;

          const haystack = [
            note.content,
            note.group,
            note.id,
            ...(note.tags || []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return (
            group.toLowerCase().includes(normalizedFilter)
            || haystack.includes(normalizedFilter)
          );
        });

      if (groupNotes.length === 0) {
        return null;
      }

      const groupSlug = toSlug(group);
      const noteOptions = buildNoteOptions(groupNotes);
      const tagBuckets = new Map<string, { label: string; notes: Note[] }>();
      const untaggedNotes: Note[] = [];

      groupNotes.forEach((note) => {
        const tags = Array.isArray(note.tags)
          ? note.tags.map((tag) => tag.trim()).filter(Boolean)
          : [];

        if (tags.length === 0) {
          untaggedNotes.push(note);
          return;
        }

        tags.forEach((tag) => {
          const key = tag.toLowerCase();
          const entry = tagBuckets.get(key);
          if (entry) {
            entry.notes.push(note);
          } else {
            tagBuckets.set(key, { label: tag, notes: [note] });
          }
        });
      });

      const tagEntries = Array.from(tagBuckets.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      );

      const tagOptions: ChatInputTagOption[] = tagEntries.map((entry) => ({
        id: `native-notes-tag-${groupSlug}-${toSlug(entry.label)}`,
        label: `#${entry.label}`,
        tag: `#notes ${group} #${entry.label}`,
        value: entry.label,
        description: `${entry.notes.length} note${entry.notes.length === 1 ? '' : 's'}`,
        children: buildNoteOptions(entry.notes),
      }));

      const hasTags = tagEntries.length > 0;
      if (hasTags && untaggedNotes.length > 0) {
        tagOptions.push({
          id: `native-notes-tag-${groupSlug}-untagged`,
          label: 'Untagged',
          tag: `#notes ${group} untagged`,
          value: 'untagged',
          description: `${untaggedNotes.length} note${untaggedNotes.length === 1 ? '' : 's'}`,
          children: buildNoteOptions(untaggedNotes),
        });
      }

      const children = hasTags
        ? [
            {
              id: `native-notes-group-${groupSlug}-all`,
              label: 'All notes',
              tag: `#notes ${group}`,
              value: group,
              description: `${groupNotes.length} note${groupNotes.length === 1 ? '' : 's'}`,
              children: noteOptions,
            },
            ...tagOptions,
          ]
        : noteOptions;

      return {
        id: `native-notes-group-${groupSlug}`,
        label: group,
        tag: `#notes ${group}`,
        value: group,
        description: `${groupNotes.length} note${groupNotes.length === 1 ? '' : 's'}`,
        children,
      };
    })
    .filter((entry): entry is ChatInputTagOption => Boolean(entry));

  return {
    id: `${NATIVE_PROVIDER_OPTION_ID_PREFIX}notes`,
    label: 'Notes',
    tag: '#notes',
    value: 'notes',
    description: `${notes.length} note${notes.length === 1 ? '' : 's'}`,
    children: groupOptions,
  };
}

export function useNativeChatInput({ notes, groups }: UseNativeChatInputProps) {
  const [isLoading, setIsLoading] = useState(false);

  const effectiveGroups = useMemo(
    () => uniqueOrderedGroups(notes, groups),
    [notes, groups]
  );

  const searchTags = useCallback(async (query: string): Promise<ChatInputTagOption[]> => {
    if (!query || !query.startsWith('#')) {
      return [];
    }

    setIsLoading(true);
    try {
      const searchTerm = query.slice(1).trim();

      // "#" => show native providers
      if (!searchTerm) {
        return [buildNotesProvider(notes, effectiveGroups, '')];
      }

      const normalized = normalizeQuery(searchTerm);

      // Match Notes provider and optional filter after "notes"
      if ('notes'.startsWith(normalized)) {
        return [buildNotesProvider(notes, effectiveGroups, '')];
      }

      if (normalized.startsWith('notes')) {
        const noteFilter = searchTerm.slice('notes'.length).trim();
        return [buildNotesProvider(notes, effectiveGroups, noteFilter)];
      }

      return [];
    } finally {
      setIsLoading(false);
    }
  }, [effectiveGroups, notes]);

  return {
    searchTags,
    isLoading,
  };
}

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
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);

      if (groupNotes.length === 0) {
        return null;
      }

      return {
        id: `native-notes-group-${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: group,
        tag: `#notes ${group}`,
        value: group,
        description: `${groupNotes.length} note${groupNotes.length === 1 ? '' : 's'}`,
        children: groupNotes.map((note) => ({
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
        })),
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

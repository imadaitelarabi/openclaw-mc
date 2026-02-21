/**
 * Native Chat Input Mentions
 *
 * Provides #mention options for built-in OpenClaw MC data sources.
 * Initial provider: Notes
 */

import { useCallback, useMemo, useState } from "react";
import type { Note, SkillStatusEntry } from "@/types";
import type { ChatInputTagOption } from "@/types/extension";

export const NATIVE_PROVIDER_OPTION_ID_PREFIX = "native-provider-";

interface UseNativeChatInputProps {
  notes: Note[];
  groups?: string[];
  skills?: SkillStatusEntry[];
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    parts.push(
      note.tags
        .slice(0, 3)
        .map((tag) => `#${tag}`)
        .join(" ")
    );
  }
  if (note.imageUrl) {
    parts.push("Includes image");
  }
  return parts.join(" • ");
}

function hashId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
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
        kind: "native-note",
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

          const haystack = [note.content, note.group, note.id, ...(note.tags || [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return (
            group.toLowerCase().includes(normalizedFilter) || haystack.includes(normalizedFilter)
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
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
      );

      const tagOptions: ChatInputTagOption[] = tagEntries.map((entry) => ({
        id: `native-notes-tag-${groupSlug}-${toSlug(entry.label)}-${hashId(entry.label)}`,
        label: `#${entry.label}`,
        tag: `#notes ${group} #${entry.label}`,
        value: entry.label,
        description: `${entry.notes.length} note${entry.notes.length === 1 ? "" : "s"}`,
        children: buildNoteOptions(entry.notes),
      }));

      const hasTags = tagEntries.length > 0;
      if (hasTags && untaggedNotes.length > 0) {
        tagOptions.push({
          id: `native-notes-tag-${groupSlug}-untagged`,
          label: "Untagged",
          tag: `#notes ${group} untagged`,
          value: "untagged",
          description: `${untaggedNotes.length} note${untaggedNotes.length === 1 ? "" : "s"}`,
          children: buildNoteOptions(untaggedNotes),
        });
      }

      const children = hasTags
        ? [
            {
              id: `native-notes-group-${groupSlug}-all`,
              label: "All notes",
              tag: `#notes ${group}`,
              value: group,
              description: `${groupNotes.length} note${groupNotes.length === 1 ? "" : "s"}`,
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
        description: `${groupNotes.length} note${groupNotes.length === 1 ? "" : "s"}`,
        children,
      };
    })
    .filter((entry): entry is ChatInputTagOption => Boolean(entry));

  return {
    id: `${NATIVE_PROVIDER_OPTION_ID_PREFIX}notes`,
    label: "Notes",
    tag: "#notes",
    value: "notes",
    description: `${notes.length} note${notes.length === 1 ? "" : "s"}`,
    children: groupOptions,
  };
}

function isReadySkill(skill: SkillStatusEntry): boolean {
  return Boolean(skill.eligible) && !skill.disabled;
}

function buildSkillOptions(skills: SkillStatusEntry[], filterText: string): ChatInputTagOption[] {
  const normalizedFilter = normalizeQuery(filterText);

  return skills
    .filter((skill) => {
      if (!normalizedFilter) {
        return true;
      }

      const haystack = [skill.name, skill.description, skill.source, skill.skillKey]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedFilter);
    })
    .map((skill) => ({
      id: `native-skill-${skill.skillKey}`,
      label: skill.emoji ? `${skill.emoji} ${skill.name}` : skill.name,
      tag: `#skill ${skill.name}`,
      value: `use the following skill to process user request: ${skill.name}`,
      description: skill.description || undefined,
      meta: {
        kind: "native-skill",
        skillKey: skill.skillKey,
        skillName: skill.name,
      },
    }));
}

function buildSkillsProvider(skills: SkillStatusEntry[], filterText: string): ChatInputTagOption {
  const filteredOptions = buildSkillOptions(skills, filterText);

  return {
    id: `${NATIVE_PROVIDER_OPTION_ID_PREFIX}skills`,
    label: "Skills",
    tag: "#skills",
    value: "skills",
    description: `${filteredOptions.length} ready skill${filteredOptions.length === 1 ? "" : "s"}`,
    children: filteredOptions,
  };
}

export function useNativeChatInput({ notes, groups, skills = [] }: UseNativeChatInputProps) {
  const [isLoading, setIsLoading] = useState(false);

  const effectiveGroups = useMemo(() => uniqueOrderedGroups(notes, groups), [notes, groups]);

  const readySkills = useMemo(
    () =>
      [...skills]
        .filter(isReadySkill)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [skills]
  );

  const searchTags = useCallback(
    async (query: string): Promise<ChatInputTagOption[]> => {
      if (!query || !query.startsWith("#")) {
        return [];
      }

      setIsLoading(true);
      try {
        const searchTerm = query.slice(1).trim();

        // "#" => show native providers
        if (!searchTerm) {
          return [
            buildNotesProvider(notes, effectiveGroups, ""),
            buildSkillsProvider(readySkills, ""),
          ];
        }

        const normalized = normalizeQuery(searchTerm);

        // Match Notes provider and optional filter after "notes"
        if ("notes".startsWith(normalized)) {
          return [buildNotesProvider(notes, effectiveGroups, "")];
        }

        if (normalized.startsWith("notes")) {
          const noteFilter = searchTerm.slice("notes".length).trim();
          return [buildNotesProvider(notes, effectiveGroups, noteFilter)];
        }

        if ("skills".startsWith(normalized) || "skill".startsWith(normalized)) {
          return [buildSkillsProvider(readySkills, "")];
        }

        if (normalized.startsWith("skills") || normalized.startsWith("skill")) {
          const token = normalized.startsWith("skills") ? "skills" : "skill";
          const skillFilter = searchTerm.slice(token.length).trim();
          return [buildSkillsProvider(readySkills, skillFilter)];
        }

        // Generic query – run parallel search across all native providers
        const noteMatches = notes.filter((note) => {
          const haystack = [note.content, note.group, note.id, ...(note.tags || [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalized);
        });

        const noteResults = buildNoteOptions(noteMatches).map((opt) => ({
          ...opt,
          source: { name: "Notes" },
        }));

        const skillResults = buildSkillOptions(readySkills, searchTerm).map((opt) => ({
          ...opt,
          source: { name: "Skills" },
        }));

        return [...noteResults, ...skillResults];
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveGroups, notes, readySkills]
  );

  return {
    searchTags,
    isLoading,
  };
}

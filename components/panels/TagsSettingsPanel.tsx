"use client";

import { useState } from "react";
import { Tag, Palette, Plus, Filter } from "lucide-react";
import { getTagColor, asRgba } from "@/lib/tag-colors";
import { ConfirmationModal } from "@/components/modals";

interface TagsSettingsPanelProps {
  allTags: string[];
  tagColors: Record<string, string>;
  onSetTagColor: (tag: string, color: string) => Promise<void>;
  onDeleteTag: (tag: string) => Promise<void>;
  onCreateTag: (tag: string) => Promise<void>;
  noteTagFilters?: string[];
  onNoteTagFiltersChange?: (filters: string[]) => void;
}

export function TagsSettingsPanel({
  allTags,
  tagColors,
  onSetTagColor,
  onDeleteTag,
  onCreateTag,
  noteTagFilters = [],
  onNoteTagFiltersChange,
}: TagsSettingsPanelProps) {
  const [updatingTagColor, setUpdatingTagColor] = useState<string | null>(null);
  const [tagPendingDelete, setTagPendingDelete] = useState<string | null>(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [createTagError, setCreateTagError] = useState<string | null>(null);

  const randomHexColor = () =>
    `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")}`;

  const handleSetTagColor = async (tag: string, color: string) => {
    setUpdatingTagColor(tag);
    try {
      await onSetTagColor(tag, color);
    } finally {
      setUpdatingTagColor(null);
    }
  };

  const handleConfirmDeleteTag = async () => {
    if (!tagPendingDelete) {
      return;
    }

    setIsDeletingTag(true);
    try {
      await onDeleteTag(tagPendingDelete);
      setTagPendingDelete(null);
    } finally {
      setIsDeletingTag(false);
    }
  };

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    setIsCreatingTag(true);
    setCreateTagError(null);
    try {
      await onCreateTag(trimmed);
      setNewTagName("");
    } catch (err) {
      setCreateTagError((err as Error).message || "Failed to create tag");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleNewTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      void handleCreateTag();
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background p-4">
      <div className="mb-4">
        <h2 className="text-sm font-medium">Tags Settings</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manage global tag colors and delete tags across all notes.
        </p>
      </div>

      {/* Tag Filters Section */}
      {onNoteTagFiltersChange && allTags.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-secondary/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Note tag filters</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            When active, only notes with selected tags appear in the status bar count and chat
            input mentions.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const isActive = noteTagFilters.includes(tag);
              const tagColor = getTagColor(tag, tagColors);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = isActive
                      ? noteTagFilters.filter((t) => t !== tag)
                      : [...noteTagFilters, tag];
                    onNoteTagFiltersChange(next);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: isActive ? tagColor : asRgba(tagColor, 0.15),
                    color: isActive ? "#ffffff" : tagColor,
                    outline: isActive ? `2px solid ${tagColor}` : "none",
                    outlineOffset: "1px",
                  }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </button>
              );
            })}
          </div>
          {noteTagFilters.length > 0 && (
            <button
              type="button"
              onClick={() => onNoteTagFiltersChange([])}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(event) => {
              setNewTagName(event.target.value);
              setCreateTagError(null);
            }}
            onKeyDown={handleNewTagKeyDown}
            placeholder="New tag name…"
            className="flex-1 rounded border border-border bg-secondary/40 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={isCreatingTag}
          />
          <button
            type="button"
            onClick={() => void handleCreateTag()}
            disabled={isCreatingTag || !newTagName.trim()}
            className="inline-flex items-center gap-1 rounded border border-border bg-secondary/40 px-2 py-1 text-xs hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            Create
          </button>
        </div>
        {createTagError && <p className="mt-1 text-xs text-destructive">{createTagError}</p>}
      </div>

      {allTags.length === 0 ? (
        <div className="text-sm text-muted-foreground">No tags available yet.</div>
      ) : (
        <div className="space-y-2">
          {allTags.map((tag) => (
            <div
              key={tag}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2"
            >
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: asRgba(getTagColor(tag, tagColors), 0.15),
                  color: getTagColor(tag, tagColors),
                }}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>

              <div className="ml-auto flex items-center gap-2">
                <input
                  type="color"
                  value={getTagColor(tag, tagColors)}
                  onChange={(event) => void handleSetTagColor(tag, event.target.value)}
                  className="h-7 w-9 rounded border border-border bg-transparent"
                  aria-label={`Color for tag ${tag}`}
                  disabled={updatingTagColor === tag}
                />

                <button
                  type="button"
                  onClick={() => void handleSetTagColor(tag, randomHexColor())}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  disabled={updatingTagColor === tag}
                >
                  <Palette className="w-3 h-3" />
                  Random
                </button>

                <button
                  type="button"
                  onClick={() => setTagPendingDelete(tag)}
                  className="text-xs text-destructive hover:opacity-80 transition-opacity"
                  disabled={updatingTagColor === tag}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={tagPendingDelete !== null}
        onClose={() => {
          if (!isDeletingTag) {
            setTagPendingDelete(null);
          }
        }}
        onConfirm={handleConfirmDeleteTag}
        title="Delete Tag"
        message={
          tagPendingDelete
            ? `Delete tag "${tagPendingDelete}" from all notes? This cannot be undone.`
            : "Delete this tag from all notes?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeletingTag}
      />
    </div>
  );
}

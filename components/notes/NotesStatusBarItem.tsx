/**
 * Notes Status Bar Item
 * Shows notes count with dropdown menu for group selection
 */

import { StickyNote, ChevronDown, Plus } from 'lucide-react';
import type { Note, NoteGroup } from '@/types';

interface NotesStatusBarItemProps {
  notes: Note[];
  groups?: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectGroup: (group: string | null) => void;
  onOpenNotes: () => void;
}

export function NotesStatusBarItem({
  notes,
  groups = [],
  isOpen,
  onToggle,
  onSelectGroup,
  onOpenNotes,
}: NotesStatusBarItemProps) {
  const noteGroupCounts = notes.reduce((acc, note) => {
    const current = acc.get(note.group) ?? 0;
    acc.set(note.group, current + 1);
    return acc;
  }, new Map<string, number>());

  const uniqueGroupNames = new Set<string>([
    ...groups,
    ...Array.from(noteGroupCounts.keys()),
  ]);

  const groupedNotes: NoteGroup[] = Array.from(uniqueGroupNames).map((name) => ({
    name,
    count: noteGroupCounts.get(name) ?? 0,
  }));

  // Sort groups by count (descending) then by name
  const sortedGroups = groupedNotes.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded cursor-pointer transition-colors"
      >
        <StickyNote className="w-3 h-3 text-muted-foreground" />
        <span className="font-medium">
          Notes ({notes.length})
        </span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
          <div className="p-2 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
            <span className="text-muted-foreground font-medium">Groups</span>
            <button
              onClick={() => {
                onOpenNotes();
                onToggle();
              }}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="Open Notes"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {/* All Notes Option */}
            <button
              onClick={() => {
                onSelectGroup(null);
                onToggle();
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">All Notes</span>
                <span className="text-xs text-muted-foreground">{notes.length}</span>
              </div>
            </button>

            {/* Group Options */}
            {sortedGroups.length === 0 ? (
              <div className="px-3 py-2 text-muted-foreground text-center text-sm">
                No notes yet
              </div>
            ) : (
              sortedGroups.map(group => (
                <button
                  key={group.name}
                  onClick={() => {
                    onSelectGroup(group.name);
                    onToggle();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{group.name}</span>
                    <span className="text-xs text-muted-foreground">{group.count}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

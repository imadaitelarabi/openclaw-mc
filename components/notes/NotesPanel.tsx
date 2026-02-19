/**
 * Notes Panel
 * Main panel for displaying and managing notes
 */

"use client";

import { useState, useMemo } from 'react';
import { Copy, Trash2, Image as ImageIcon, X } from 'lucide-react';
import type { Note } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/useToast';

interface NotesPanelProps {
  notes: Note[];
  selectedGroup?: string | null;
  onAddNote: (content: string, group: string, imageUrl?: string) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

export function NotesPanel({
  notes,
  selectedGroup,
  onAddNote,
  onDeleteNote,
}: NotesPanelProps) {
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectedNoteGroup, setSelectedNoteGroup] = useState(selectedGroup || 'General');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const { toast } = useToast();

  // Extract unique groups from notes
  const groups = useMemo(() => {
    const groupSet = new Set<string>(notes.map(n => n.group));
    return Array.from(groupSet).sort();
  }, [notes]);

  // Add default groups if none exist
  const allGroups = useMemo(() => {
    const defaultGroups = ['General', 'Commands', 'Ideas', 'Snippets'];
    const uniqueGroups = new Set([...defaultGroups, ...groups]);
    return Array.from(uniqueGroups).sort();
  }, [groups]);

  // Filter notes by selected group
  const filteredNotes = useMemo(() => {
    if (!selectedGroup) {
      return notes;
    }
    return notes.filter(n => n.group === selectedGroup);
  }, [notes, selectedGroup]);

  // Sort notes by most recent first
  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => b.createdAt - a.createdAt);
  }, [filteredNotes]);

  const handleCopyNote = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Copied to clipboard',
        description: content.length > 50 ? content.substring(0, 50) + '...' : content,
      });
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddNote(newNoteContent, selectedNoteGroup, imageUrl || undefined);
      setNewNoteContent('');
      setImageUrl('');
      setShowImageInput(false);
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium">
          {selectedGroup ? `${selectedGroup} Notes` : 'All Notes'}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
        </p>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <p>No notes yet</p>
            <p className="text-xs mt-1">Add your first note below</p>
          </div>
        ) : (
          sortedNotes.map(note => (
            <div
              key={note.id}
              className="bg-secondary rounded-lg p-3 border border-border hover:border-primary/50 transition-colors group"
            >
              {/* Note Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {note.group}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyNote(note.content)}
                    className="p-1 rounded hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Note Content */}
              <p className="text-sm whitespace-pre-wrap break-words mb-2">
                {note.content}
              </p>

              {/* Image Attachment */}
              {note.imageUrl && (
                <div className="mt-2 rounded overflow-hidden border border-border">
                  <img
                    src={note.imageUrl}
                    alt="Note attachment"
                    className="max-w-full h-auto"
                  />
                </div>
              )}

              {/* Note Footer */}
              <div className="text-xs text-muted-foreground mt-2">
                {formatDistanceToNow(note.createdAt, { addSuffix: true })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Group Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="note-group" className="text-xs text-muted-foreground whitespace-nowrap">
              Group:
            </label>
            <select
              id="note-group"
              value={selectedNoteGroup}
              onChange={(e) => setSelectedNoteGroup(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            >
              {allGroups.map(group => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          {/* Image URL Input (Optional) */}
          {showImageInput && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="flex-1 px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => {
                  setShowImageInput(false);
                  setImageUrl('');
                }}
                className="p-2 rounded hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Note Input */}
          <div className="flex items-end gap-2">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write a note..."
              className="flex-1 px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none min-h-[60px]"
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowImageInput(!showImageInput)}
                className="p-2 rounded border border-border hover:bg-secondary transition-colors"
                title="Add image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={!newNoteContent.trim() || isSubmitting}
                className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 rounded bg-secondary text-xs">Cmd/Ctrl + Enter</kbd> to add note
          </p>
        </form>
      </div>
    </div>
  );
}

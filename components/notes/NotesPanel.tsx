/**
 * Notes Panel
 * Main panel for displaying and managing notes
 */

"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { Copy, Trash2, Image as ImageIcon, Plus, Send, X, ChevronDown, Download, Tag, Check } from 'lucide-react';
import type { Note } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { ConfirmationModal } from '@/components/modals';
import { DEFAULT_ATTACHMENT_CONFIG } from '@/types/attachment';
import { getFilesFromClipboard, validateFile } from '@/lib/file-utils';
import { asRgba, getTagColor } from '@/lib/tag-colors';
import { TagInput } from './TagInput';

interface NotesPanelProps {
  notes: Note[];
  groups: string[];
  allTags: string[];
  tagColors: Record<string, string>;
  selectedGroup?: string | null;
  onAddNote: (content: string, group: string, tags?: string[], imageUrl?: string) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<void>;
  onCreateGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => Promise<void>;
  onUploadNoteImage: (file: File) => Promise<string>;
  onDeleteNote: (id: string) => Promise<void>;
}

export function NotesPanel({
  notes,
  groups,
  allTags,
  tagColors,
  selectedGroup,
  onAddNote,
  onUpdateNote,
  onCreateGroup,
  onDeleteGroup,
  onUploadNoteImage,
  onDeleteNote,
}: NotesPanelProps) {
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(selectedGroup ?? null);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [editingNoteTagId, setEditingNoteTagId] = useState<string | null>(null);
  const [tagDraftsByNoteId, setTagDraftsByNoteId] = useState<Record<string, string[]>>({});
  const [savingTagNoteId, setSavingTagNoteId] = useState<string | null>(null);
  const [selectedNoteGroup, setSelectedNoteGroup] = useState(selectedGroup || 'General');
  const [showCreateGroupInput, setShowCreateGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachedImageName, setAttachedImageName] = useState('');
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isHeaderGroupMenuOpen, setIsHeaderGroupMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notePendingDelete, setNotePendingDelete] = useState<Note | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [groupPendingDelete, setGroupPendingDelete] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  const headerGroupMenuRef = useRef<HTMLDivElement | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedGroup) {
      setSelectedNoteGroup(selectedGroup);
      setActiveGroup(selectedGroup);
    }
  }, [selectedGroup]);

  const allGroups = useMemo(() => {
    const noteGroups = notes.map(note => note.group);
    const uniqueGroups = new Set(['General', ...groups, ...noteGroups]);
    return Array.from(uniqueGroups).sort();
  }, [groups, notes]);

  const noteCountsByGroup = useMemo(() => {
    return notes.reduce((acc, note) => {
      acc.set(note.group, (acc.get(note.group) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }, [notes]);

  const isImageClipboardSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined');
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(event.target as Node)) {
        setIsGroupMenuOpen(false);
      }
      if (headerGroupMenuRef.current && !headerGroupMenuRef.current.contains(event.target as Node)) {
        setIsHeaderGroupMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Filter notes by active group and active tag filters
  const filteredNotes = useMemo(() => {
    let result = notes;
    if (activeGroup) {
      result = result.filter(n => n.group === activeGroup);
    }
    if (activeTagFilters.length > 0) {
      result = result.filter(n =>
        activeTagFilters.every(tag => Array.isArray(n.tags) && n.tags.includes(tag))
      );
    }
    return result;
  }, [notes, activeGroup, activeTagFilters]);

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

  const handleCopyNoteImage = async (imageUrl: string) => {
    try {
      if (!isImageClipboardSupported || typeof window === 'undefined') {
        throw new Error('Image clipboard API not supported');
      }

      const absoluteUrl = imageUrl.startsWith('http')
        ? imageUrl
        : `${window.location.origin}${imageUrl}`;
      const response = await fetch(absoluteUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || 'image/png']: blob,
        }),
      ]);

      toast({
        title: 'Image copied to clipboard',
        description: 'You can now paste the note image.',
      });
    } catch (err) {
      toast({
        title: 'Failed to copy image',
        description: 'Could not copy note image to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadNoteImage = (imageUrl: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const absoluteUrl = imageUrl.startsWith('http')
      ? imageUrl
      : `${window.location.origin}${imageUrl}`;

    const link = document.createElement('a');
    link.href = absoluteUrl;
    link.download = '';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setIsSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (attachedImage) {
        imageUrl = await onUploadNoteImage(attachedImage);
      }

      await onAddNote(newNoteContent, selectedNoteGroup, newNoteTags, imageUrl);
      setNewNoteContent('');
      if (noteTextareaRef.current) {
        noteTextareaRef.current.style.height = 'auto';
      }
      setNewNoteTags([]);
      setAttachedImage(null);
      setAttachedImageName('');
      // Switch group view only when filtered to a different group, so the new note is visible
      if (activeGroup !== null && activeGroup !== selectedNoteGroup) {
        setActiveGroup(selectedNoteGroup);
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    const normalizedGroup = newGroupName.trim();
    if (!normalizedGroup) {
      return;
    }

    try {
      await onCreateGroup(normalizedGroup);
      setSelectedNoteGroup(normalizedGroup);
      setNewGroupName('');
      setShowCreateGroupInput(false);
      toast({
        title: 'Group created',
        description: `${normalizedGroup} is ready to use.`,
      });
    } catch (err) {
      toast({
        title: 'Failed to create group',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleImageFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validation = validateFile(file, DEFAULT_ATTACHMENT_CONFIG);
    if (!validation.valid) {
      toast({
        title: 'Invalid image',
        description: validation.error,
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    setAttachedImage(file);
    setAttachedImageName(file.name);
    event.target.value = '';
  };

  const handlePasteImage = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = getFilesFromClipboard(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    const firstImage = files.find(file => file.type.startsWith('image/'));
    if (!firstImage) {
      return;
    }

    event.preventDefault();

    const validation = validateFile(firstImage, DEFAULT_ATTACHMENT_CONFIG);
    if (!validation.valid) {
      toast({
        title: 'Invalid image',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setAttachedImage(firstImage);
    setAttachedImageName(firstImage.name || 'Pasted image');
    toast({
      title: 'Image attached',
      description: firstImage.name || 'Pasted image',
    });
  };

  const isGroupDeletable = (group: string) => {
    return group.toLowerCase() !== 'general';
  };

  const handleStartEditNoteTags = (note: Note) => {
    setEditingNoteTagId(note.id);
    setTagDraftsByNoteId(prev => ({
      ...prev,
      [note.id]: Array.isArray(note.tags) ? note.tags : [],
    }));
  };

  const handleSaveNoteTags = async (noteId: string) => {
    const tags = tagDraftsByNoteId[noteId] || [];
    setSavingTagNoteId(noteId);
    try {
      await onUpdateNote(noteId, { tags });
      setEditingNoteTagId(null);
    } finally {
      setSavingTagNoteId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!notePendingDelete) {
      return;
    }

    setIsDeletingNote(true);
    try {
      await onDeleteNote(notePendingDelete.id);
      setNotePendingDelete(null);
    } finally {
      setIsDeletingNote(false);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupPendingDelete) {
      return;
    }

    setIsDeletingGroup(true);
    try {
      await onDeleteGroup(groupPendingDelete);
      if (selectedNoteGroup.toLowerCase() === groupPendingDelete.toLowerCase()) {
        setSelectedNoteGroup('General');
      }
      setGroupPendingDelete(null);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative" ref={headerGroupMenuRef}>
          <button
            type="button"
            onClick={() => setIsHeaderGroupMenuOpen(prev => !prev)}
            className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
          >
            {activeGroup ? `${activeGroup} Notes` : 'All Notes'}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {isHeaderGroupMenuOpen && (
            <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50 min-w-[150px]">
              <div className="max-h-56 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveGroup(null);
                    setIsHeaderGroupMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium">All Notes</span>
                  <span className="text-xs text-muted-foreground">{notes.length}</span>
                </button>
                {allGroups.map(group => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => {
                      setActiveGroup(group);
                      setIsHeaderGroupMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="font-medium">{group}</span>
                    <span className="text-xs text-muted-foreground">{noteCountsByGroup.get(group) ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
        </p>
        {allTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {allTags.map(tag => {
              const isActive = activeTagFilters.includes(tag);
              const tagColor = getTagColor(tag, tagColors);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setActiveTagFilters(prev =>
                      isActive ? prev.filter(t => t !== tag) : [...prev, tag]
                    )
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: isActive ? tagColor : asRgba(tagColor, 0.15),
                    color: isActive ? '#ffffff' : tagColor,
                  }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </button>
              );
            })}
            {activeTagFilters.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTagFilters([])}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-2.5 h-2.5" />
                Clear
              </button>
            )}
          </div>
        )}
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
                  {note.imageUrl && isImageClipboardSupported && (
                    <button
                      onClick={() => handleCopyNoteImage(note.imageUrl!)}
                      className="p-1 rounded hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy image to clipboard"
                    >
                      <ImageIcon className="w-3 h-3" />
                    </button>
                  )}
                  {note.imageUrl && !isImageClipboardSupported && (
                    <button
                      onClick={() => handleDownloadNoteImage(note.imageUrl!)}
                      className="p-1 rounded hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                      title="Download image"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => setNotePendingDelete(note)}
                    className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Note Content */}
              <p className="text-sm whitespace-pre-wrap break-words mb-2 line-clamp-4">
                {note.content}
              </p>

              {/* Tags */}
              {Array.isArray(note.tags) && note.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-2">
                  {note.tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setActiveTagFilters(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: asRgba(getTagColor(tag, tagColors), 0.15),
                        color: getTagColor(tag, tagColors),
                      }}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {editingNoteTagId === note.id && (
                <div className="space-y-2 mb-2">
                  <TagInput
                    selectedTags={tagDraftsByNoteId[note.id] || []}
                    allTags={allTags}
                    tagColors={tagColors}
                    onChange={(tags) => setTagDraftsByNoteId(prev => ({ ...prev, [note.id]: tags }))}
                    disabled={savingTagNoteId === note.id}
                    autoOpenOnMount
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveNoteTags(note.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      disabled={savingTagNoteId === note.id}
                    >
                      <Check className="w-3 h-3" />
                      Save tags
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingNoteTagId(null)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                      disabled={savingTagNoteId === note.id}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                </div>
                <button
                  type="button"
                  onClick={() => handleStartEditNoteTags(note)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Tag className="w-3 h-3" />
                  {Array.isArray(note.tags) && note.tags.length > 0 ? 'Edit tags' : 'Add tags'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 border-t border-border bg-background/50 backdrop-blur">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Group:
            </label>
            <div className="relative flex-1" ref={groupMenuRef}>
              <button
                type="button"
                onClick={() => setIsGroupMenuOpen(prev => !prev)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center justify-between"
                disabled={isSubmitting}
              >
                <span>{selectedNoteGroup}</span>
                <ChevronDown className="w-4 h-4 opacity-60" />
              </button>

              {isGroupMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                  <div className="max-h-56 overflow-y-auto py-1">
                    {allGroups.map(group => (
                      <div
                        key={group}
                        className="w-full px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNoteGroup(group);
                            setIsGroupMenuOpen(false);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{group}</span>
                            <span className="text-xs text-muted-foreground">{noteCountsByGroup.get(group) ?? 0}</span>
                          </div>
                        </button>

                        {isGroupDeletable(group) && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setGroupPendingDelete(group);
                            }}
                            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title={`Delete ${group}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCreateGroupInput(prev => !prev)}
              className="bg-secondary/50 border border-border p-2 rounded-lg hover:bg-secondary transition-colors"
              title="Create group"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showCreateGroupInput && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name"
                className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                disabled={isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleCreateGroup();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleCreateGroup()}
                className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateGroupInput(false);
                  setNewGroupName('');
                }}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <TagInput
            selectedTags={newNoteTags}
            allTags={allTags}
            tagColors={tagColors}
            onChange={setNewNoteTags}
            disabled={isSubmitting}
          />

          {attachedImageName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 border border-border rounded-lg px-3 py-2">
              <span className="truncate">{attachedImageName}</span>
              <button
                type="button"
                onClick={() => {
                  setAttachedImage(null);
                  setAttachedImageName('');
                }}
                className="p-1 rounded hover:bg-secondary transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="relative flex gap-2 md:gap-3 items-end">
            <input
              id="notes-image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFileSelect}
              disabled={isSubmitting}
            />

            <button
              type="button"
              onClick={() => document.getElementById('notes-image-upload')?.click()}
              className="bg-secondary/50 border border-border p-2.5 rounded-lg hover:bg-secondary transition-colors shrink-0"
              title="Attach image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <textarea
              ref={noteTextareaRef}
              value={newNoteContent}
              onChange={(e) => {
                setNewNoteContent(e.target.value);
                requestAnimationFrame(() => {
                  if (noteTextareaRef.current) {
                    noteTextareaRef.current.style.height = 'auto';
                    noteTextareaRef.current.style.height = Math.min(noteTextareaRef.current.scrollHeight, 200) + 'px';
                  }
                });
              }}
              onPaste={handlePasteImage}
              placeholder="Write a note..."
              className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 font-sans resize-none overflow-y-auto max-h-[200px] min-h-[46px] text-sm"
              rows={1}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newNoteContent.trim() && !isSubmitting) {
                    void handleSubmit(e);
                  }
                }
              }}
            />

            <button
              type="submit"
              disabled={!newNoteContent.trim() || isSubmitting}
              className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Add note"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Press Enter to add note, Shift + Enter for newline
          </p>
        </form>
      </div>

      <ConfirmationModal
        isOpen={notePendingDelete !== null}
        onClose={() => {
          if (!isDeletingNote) {
            setNotePendingDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Note"
        message={
          notePendingDelete
            ? `Are you sure you want to delete this note from "${notePendingDelete.group}"? This action cannot be undone.`
            : 'Are you sure you want to delete this note?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeletingNote}
      />

      <ConfirmationModal
        isOpen={groupPendingDelete !== null}
        onClose={() => {
          if (!isDeletingGroup) {
            setGroupPendingDelete(null);
          }
        }}
        onConfirm={handleConfirmDeleteGroup}
        title="Delete Group"
        message={
          groupPendingDelete
            ? `Are you sure you want to delete "${groupPendingDelete}"? Notes in this group will be moved to General.`
            : 'Are you sure you want to delete this group?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeletingGroup}
      />

    </div>
  );
}

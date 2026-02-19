/**
 * Notes Hook
 * WebSocket integration for notes CRUD operations
 */

import { useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Note } from '@/types';

interface UseNotesProps {
  wsRef: React.RefObject<WebSocket | null>;
}

interface UseNotesReturn {
  notes: Note[];
  groups: string[];
  loading: boolean;
  error: string | null;
  addNote: (content: string, group: string, imageUrl?: string) => Promise<Note>;
  addGroup: (group: string) => Promise<string[]>;
  uploadNoteImage: (file: File) => Promise<string>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<Note>;
  deleteNote: (id: string) => Promise<boolean>;
  refreshNotes: () => Promise<void>;
}

export function useNotes({ wsRef }: UseNotesProps): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<string[]>(['General', 'Commands', 'Ideas', 'Snippets']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestNotesBootstrap = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const notesRequestId = uuidv4();
    ws.send(JSON.stringify({ type: 'notes.list', requestId: notesRequestId }));

    const groupsRequestId = uuidv4();
    ws.send(JSON.stringify({ type: 'notes.groups.list', requestId: groupsRequestId }));
  }, [wsRef]);

  // Load notes and groups on mount / socket open
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    if (ws.readyState === WebSocket.OPEN) {
      requestNotesBootstrap();
      return;
    }

    const handleOpen = () => {
      requestNotesBootstrap();
    };

    ws.addEventListener('open', handleOpen);
    return () => ws.removeEventListener('open', handleOpen);
  }, [requestNotesBootstrap, wsRef]);

  // Listen for notes messages
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'notes.list.response':
            setNotes(msg.notes || []);
            setGroups(prev => (Array.isArray(msg.groups) && msg.groups.length > 0 ? msg.groups : prev));
            setLoading(false);
            setError(null);
            break;

          case 'notes.groups.list.response':
            setGroups(msg.groups || []);
            break;

          case 'notes.groups.add.ack':
            setGroups(msg.groups || []);
            break;

          case 'notes.add.ack':
            setNotes(prev => [...prev, msg.note]);
            setGroups(prev => {
              if (!msg.note?.group) return prev;
              const exists = prev.some(group => group.toLowerCase() === msg.note.group.toLowerCase());
              if (exists) return prev;
              return [...prev, msg.note.group].sort((a, b) => a.localeCompare(b));
            });
            break;

          case 'notes.update.ack':
            setNotes(prev =>
              prev.map(n => (n.id === msg.note.id ? msg.note : n))
            );
            break;

          case 'notes.delete.ack':
            setNotes(prev => prev.filter(n => n.id !== msg.id));
            break;

          case 'notes.list.error':
          case 'notes.groups.list.error':
          case 'notes.groups.add.error':
          case 'notes.image.upload.error':
          case 'notes.add.error':
          case 'notes.update.error':
          case 'notes.delete.error':
            setError(msg.error);
            setLoading(false);
            break;
        }
      } catch (err) {
        console.error('[useNotes] Failed to parse message:', err);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [wsRef]);

  const addNote = useCallback(
    async (content: string, group: string, imageUrl?: string): Promise<Note> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      return new Promise((resolve, reject) => {
        const requestId = uuidv4();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.add.ack') {
              resolve(msg.note);
            } else if (msg.type === 'notes.add.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);
            reject(err);
          }
        };

        // Set timeout to prevent hanging promises
        timeoutId = setTimeout(() => {
          ws.removeEventListener('message', handleResponse);
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);

        ws.addEventListener('message', handleResponse);
        ws.send(JSON.stringify({ type: 'notes.add', requestId, content, group, imageUrl }));
      });
    },
    [wsRef]
  );

  const addGroup = useCallback(
    async (group: string): Promise<string[]> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      return new Promise((resolve, reject) => {
        const requestId = uuidv4();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.groups.add.ack') {
              setGroups(msg.groups || []);
              resolve(msg.groups || []);
            } else if (msg.type === 'notes.groups.add.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);
            reject(err);
          }
        };

        timeoutId = setTimeout(() => {
          ws.removeEventListener('message', handleResponse);
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);

        ws.addEventListener('message', handleResponse);
        ws.send(JSON.stringify({ type: 'notes.groups.add', requestId, group }));
      });
    },
    [wsRef]
  );

  const readFileAsDataUri = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        if (typeof data !== 'string') {
          reject(new Error('Failed to read image file'));
          return;
        }
        resolve(data);
      };
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadNoteImage = useCallback(
    async (file: File): Promise<string> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      const media = await readFileAsDataUri(file);

      return new Promise((resolve, reject) => {
        const requestId = uuidv4();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.image.upload.ack') {
              resolve(msg.imageUrl);
            } else if (msg.type === 'notes.image.upload.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);
            reject(err);
          }
        };

        timeoutId = setTimeout(() => {
          ws.removeEventListener('message', handleResponse);
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);

        ws.addEventListener('message', handleResponse);
        ws.send(
          JSON.stringify({
            type: 'notes.image.upload',
            requestId,
            media,
            mimeType: file.type,
            fileName: file.name,
          })
        );
      });
    },
    [readFileAsDataUri, wsRef]
  );

  const updateNote = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Note, 'id' | 'createdAt'>>
    ): Promise<Note> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      return new Promise((resolve, reject) => {
        const requestId = uuidv4();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.update.ack') {
              resolve(msg.note);
            } else if (msg.type === 'notes.update.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);
            reject(err);
          }
        };

        // Set timeout to prevent hanging promises
        timeoutId = setTimeout(() => {
          ws.removeEventListener('message', handleResponse);
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);

        ws.addEventListener('message', handleResponse);
        ws.send(JSON.stringify({ type: 'notes.update', requestId, id, ...updates }));
      });
    },
    [wsRef]
  );

  const deleteNote = useCallback(
    async (id: string): Promise<boolean> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      return new Promise((resolve, reject) => {
        const requestId = uuidv4();
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.delete.ack') {
              resolve(true);
            } else if (msg.type === 'notes.delete.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            ws.removeEventListener('message', handleResponse);
            reject(err);
          }
        };

        // Set timeout to prevent hanging promises
        timeoutId = setTimeout(() => {
          ws.removeEventListener('message', handleResponse);
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);

        ws.addEventListener('message', handleResponse);
        ws.send(JSON.stringify({ type: 'notes.delete', requestId, id }));
      });
    },
    [wsRef]
  );

  const refreshNotes = useCallback(async (): Promise<void> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    setLoading(true);
    requestNotesBootstrap();
  }, [requestNotesBootstrap, wsRef]);

  return {
    notes,
    groups,
    loading,
    error,
    addNote,
    addGroup,
    uploadNoteImage,
    updateNote,
    deleteNote,
    refreshNotes,
  };
}

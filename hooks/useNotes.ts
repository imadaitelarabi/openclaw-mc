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
  loading: boolean;
  error: string | null;
  addNote: (content: string, group: string, imageUrl?: string) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<Note>;
  deleteNote: (id: string) => Promise<boolean>;
  refreshNotes: () => Promise<void>;
}

export function useNotes({ wsRef }: UseNotesProps): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load notes on mount
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const requestId = uuidv4();
    ws.send(JSON.stringify({ type: 'notes.list', requestId }));
  }, [wsRef]);

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
            setLoading(false);
            setError(null);
            break;

          case 'notes.add.ack':
            setNotes(prev => [...prev, msg.note]);
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
        
        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.add.ack') {
              resolve(msg.note);
            } else if (msg.type === 'notes.add.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            reject(err);
          }
        };

        ws.addEventListener('message', handleResponse);
        ws.send(JSON.stringify({ type: 'notes.add', requestId, content, group, imageUrl }));
      });
    },
    [wsRef]
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

        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.update.ack') {
              resolve(msg.note);
            } else if (msg.type === 'notes.update.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            reject(err);
          }
        };

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

        const handleResponse = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.requestId !== requestId) return;

            ws.removeEventListener('message', handleResponse);

            if (msg.type === 'notes.delete.ack') {
              resolve(true);
            } else if (msg.type === 'notes.delete.error') {
              reject(new Error(msg.error));
            }
          } catch (err) {
            reject(err);
          }
        };

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
    const requestId = uuidv4();
    ws.send(JSON.stringify({ type: 'notes.list', requestId }));
  }, [wsRef]);

  return {
    notes,
    loading,
    error,
    addNote,
    updateNote,
    deleteNote,
    refreshNotes,
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'reasoning';
  content: string;
  stopReason?: string;
  errorMessage?: string;
  thinking?: string; // Deprecated - kept for backward compatibility
  tool?: {
    name: string;
    args?: any;
    result?: any;
    status?: 'start' | 'end' | 'error';
    error?: string;
    duration?: number; // Duration in milliseconds
    exitCode?: number; // Exit code for exec tools
    startTime?: number; // Timestamp when tool started
  };
  timestamp: number;
  runId?: string;
  attachments?: Array<{
    fileName?: string;
    type: string; // e.g., "image"
    mimeType: string;
    content: string; // data URI with base64
  }>;
}

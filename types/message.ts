export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'reasoning';
  content: string;
  thinking?: string; // Deprecated - kept for backward compatibility
  tool?: {
    name: string;
    args?: any;
    result?: any;
    status?: string;
  };
  timestamp: number;
  runId?: string;
}

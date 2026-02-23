export interface Agent {
  id: string;
  name: string;
  status: string;
  model?: string;
  lastActive?: number;
  emoji?: string;
  identity?: string;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "no-config"
  | "pairing-required";

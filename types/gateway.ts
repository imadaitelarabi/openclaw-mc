export interface GatewayEvent {
  event: string;
  payload: {
    stream?: string;
    data?: any;
    runId?: string;
    sessionKey?: string;
    seq?: number;
    tool?: string;
    message?: any;
    state?: string;
  };
}

export interface WebSocketMessage {
  type: string;
  status?: string;
  message?: string;
  data?: any;
  event?: string;
  payload?: any;
}

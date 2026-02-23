import { useEffect, useRef, useCallback, useState } from "react";
import type { ConnectionStatus, Agent } from "@/types";
import type { WebSocketMessage } from "@/types/gateway";

interface UseGatewayWebSocketProps {
  onEvent: (message: any) => void;
}

export function useGatewayWebSocket({ onEvent }: UseGatewayWebSocketProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsPath = window.location.pathname.startsWith("/mission-controle")
      ? "/mission-controle/api/ws"
      : "/api/ws";
    const ws = new WebSocket(`${protocol}//${window.location.host}${wsPath}`);

    ws.onopen = () => {
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Handle core infrastructure messages
        if (message.type === "status") {
          setConnectionStatus(message.status as ConnectionStatus);
          setConnectionMessage(message.message || null);
        } else if (message.type === "agents") {
          setAgents(message.data || []);
        }

        // Forward everything to onEvent for application logic
        onEvent(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      setConnectionMessage(null);
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
      }
    };

    wsRef.current = ws;
  }, [onEvent]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  return {
    connectionStatus,
    connectionMessage,
    agents,
    sendMessage,
    wsRef,
  };
}

/**
 * Session Control Hook
 * Provides functions to abort active runs and reset sessions
 */

interface SessionControlMessage {
  type: string;
  agentId: string;
  message?: string;
}

interface UseSessionControlProps {
  sendMessage: (msg: SessionControlMessage) => void;
}

export function useSessionControl({ sendMessage }: UseSessionControlProps) {
  const abortRun = (agentId: string) => {
    sendMessage({
      type: "chat.abort.run",
      agentId,
    });
  };

  const resetSession = (agentId: string) => {
    // Sending /new as a message triggers a session reset on the gateway
    sendMessage({
      type: "chat.send",
      agentId,
      message: "/new",
    });
  };

  return { abortRun, resetSession };
}

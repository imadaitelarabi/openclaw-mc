import { useState, useEffect, useCallback } from 'react';

interface SessionSettings {
  model?: string;
  modelProvider?: string;
  thinking?: 'off' | 'low' | 'medium' | 'high';
  verbose?: 'on' | 'off' | 'inherit';
  reasoning?: 'off' | 'on' | 'stream';
}

interface Model {
  id: string;
  alias?: string;
  provider?: string;
}

export function useSessionSettings(
  selectedAgent: string | null, 
  sendMessage: (message: any) => void,
  connectionStatus?: string
) {
  const [models, setModels] = useState<Model[]>([]);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({});
  const [loading, setLoading] = useState(false);

  // Fetch models when connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'models.list' });
    }
  }, [sendMessage, connectionStatus]);

  // Fetch sessions when agent changes or connected
  useEffect(() => {
    if (!selectedAgent || connectionStatus !== 'connected') return;
    sendMessage({ type: 'sessions.list' });
  }, [selectedAgent, sendMessage, connectionStatus]);

  const updateSetting = useCallback(async (sessionKey: string, patch: Partial<SessionSettings>) => {
    setLoading(true);
    sendMessage({
      type: 'sessions.patch',
      sessionKey,
      ...patch
    });
    // Loading state will be cleared when we get the updated sessions back
  }, [sendMessage]);

  return {
    models,
    sessionSettings,
    loading,
    updateSetting,
    setModels,
    setSessionSettings,
    setLoading
  };
}

"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { Extension, ExtensionState } from '@/types/extension';
import { extensionRegistry } from '@/lib/extension-registry';

interface ExtensionContextValue {
  extensions: Extension[];
  enabledExtensions: Extension[];
  isLoading: boolean;
  enableExtension: (extensionName: string) => Promise<void>;
  disableExtension: (extensionName: string) => Promise<void>;
  getExtension: (extensionName: string) => Extension | undefined;
  isExtensionEnabled: (extensionName: string) => boolean;
  needsOnboarding: (extensionName: string) => Promise<boolean>;
  completeOnboarding: (extensionName: string) => Promise<void>;
  refreshExtensions: () => void;
}

const ExtensionContext = createContext<ExtensionContextValue | undefined>(undefined);

export function useExtensions() {
  const context = useContext(ExtensionContext);
  if (!context) {
    throw new Error('useExtensions must be used within an ExtensionProvider');
  }
  return context;
}

interface ExtensionProviderProps {
  children: ReactNode;
}

export function ExtensionProvider({ children }: ExtensionProviderProps) {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [enabledExtensions, setEnabledExtensions] = useState<Extension[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize registry and load extensions
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('[ExtensionContext] Initializing extension registry...');
        await extensionRegistry.initialize();
        
        // Load all registered extensions
        refreshExtensions();
        
        console.log('[ExtensionContext] Extension registry initialized');
      } catch (error) {
        console.error('[ExtensionContext] Failed to initialize:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const refreshExtensions = useCallback(() => {
    const allExtensions = extensionRegistry.getAll();
    const enabled = extensionRegistry.getEnabled();
    
    setExtensions(allExtensions);
    setEnabledExtensions(enabled);
    
    console.log(`[ExtensionContext] Loaded ${allExtensions.length} extensions, ${enabled.length} enabled`);
  }, []);

  const enableExtension = useCallback(async (extensionName: string) => {
    try {
      console.log(`[ExtensionContext] Enabling extension: ${extensionName}`);
      await extensionRegistry.enable(extensionName);
      refreshExtensions();
    } catch (error) {
      console.error(`[ExtensionContext] Failed to enable extension "${extensionName}":`, error);
      throw error;
    }
  }, [refreshExtensions]);

  const disableExtension = useCallback(async (extensionName: string) => {
    try {
      console.log(`[ExtensionContext] Disabling extension: ${extensionName}`);
      await extensionRegistry.disable(extensionName);
      refreshExtensions();
    } catch (error) {
      console.error(`[ExtensionContext] Failed to disable extension "${extensionName}":`, error);
      throw error;
    }
  }, [refreshExtensions]);

  const getExtension = useCallback((extensionName: string) => {
    return extensionRegistry.get(extensionName);
  }, []);

  const isExtensionEnabled = useCallback((extensionName: string) => {
    return extensionRegistry.isEnabled(extensionName);
  }, []);

  const needsOnboarding = useCallback(async (extensionName: string) => {
    return extensionRegistry.needsOnboarding(extensionName);
  }, []);

  const completeOnboarding = useCallback(async (extensionName: string) => {
    try {
      console.log(`[ExtensionContext] Completing onboarding for: ${extensionName}`);
      await extensionRegistry.completeOnboarding(extensionName);
      refreshExtensions();
    } catch (error) {
      console.error(`[ExtensionContext] Failed to complete onboarding for "${extensionName}":`, error);
      throw error;
    }
  }, [refreshExtensions]);

  const value: ExtensionContextValue = {
    extensions,
    enabledExtensions,
    isLoading,
    enableExtension,
    disableExtension,
    getExtension,
    isExtensionEnabled,
    needsOnboarding,
    completeOnboarding,
    refreshExtensions
  };

  return (
    <ExtensionContext.Provider value={value}>
      {children}
    </ExtensionContext.Provider>
  );
}

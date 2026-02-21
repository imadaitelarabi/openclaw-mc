"use client";

import { useMemo, useState, useEffect } from "react";
import { useExtensions } from "@/contexts/ExtensionContext";
import { useToast } from "@/hooks/useToast";
import type { ExtensionConnectionStatus } from "@/types/extension";

interface ExtensionOnboardingPanelProps {
  extensionName: string;
  onClose: () => void;
}

export function ExtensionOnboardingPanel({
  extensionName,
  onClose,
}: ExtensionOnboardingPanelProps) {
  const { getExtension, completeOnboarding, enableExtension, refreshExtensions } = useExtensions();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ExtensionConnectionStatus | undefined>();
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const extension = useMemo(() => getExtension(extensionName), [getExtension, extensionName]);
  const OnboardingComponent = extension?.hooks.onboarding?.component;

  // Check connection status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (!extension?.hooks.onboarding?.checkStatus) {
        setIsCheckingStatus(false);
        return;
      }

      try {
        const status = await extension.hooks.onboarding.checkStatus();
        setConnectionStatus(status);
      } catch (error) {
        console.error("[ExtensionOnboarding] Failed to check connection status:", error);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkStatus();
  }, [extension]);

  const handleComplete = async () => {
    try {
      await completeOnboarding(extensionName);
      await enableExtension(extensionName);
      refreshExtensions();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to enable extension after onboarding.";
      toast({
        title: "Extension setup failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (!extension) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-sm text-muted-foreground">
        Extension not found: {extensionName}
      </div>
    );
  }

  if (!OnboardingComponent) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-sm text-muted-foreground">
        This extension does not provide an onboarding panel.
      </div>
    );
  }

  if (isCheckingStatus) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-sm text-muted-foreground">
        Checking connection status...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <OnboardingComponent
        extensionName={extensionName}
        onComplete={handleComplete}
        onCancel={onClose}
        connectionStatus={connectionStatus}
      />
    </div>
  );
}

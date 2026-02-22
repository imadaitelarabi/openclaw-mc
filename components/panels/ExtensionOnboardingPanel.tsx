"use client";

import { useMemo, useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
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

  const { usage, writePermissions } = extension.manifest;
  const hasDisclosure = usage || (writePermissions && writePermissions.length > 0);

  return (
    <div className="h-full overflow-auto">
      {hasDisclosure && (
        <div className="px-6 pt-6 space-y-3">
          {usage && (
            <div className="text-sm text-muted-foreground border border-border rounded-md p-3 bg-muted/30">
              <p className="font-medium text-foreground mb-1">About this extension</p>
              <p>{usage}</p>
            </div>
          )}
          {writePermissions && writePermissions.length > 0 && (
            <div className="text-sm border border-yellow-500/40 rounded-md p-3 bg-yellow-500/10">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium mb-1">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                Write permissions required
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {writePermissions.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <OnboardingComponent
        extensionName={extensionName}
        onComplete={handleComplete}
        onCancel={onClose}
        connectionStatus={connectionStatus}
      />
    </div>
  );
}

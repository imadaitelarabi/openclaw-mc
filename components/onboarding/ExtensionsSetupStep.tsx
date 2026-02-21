"use client";

import { useState } from 'react';
import { Puzzle, Github, Check } from 'lucide-react';
import { useExtensions } from '@/contexts/ExtensionContext';
import { ExtensionOnboardingPanel } from '@/components/panels/ExtensionOnboardingPanel';

interface ExtensionsSetupStepProps {
  onComplete: () => void;
}

export function ExtensionsSetupStep({ onComplete }: ExtensionsSetupStepProps) {
  const { extensions, needsOnboarding } = useExtensions();
  const [selectedExtension, setSelectedExtension] = useState<string | null>(null);

  // Filter to only show extensions that support onboarding
  const onboardableExtensions = extensions.filter(ext => {
    return ext.manifest.hooks?.includes('onboarding');
  });

  const handleExtensionClick = (extensionName: string) => {
    setSelectedExtension(extensionName);
  };

  const handleExtensionComplete = () => {
    setSelectedExtension(null);
  };

  const getExtensionIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'github':
        return Github;
      default:
        return Puzzle;
    }
  };

  if (selectedExtension) {
    return (
      <div className="h-full">
        <ExtensionOnboardingPanel
          extensionName={selectedExtension}
          onClose={handleExtensionComplete}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[500px] px-6 py-12">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold">Enhance Your Workflow</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Connect extensions to supercharge OpenClaw MC. You can always set these up later from the status bar.
          </p>
        </div>

        {onboardableExtensions.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Puzzle className="w-16 h-16 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">No extensions available to configure</p>
            <button
              onClick={onComplete}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Continue to OpenClaw MC
            </button>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6 mt-12">
              {onboardableExtensions.map((extension) => {
                const Icon = getExtensionIcon(extension.manifest.name);
                const isConfigured = extension.state.enabled && extension.state.onboarded;
                const requiresSetup = needsOnboarding(extension.manifest.name);

                return (
                  <button
                    key={extension.manifest.name}
                    onClick={() => handleExtensionClick(extension.manifest.name)}
                    className="group relative p-6 bg-secondary border-2 border-border rounded-2xl hover:border-primary transition-all text-left"
                  >
                    {isConfigured && (
                      <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-lg font-bold">{extension.manifest.name}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {extension.manifest.description}
                        </p>
                        <div className="pt-2">
                          {isConfigured ? (
                            <span className="text-xs text-green-500 font-medium">
                              ✓ Configured
                            </span>
                          ) : requiresSetup ? (
                            <span className="text-xs text-primary font-medium">
                              → Setup Required
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">
                              → Optional
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center pt-8">
              <button
                onClick={onComplete}
                className="px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all text-lg"
              >
                Continue to OpenClaw MC
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

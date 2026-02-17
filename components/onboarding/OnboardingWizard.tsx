"use client";

import { useState, useCallback } from 'react';
import { Sparkles, Rocket, ArrowLeft, Check } from 'lucide-react';
import { uiStateStore } from '@/lib/ui-state-db';
import { GatewayConnectionStep } from './GatewayConnectionStep';
import { ExtensionsSetupStep } from './ExtensionsSetupStep';

type OnboardingStep = 'gateway' | 'extensions';

interface OnboardingWizardProps {
  sendMessage: (message: any) => void;
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingWizard({ sendMessage, onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('gateway');
  const [gatewayConfigured, setGatewayConfigured] = useState(false);

  const handleGatewayComplete = useCallback(() => {
    setGatewayConfigured(true);
    setCurrentStep('extensions');
  }, []);

  const handleSkip = useCallback(async () => {
    await uiStateStore.skipOnboarding();
    onSkip();
  }, [onSkip]);

  const handleComplete = useCallback(async () => {
    await uiStateStore.completeOnboarding();
    onComplete();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col font-mono overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Welcome to Mission Control</h1>
            <p className="text-xs text-muted-foreground">Let's get you set up</p>
          </div>
        </div>
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </header>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 py-4 bg-secondary/30">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              currentStep === 'gateway' || gatewayConfigured
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {gatewayConfigured ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <span className={`text-sm font-medium ${currentStep === 'gateway' ? 'text-foreground' : 'text-muted-foreground'}`}>
            Gateway
          </span>
        </div>
        <div className="w-12 h-px bg-border" />
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              currentStep === 'extensions'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            2
          </div>
          <span className={`text-sm font-medium ${currentStep === 'extensions' ? 'text-foreground' : 'text-muted-foreground'}`}>
            Extensions
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === 'gateway' && (
          <GatewayConnectionStep 
            sendMessage={sendMessage}
            onComplete={handleGatewayComplete} 
          />
        )}
        {currentStep === 'extensions' && (
          <ExtensionsSetupStep onComplete={handleComplete} />
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-4 border-t border-border bg-background/80 backdrop-blur-lg">
        <button
          onClick={() => setCurrentStep('gateway')}
          disabled={currentStep === 'gateway'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          {currentStep === 'extensions' && (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Launch Mission Control
              <Rocket className="w-5 h-5" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

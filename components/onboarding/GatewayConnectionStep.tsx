"use client";

import { useState } from 'react';
import { Zap, Globe, Wifi, Shield, ArrowRight, Loader2, Copy, Check } from 'lucide-react';

interface GatewayConnectionStepProps {
  onConnectGateway: (name: string, url: string, token: string) => Promise<void>;
  onComplete: () => void;
}

type SetupMode = 'local' | 'remote' | null;

export function GatewayConnectionStep({ onConnectGateway, onComplete }: GatewayConnectionStepProps) {
  const [mode, setMode] = useState<SetupMode>(null);
  const [name, setName] = useState('My Gateway');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('npm install -g openclaw && openclaw gateway start');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLocalConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      await onConnectGateway('Local Gateway', 'ws://localhost:18789', '');
      onComplete();
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Failed to connect to local gateway');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoteConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !token) return;

    setIsConnecting(true);
    setConnectionError(null);
    try {
      await onConnectGateway(name, url, token);
      onComplete();
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Failed to connect to gateway');
    } finally {
      setIsConnecting(false);
    }
  };

  if (mode === null) {
    return (
      <div className="flex items-center justify-center min-h-[500px] px-6 py-12">
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold">Connect to OpenClaw Gateway</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose how you want to connect. You can start with a local instance for quick testing
              or connect to a remote gateway for production use.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Local Instance Option */}
            <button
              onClick={() => setMode('local')}
              className="group relative p-8 bg-secondary border-2 border-border rounded-2xl hover:border-primary transition-all text-left"
            >
              <div className="absolute top-6 right-6 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-4 pr-16">
                <h3 className="text-xl font-bold">Local Instance</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Quick start with a local OpenClaw Gateway. Perfect for development and testing.
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium pt-2">
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>

            {/* Remote Gateway Option */}
            <button
              onClick={() => setMode('remote')}
              className="group relative p-8 bg-secondary border-2 border-border rounded-2xl hover:border-primary transition-all text-left"
            >
              <div className="absolute top-6 right-6 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-4 pr-16">
                <h3 className="text-xl font-bold">Remote Gateway</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Connect to a remote OpenClaw Gateway. Ideal for production deployments.
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium pt-2">
                  Configure
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'local') {
    return (
      <div className="flex items-center justify-center min-h-[500px] px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <button
            onClick={() => setMode(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to options
          </button>

          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold">Local Gateway Setup</h2>
            <p className="text-muted-foreground">
              Install and start the OpenClaw Gateway on your local machine
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-secondary/50 border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Step 1: Install & Start Gateway
                </span>
              </div>
              <div className="bg-background/50 rounded-lg p-4 font-mono text-sm flex items-center justify-between gap-4">
                <code className="flex-1 overflow-x-auto">
                  npm install -g openclaw && openclaw gateway start
                </code>
                <button
                  onClick={handleCopyCommand}
                  className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Run this command in your terminal to install and start a local gateway instance
              </p>
            </div>

            <div className="bg-secondary/50 border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Step 2: Connect
                </span>
              </div>
              <button
                onClick={handleLocalConnect}
                disabled={isConnecting}
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect to Localhost
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                This will connect to <code className="bg-background px-1 rounded">ws://localhost:18789</code>
              </p>
              {connectionError && (
                <p className="text-xs text-destructive text-center">{connectionError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[500px] px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <button
          onClick={() => setMode(null)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to options
        </button>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Globe className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Remote Gateway</h2>
          <p className="text-muted-foreground">
            Connect to your remote OpenClaw Gateway
          </p>
        </div>

        <form onSubmit={handleRemoteConnect} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Gateway Name
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Cluster"
                className="w-full bg-secondary border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              WebSocket URL
            </label>
            <div className="relative">
              <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://1.2.3.4:18789"
                className="w-full bg-secondary border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Gateway Token
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your security token"
                className="w-full bg-secondary border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isConnecting || !url || !token}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect to Gateway
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          {connectionError && (
            <p className="text-xs text-destructive text-center">{connectionError}</p>
          )}
        </form>
      </div>
    </div>
  );
}

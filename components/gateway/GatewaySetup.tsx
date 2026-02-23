import { useState } from "react";
import { Wifi, Shield, Globe, ArrowRight, Loader2, X } from "lucide-react";

interface GatewaySetupProps {
  onConnect: (name: string, url: string, token: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function GatewaySetup({ onConnect, onCancel, isLoading }: GatewaySetupProps) {
  const [name, setName] = useState("My Gateway");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && token) {
      onConnect(name, url, token);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Cancel Button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      )}
      {/* Background Decorative Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            <img
              src="/images/logos/openclawmc-logo-white.png"
              alt="OpenClaw MC"
              className="w-16 h-16 object-contain hidden dark:block"
            />
            <img
              src="/images/logos/openclawmc-logo-black.png"
              alt="OpenClaw MC"
              className="w-16 h-16 object-contain block dark:hidden"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Connect Gateway</h1>
          <p className="text-muted-foreground">Establish a secure link to your OpenClaw Gateway.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            disabled={isLoading || !url || !token}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Initialize Link
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Cancel and Return to Chat
          </button>
        )}

        <div className="pt-4 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Settings will be persisted to{" "}
            <code className="bg-secondary px-1 rounded">~/.oc-mission-control/config.json</code>
          </p>
        </div>
      </div>
    </div>
  );
}

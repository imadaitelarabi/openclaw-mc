"use client";

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface CreateAgentPanelProps {
  onCreateAgent: (payload: {
    id?: string;
    name: string;
    workspace?: string;
    model?: string;
    tools?: { profile: string };
    sandbox?: { mode: string };
  }) => Promise<{ agentId: string; agentName: string }>;
  onClose?: () => void;
}

export function CreateAgentPanel({ onCreateAgent, onClose }: CreateAgentPanelProps) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    workspace: '',
    model: '',
    toolsProfile: 'coding',
    sandboxMode: 'on'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<{ agentId: string; agentName: string } | null>(null);

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      workspace: '',
      model: '',
      toolsProfile: 'coding',
      sandboxMode: 'on'
    });
    setError(null);
    setCreatedAgent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Generate ID if not provided
      const agentId = formData.id.trim() || `agent-${uuidv4().split('-')[0]}`;
      const agentName = formData.name.trim();
      
      if (!agentName) {
        setError('Agent name is required');
        setIsSubmitting(false);
        return;
      }

      const created = await onCreateAgent({
        id: agentId,
        name: agentName,
        workspace: formData.workspace.trim() || undefined,
        model: formData.model || undefined,
        tools: { profile: formData.toolsProfile },
        sandbox: { mode: formData.sandboxMode }
      });

      setCreatedAgent(created);
      setIsSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
      setIsSubmitting(false);
    }
  };

  if (createdAgent) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Agent Created</h2>
            <div className="p-4 bg-primary/10 border border-primary rounded-lg text-primary text-sm mb-6">
              Agent "{createdAgent.agentName}" is ready and available immediately without restarting the Gateway.
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={resetForm}
                className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Create Another Agent
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-6 py-3 bg-secondary text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
                >
                  Close Panel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Create New Agent</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Agent Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Agent Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="My AI Agent"
                required
              />
            </div>

            {/* Agent ID */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Agent ID <span className="text-muted-foreground text-xs">(optional - auto-generated if empty)</span>
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="my-agent"
              />
            </div>

            {/* Workspace Path */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Workspace Path <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.workspace}
                onChange={(e) => setFormData({ ...formData, workspace: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="~/.openclaw/workspace-{id}"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Model <span className="text-muted-foreground text-xs">(optional - uses default if empty)</span>
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="claude-3-5-sonnet-20241022"
              />
            </div>

            {/* Tools Profile */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Tools Profile
              </label>
              <select
                value={formData.toolsProfile}
                onChange={(e) => setFormData({ ...formData, toolsProfile: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="coding">Coding (Full Development Tools)</option>
                <option value="minimal">Minimal (Basic Tools Only)</option>
                <option value="full">Full (All Available Tools)</option>
              </select>
            </div>

            {/* Sandbox Mode */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Sandbox Mode
              </label>
              <select
                value={formData.sandboxMode}
                onChange={(e) => setFormData({ ...formData, sandboxMode: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="on">On (Isolated Environment)</option>
                <option value="off">Off (Direct Access)</option>
              </select>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isSubmitting ? 'Creating...' : 'Create Agent'}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-secondary text-foreground rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

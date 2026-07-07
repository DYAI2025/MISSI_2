import React, { useState, useEffect } from 'react';
import { LLMProviderConfig, LLMProviderType } from '../types/index.js';
import { Shield, Key, Network, Eye, EyeOff, Check, RefreshCw } from 'lucide-react';

interface ProvidersCardProps {
  providers: (LLMProviderConfig & { isConfigured: boolean })[];
  onUpdateProvider: (config: {
    id: string;
    type: LLMProviderType;
    apiKey: string;
    customUrl?: string;
    defaultModel?: string;
  }) => Promise<void>;
}

export const ProvidersCard: React.FC<ProvidersCardProps> = ({
  providers,
  onUpdateProvider,
}) => {
  const [activeId, setActiveId] = useState<string>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [success, setSuccess] = useState(false);

  const activeProvider = providers.find(p => p.id === activeId);

  useEffect(() => {
    if (activeProvider) {
      setApiKey('');
      setCustomUrl(activeProvider.customUrl || '');
      setDefaultModel(activeProvider.defaultModel || '');
      setSuccess(false);
    }
  }, [activeId, activeProvider]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    setIsUpdating(true);
    setSuccess(false);

    try {
      await onUpdateProvider({
        id: activeProvider.id,
        type: activeProvider.type,
        apiKey: apiKey, // Keep empty if unmodified
        customUrl: customUrl || undefined,
        defaultModel: defaultModel,
      });
      setSuccess(true);
      setApiKey('');
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update provider keys:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div id="providers-card" className="bg-brand-aside border border-brand-border rounded-none p-4 shadow-none flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-green" />
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-muted font-bold">AI Provider Setup // COGNITIVE</h2>
        </div>
        <div className="text-[9px] text-brand-muted flex items-center gap-1 font-mono uppercase">
          <Network className="w-3.5 h-3.5 text-brand-muted" />
          <span>Local Sockets + Web APIs</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
        {/* Left column: List of providers */}
        <div className="md:col-span-1 border-r border-brand-border pr-2 space-y-1">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`w-full text-left p-2 rounded-none transition-all flex items-center justify-between font-mono ${
                activeId === p.id
                  ? 'bg-brand-border-light text-brand-text border border-brand-border'
                  : 'bg-brand-bg hover:bg-brand-row text-brand-muted hover:text-brand-text border border-brand-border/40'
              }`}
            >
              <div>
                <span className="text-xs font-bold block">{p.name}</span>
                <span className="text-[9px] opacity-60 block uppercase">{p.type}</span>
              </div>
              {p.isConfigured && (
                <span className="text-[9px] bg-brand-green/10 text-brand-green px-1.5 py-0.5 rounded-none border border-brand-green/20 font-bold">
                  ACTIVE
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right column: Form details */}
        <div className="md:col-span-2">
          {activeProvider ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <h3 className="text-xs font-mono font-bold text-brand-text">{activeProvider.name} Gateway Config</h3>
                <p className="text-[10px] font-mono text-brand-muted mt-0.5">
                  Set target models and secret credentials. Keys are held safely on the server backend.
                </p>
              </div>

              <div>
                <label className="block text-[9px] text-brand-muted uppercase mb-1 font-mono italic">Target Model ID</label>
                <input
                  type="text"
                  className="w-full text-xs font-mono bg-brand-bg border border-brand-border rounded-none px-3 py-2 text-brand-text focus:outline-none focus:border-brand-green transition-colors"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="e.g. gemini-2.5-flash"
                />
              </div>

              {(activeProvider.type === LLMProviderType.GEMINI ||
                activeProvider.type === LLMProviderType.OPENAI ||
                activeProvider.type === LLMProviderType.ANTHROPIC ||
                activeProvider.type === LLMProviderType.OPENROUTER) && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[9px] text-brand-muted uppercase font-mono italic font-bold">Secret API Key</label>
                    {activeProvider.isConfigured && (
                      <span className="text-[9px] text-brand-green font-mono font-bold uppercase">✓ Credentials Loaded</span>
                    )}
                  </div>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-brand-muted absolute left-3 top-3" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      className="w-full text-xs bg-brand-bg border border-brand-border rounded-none pl-9 pr-10 py-2 text-brand-text focus:outline-none focus:border-brand-green transition-colors font-mono"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={activeProvider.isConfigured ? '••••••••••••••••••••••••••••••••' : 'Enter secret API Key...'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 text-brand-muted hover:text-brand-text transition-colors"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {(activeProvider.type === LLMProviderType.OLLAMA ||
                activeProvider.type === LLMProviderType.LMSTUDIO ||
                activeProvider.type === LLMProviderType.OPENROUTER) && (
                <div>
                  <label className="block text-[9px] text-brand-muted uppercase mb-1 font-mono italic">Gateway Endpoint URL</label>
                  <input
                    type="text"
                    className="w-full text-xs font-mono bg-brand-bg border border-brand-border rounded-none px-3 py-2 text-brand-text focus:outline-none focus:border-brand-green transition-colors"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder={activeProvider.type === LLMProviderType.OLLAMA ? 'http://localhost:11434' : 'http://localhost:1234'}
                  />
                </div>
              )}

              <div className="flex items-center justify-between border-t border-brand-border pt-4 mt-6">
                <span className="text-[10px] text-brand-muted flex items-center gap-1 font-mono uppercase">
                  <Shield className="w-3.5 h-3.5 text-brand-muted" /> TLS Secure Sockets
                </span>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase px-3 py-2 rounded-none bg-brand-border-light text-brand-text border border-brand-border hover:bg-brand-border transition-colors disabled:opacity-40"
                >
                  {isUpdating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : success ? (
                    <Check className="w-3.5 h-3.5 text-brand-green" />
                  ) : null}
                  {isUpdating ? 'Saving...' : success ? 'Credentials Saved!' : 'Save Credentials'}
                </button>
              </div>
            </form>
          ) : (
            <div className="h-full flex items-center justify-center text-brand-muted font-mono text-xs uppercase">
              Select a provider to configure.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

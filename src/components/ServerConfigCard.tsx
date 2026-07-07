import React, { useState, useEffect } from 'react';
import { GameMode, Difficulty, MinecraftServerConfig } from '../types/index.js';
import { Play, Square, Settings, Terminal, Radio, Activity, CheckCircle, AlertTriangle, AlertCircle, Layers } from 'lucide-react';

interface ServerConfigCardProps {
  serverStatus: 'stopped' | 'starting' | 'running' | 'stopping' | 'blocked' | 'failed';
  runtimeMode: 'live' | 'simulation' | 'blocked' | 'failed' | 'stopped';
  config: MinecraftServerConfig;
  onUpdateConfig: (config: Partial<MinecraftServerConfig>) => Promise<void>;
  onStartServer: (acceptEULA: boolean, useEmulator: boolean) => Promise<void>;
  onStopServer: () => Promise<void>;
  onSendCommand: (command: string) => Promise<void>;
  allowSimulationMode: boolean;
}

export const ServerConfigCard: React.FC<ServerConfigCardProps> = ({
  serverStatus,
  runtimeMode,
  config,
  onUpdateConfig,
  onStartServer,
  onStopServer,
  onSendCommand,
  allowSimulationMode,
}) => {
  const [serverName, setServerName] = useState(config.serverName);
  const [seed, setSeed] = useState(config.seed);
  const [levelName, setLevelName] = useState(config.levelName);
  const [gameMode, setGameMode] = useState<GameMode>(config.gameMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(config.difficulty);
  const [port, setPort] = useState(config.port);
  const [command, setCommand] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSmokeTesting, setIsSmokeTesting] = useState(false);
  const [smokeTestResult, setSmokeTestResult] = useState<{ success: boolean; logs: string[] } | null>(null);
  
  const [acceptEULA, setAcceptEULA] = useState(false);
  const [useEmulator, setUseEmulator] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Server Save-State indicators
  const [serverSaveStatus, setServerSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'failed'>('saved');
  const [serverLastSavedAt, setServerLastSavedAt] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Workspace Preference States
  const [defaultProviderId, setDefaultProviderId] = useState('gemini');
  const [intervalMs, setIntervalMs] = useState(8000);
  const [workspaceSaveStatus, setWorkspaceSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'failed'>('saved');
  const [workspaceLastSavedAt, setWorkspaceLastSavedAt] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [savedWorkspaceConfig, setSavedWorkspaceConfig] = useState<{ defaultProviderId?: string; intervalMs?: number }>({
    defaultProviderId: 'gemini',
    intervalMs: 8000,
  });

  // Check if current form values are different from saved server properties
  const hasUnsavedServerChanges = 
    serverName !== config.serverName ||
    seed !== config.seed ||
    levelName !== config.levelName ||
    gameMode !== config.gameMode ||
    difficulty !== config.difficulty ||
    port !== config.port;

  // Check if current form values are different from saved workspace properties
  const hasUnsavedWorkspaceChanges =
    defaultProviderId !== savedWorkspaceConfig.defaultProviderId ||
    intervalMs !== savedWorkspaceConfig.intervalMs;

  // State manager for tracking dirty fields reactively
  const [dirtyFields, setDirtyFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDirtyFields({
      serverName: serverName !== config.serverName,
      seed: seed !== config.seed,
      levelName: levelName !== config.levelName,
      gameMode: gameMode !== config.gameMode,
      difficulty: difficulty !== config.difficulty,
      port: Number(port) !== config.port,
      defaultProviderId: defaultProviderId !== savedWorkspaceConfig.defaultProviderId,
      intervalMs: Number(intervalMs) !== savedWorkspaceConfig.intervalMs,
    });
  }, [
    serverName, seed, levelName, gameMode, difficulty, port, config,
    defaultProviderId, intervalMs, savedWorkspaceConfig
  ]);

  // Load workspace preferences on mount
  useEffect(() => {
    let active = true;
    const fetchWorkspace = async () => {
      try {
        const res = await fetch('/api/settings/workspace');
        if (res.ok && active) {
          const data = await res.json();
          if (data && data.config) {
            setDefaultProviderId(data.config.defaultProviderId || 'gemini');
            setIntervalMs(data.config.intervalMs || 8000);
            setSavedWorkspaceConfig({
              defaultProviderId: data.config.defaultProviderId || 'gemini',
              intervalMs: data.config.intervalMs || 8000,
            });
            setWorkspaceLastSavedAt(new Date().toISOString());
          }
        }
      } catch (err) {
        console.warn('Failed to load workspace preferences:', err);
      }
    };
    fetchWorkspace();
    return () => {
      active = false;
    };
  }, []);

  const handleStart = async () => {
    setStartError(null);
    try {
      await onStartServer(acceptEULA, useEmulator);
    } catch (err: any) {
      setStartError(err.message || 'Failed to start server.');
    }
  };

  const handleRunDiagnostic = async () => {
    setIsSmokeTesting(true);
    setSmokeTestResult(null);
    try {
      const res = await fetch('/api/test/protocol-mock-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName,
          levelName,
          seed,
          gameMode,
          difficulty,
          port,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSmokeTestResult(data);
      } else {
        const err = await res.json();
        setSmokeTestResult({ success: false, logs: [err.error || 'Diagnostic API failed.'] });
      }
    } catch (err: any) {
      setSmokeTestResult({ success: false, logs: [err.message || 'Network error executing diagnostic test.'] });
    } finally {
      setIsSmokeTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setServerSaveStatus('saving');
    setIsSaving(true);
    try {
      await onUpdateConfig({
        serverName,
        seed,
        levelName,
        gameMode,
        difficulty,
        port: Number(port),
      });
      setServerSaveStatus('saved');
      setServerLastSavedAt(new Date().toISOString());
    } catch (err: any) {
      setServerError(err.message || 'Failed to save server config.');
      setServerSaveStatus('failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkspaceError(null);
    setWorkspaceSaveStatus('saving');
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultProviderId,
          intervalMs,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save workspace settings.');
      }
      const data = await res.json();
      setSavedWorkspaceConfig({
        defaultProviderId: data.config.defaultProviderId,
        intervalMs: data.config.intervalMs,
      });
      setWorkspaceSaveStatus('saved');
      setWorkspaceLastSavedAt(new Date().toISOString());
    } catch (err: any) {
      setWorkspaceError(err.message || 'Failed to save workspace preferences.');
      setWorkspaceSaveStatus('failed');
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    onSendCommand(command);
    setCommand('');
  };

  const getStatusStyle = () => {
    switch (serverStatus) {
      case 'running': return 'bg-brand-green/10 text-brand-green border-brand-green/40';
      case 'starting': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse';
      case 'stopping': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'blocked': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'failed': return 'bg-red-500/15 text-red-500 border-red-500/40';
      default: return 'bg-brand-border text-brand-muted border-brand-border';
    }
  };

  return (
    <div id="server-config-card" className="bg-brand-aside border border-brand-border rounded-none p-4 shadow-none">
      {runtimeMode === 'simulation' && (
        <div className="mb-4 bg-orange-950/40 border border-orange-500/30 p-2.5 rounded-none text-[10px] font-mono text-orange-400 font-bold uppercase tracking-wide flex items-center gap-1.5 animate-pulse">
          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
          Simulation Mode — Not Live Ready
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-border pb-3 mb-4 gap-2">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-brand-green" />
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-muted font-bold">System Config // MC_SERVER</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Server Config Save-State Indicators */}
          {serverSaveStatus === 'saving' && (
            <span className="text-[9px] font-mono text-yellow-500 uppercase animate-pulse">Saving...</span>
          )}
          {serverSaveStatus === 'failed' && (
            <span className="text-[9px] font-mono text-red-500 uppercase font-bold">Save Failed</span>
          )}
          {serverSaveStatus === 'saved' && !hasUnsavedServerChanges && (
            <span className="text-[9px] font-mono text-brand-green uppercase font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
              Saved
            </span>
          )}
          {hasUnsavedServerChanges && serverSaveStatus !== 'saving' && (
            <span className="text-[9px] font-mono text-yellow-500 uppercase font-bold flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              Unsaved
            </span>
          )}
          {serverLastSavedAt && (
            <span className="text-[8px] font-mono text-brand-muted opacity-65">
              Last: {new Date(serverLastSavedAt).toLocaleTimeString()}
            </span>
          )}
          <div className="h-3 w-px bg-brand-border mx-1" />
          <div className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-none border ${getStatusStyle()} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              serverStatus === 'running' ? 'bg-brand-green' : 
              serverStatus === 'starting' ? 'bg-yellow-400' : 
              serverStatus === 'blocked' ? 'bg-orange-400' :
              serverStatus === 'failed' ? 'bg-red-500' :
              'bg-brand-muted'
            }`} />
            {serverStatus.toUpperCase()}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
            <span>Server Name</span>
            {dirtyFields['serverName'] && (
              <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
            )}
          </label>
          <input
            type="text"
            className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors disabled:opacity-40"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            disabled={serverStatus !== 'stopped'}
          />
        </div>
        <div>
          <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
            <span>World Seed</span>
            {dirtyFields['seed'] && (
              <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
            )}
          </label>
          <input
            type="text"
            className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors disabled:opacity-40"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            disabled={serverStatus !== 'stopped'}
          />
        </div>
        <div>
          <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
            <span>Level Name</span>
            {dirtyFields['levelName'] && (
              <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
            )}
          </label>
          <input
            type="text"
            className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors disabled:opacity-40"
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            disabled={serverStatus !== 'stopped'}
          />
        </div>
        <div>
          <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
            <span>Server Port</span>
            {dirtyFields['port'] && (
              <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
            )}
          </label>
          <input
            type="number"
            className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors disabled:opacity-40"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            disabled={serverStatus !== 'stopped'}
          />
        </div>
        <div>
          <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
            <span>Game Mode</span>
            {dirtyFields['gameMode'] && (
              <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
            )}
          </label>
          <select
            className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors disabled:opacity-40"
            value={gameMode}
            onChange={(e) => setGameMode(e.target.value as GameMode)}
            disabled={serverStatus !== 'stopped'}
          >
            <option value={GameMode.SURVIVAL}>Survival</option>
            <option value={GameMode.CREATIVE}>Creative</option>
            <option value={GameMode.ADVENTURE}>Adventure</option>
            <option value={GameMode.SPECTATOR}>Spectator</option>
          </select>
        </div>
        <div>
          <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
            <span>Difficulty</span>
            {dirtyFields['difficulty'] && (
              <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
            )}
          </label>
          <select
            className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors disabled:opacity-40"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            disabled={serverStatus !== 'stopped'}
          >
            <option value={Difficulty.PEACEFUL}>Peaceful</option>
            <option value={Difficulty.EASY}>Easy</option>
            <option value={Difficulty.NORMAL}>Normal</option>
            <option value={Difficulty.HARD}>Hard</option>
          </select>
        </div>

        {serverStatus === 'stopped' && (
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="text-[11px] font-mono font-bold uppercase px-3 py-1.5 rounded-none bg-brand-border-light text-brand-text border border-brand-border hover:bg-brand-border transition-colors"
            >
              {isSaving ? 'Applying...' : 'Apply Config & Seed'}
            </button>
          </div>
        )}
      </form>

      {/* Workspace Preferences Section */}
      <div id="workspace-preferences-section" className="mt-6 border-t border-brand-border pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-green" />
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-brand-muted font-bold">Workspace Preferences</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            {workspaceSaveStatus === 'saving' && (
              <span className="text-[9px] font-mono text-yellow-500 uppercase animate-pulse">Saving...</span>
            )}
            {workspaceSaveStatus === 'failed' && (
              <span className="text-[9px] font-mono text-red-500 uppercase font-bold">Save Failed</span>
            )}
            {workspaceSaveStatus === 'saved' && !hasUnsavedWorkspaceChanges && (
              <span className="text-[9px] font-mono text-brand-green uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                Saved
              </span>
            )}
            {hasUnsavedWorkspaceChanges && workspaceSaveStatus !== 'saving' && (
              <span className="text-[9px] font-mono text-yellow-500 uppercase font-bold flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                Unsaved
              </span>
            )}
            {workspaceLastSavedAt && (
              <span className="text-[8px] font-mono text-brand-muted opacity-65">
                Last: {new Date(workspaceLastSavedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveWorkspace} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
              <span>Default AI Provider</span>
              {dirtyFields['defaultProviderId'] && (
                <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
              )}
            </label>
            <select
              className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors"
              value={defaultProviderId}
              onChange={(e) => setDefaultProviderId(e.target.value)}
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI GPT</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="lmstudio">LM Studio (Local)</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] text-brand-muted uppercase mb-1 italic font-mono flex items-center justify-between">
              <span>Step Loop Interval (ms)</span>
              {dirtyFields['intervalMs'] && (
                <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">● Unsaved</span>
              )}
            </label>
            <input
              type="number"
              min={1000}
              max={60000}
              className="w-full text-xs font-mono bg-brand-card border border-brand-border rounded-none px-3 py-1.5 text-brand-text focus:outline-none focus:border-brand-green transition-colors"
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-2 flex justify-between items-center mt-1">
            <span className="text-[9px] font-mono text-brand-muted italic">
              * Controls prompt loop delays & default active providers.
            </span>
            <button
              type="submit"
              disabled={workspaceSaveStatus === 'saving'}
              className="text-[11px] font-mono font-bold uppercase px-3 py-1.5 rounded-none bg-brand-border-light text-brand-text border border-brand-border hover:bg-brand-border transition-colors disabled:opacity-50"
            >
              {workspaceSaveStatus === 'saving' ? 'Saving Workspace...' : 'Save Workspace'}
            </button>
          </div>
        </form>
        {workspaceError && (
          <div className="mt-3 bg-red-950/40 border border-red-500/30 p-2 text-[9px] font-mono text-red-400">
            {workspaceError}
          </div>
        )}
      </div>

      {/* EULA Acceptance & Sandbox Emulator */}
      {serverStatus === 'stopped' && (
        <div className="mt-4 border-t border-brand-border pt-4 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-green bg-brand-bg border border-brand-border rounded-none h-3.5 w-3.5 shrink-0"
              checked={acceptEULA}
              onChange={(e) => setAcceptEULA(e.target.checked)}
            />
            <span className="text-[10px] font-mono text-brand-text leading-tight">
              I accept the <a href="https://www.minecraft.net/eula" target="_blank" rel="noopener noreferrer" className="text-brand-green underline hover:text-brand-text">Minecraft EULA</a>. Required to launch a real server.
            </span>
          </label>

          {allowSimulationMode ? (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 accent-brand-green bg-brand-bg border border-brand-border rounded-none h-3.5 w-3.5 shrink-0"
                checked={useEmulator}
                onChange={(e) => setUseEmulator(e.target.checked)}
              />
              <span className="text-[10px] font-mono text-brand-text leading-tight text-orange-400">
                Use Sandbox Emulator. Bypasses Java/server.jar check & runs local simulation (Simulation Mode — Not Live Ready).
              </span>
            </label>
          ) : (
            <div className="text-[9px] font-mono text-brand-muted italic uppercase border border-brand-border bg-brand-card p-2">
              * Sandbox Emulator is locked (Requires <strong className="text-orange-400">ALLOW_SIMULATION_MODE=true</strong> in environment)
            </div>
          )}
        </div>
      )}

      {startError && (
        <div className="mt-3 bg-red-950/40 border border-red-500/30 p-2.5 rounded-none text-[10px] font-mono text-red-400 leading-relaxed">
          <div className="font-bold uppercase flex items-center gap-1.5 mb-1 text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            Startup Blocked
          </div>
          {startError}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3 mt-4 border-t border-brand-border pt-4">
        {serverStatus === 'stopped' ? (
          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-none bg-brand-green hover:opacity-90 text-brand-bg font-mono font-bold text-xs uppercase transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-brand-bg" /> Start Minecraft Server
          </button>
        ) : (
          <button
            onClick={onStopServer}
            disabled={serverStatus === 'stopping'}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-none bg-red-600 hover:bg-red-700 text-brand-text font-mono font-bold text-xs uppercase transition-all disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5 fill-brand-text" /> Stop Server Cleanly
          </button>
        )}
      </div>

      {serverStatus === 'running' && (
        <div className="mt-4 border-t border-brand-border pt-4">
          <div className="flex items-center gap-1.5 text-[10px] text-brand-muted mb-2 font-mono uppercase">
            <Radio className="w-3.5 h-3.5 text-brand-green animate-pulse" />
            <span>Runtime: <strong className="text-brand-green">{runtimeMode.toUpperCase()}</strong></span>
          </div>
          
          <form onSubmit={handleCommandSubmit} className="flex gap-2">
            <div className="relative flex-grow">
              <Terminal className="w-3.5 h-3.5 text-brand-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Send terminal command (e.g. /say Hello)..."
                className="w-full text-xs bg-brand-card border border-brand-border rounded-none pl-9 pr-3 py-2 text-brand-text focus:outline-none focus:border-brand-green font-mono"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="text-xs bg-brand-border-light border border-brand-border hover:bg-brand-border px-4 py-2 text-brand-text rounded-none font-mono font-bold uppercase transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Protocol Mock Diagnostic Section */}
      <div className="mt-4 border-t border-brand-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[10px] text-brand-muted font-mono uppercase">
            <Activity className="w-3.5 h-3.5 text-brand-green" />
            <span>Protocol Mock Diagnostic</span>
          </div>
          <span className="text-[9px] font-mono text-brand-muted border border-brand-border px-1 uppercase">Evidence: protocol-mock</span>
        </div>
        
        <p className="text-[10px] text-brand-muted mb-3 font-mono leading-relaxed">
          Launches a lightweight TCP socket server on port {port} & connects a mock Mineflayer client to verify server lifecycle, socket bindings, and Minecraft packet handshaking.
        </p>

        <button
          type="button"
          disabled={isSmokeTesting || serverStatus !== 'stopped'}
          onClick={handleRunDiagnostic}
          className={`w-full py-1.5 px-3 font-mono text-[10px] font-bold uppercase tracking-wider border rounded-none flex items-center justify-center gap-2 transition-all ${
            serverStatus !== 'stopped'
              ? 'bg-brand-border text-brand-muted border-brand-border cursor-not-allowed opacity-40'
              : 'bg-brand-border-light text-brand-text border-brand-border hover:bg-brand-border'
          }`}
        >
          {isSmokeTesting ? (
            <>
              <div className="w-2.5 h-2.5 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div>
              Executing Diagnostic Handshake...
            </>
          ) : (
            'Execute Protocol Mock Diagnostic'
          )}
        </button>

        {serverStatus !== 'stopped' && (
          <p className="text-[9px] text-yellow-500/80 font-mono mt-1 italic">
            * Server must be STOPPED to bind diagnostic port {port} for testing.
          </p>
        )}

        {smokeTestResult && (
          <div className="mt-3 border border-brand-border bg-brand-card p-3">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-brand-border">
              <span className="text-[10px] font-mono uppercase font-bold text-brand-muted">Handshake Diagnostics</span>
              <span className={`text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${smokeTestResult.success ? 'text-brand-green' : 'text-red-500'}`}>
                {smokeTestResult.success ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-brand-green animate-pulse" /> Success
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-bounce" /> Failed
                  </>
                )}
              </span>
            </div>
            
            <div className="max-h-40 overflow-y-auto font-mono text-[9px] text-brand-muted space-y-1 scrollbar-thin scrollbar-thumb-brand-border">
              {smokeTestResult.logs.map((log, idx) => (
                <div key={idx} className={`leading-relaxed border-l-2 pl-2 ${
                  log.includes('SUCCESSFUL') || log.includes('Success') 
                    ? 'border-brand-green text-brand-text font-bold' 
                    : log.includes('Error') || log.includes('Failed')
                    ? 'border-red-500 text-red-400'
                    : 'border-brand-border'
                }`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

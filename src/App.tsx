import { useState, useEffect } from 'react';
import { ServerConfigCard } from './components/ServerConfigCard.tsx';
import { ScenarioCard } from './components/ScenarioCard.tsx';
import { ProvidersCard } from './components/ProvidersCard.tsx';
import { LiveMonitor } from './components/LiveMonitor.tsx';
import { WorldGridVisualizer } from './components/WorldGridVisualizer.tsx';
import { RunHistory } from './components/RunHistory.tsx';
import { SimulationState, Scenario, BotConfig, EventLog, LLMProviderConfig, LLMProviderType } from './types/index.ts';
import { ShieldCheck, Server, Play, History, Compass, Info, Cpu, Layers } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<SimulationState>({
    serverStatus: 'stopped',
    runtimeMode: 'node-emulator',
    serverConfig: {
      serverName: 'MISSI-Server',
      levelName: 'world',
      seed: '123456789',
      gameMode: 'survival' as any,
      difficulty: 'normal' as any,
      port: 25565,
      properties: {},
    },
    bots: [],
    logs: [],
    worldGrid: [],
  });

  const [providers, setProviders] = useState<(LLMProviderConfig & { isConfigured: boolean })[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'map' | 'history'>('monitor');
  const [isLoading, setIsLoading] = useState(true);

  // Poll server state every 2 seconds to keep dashboard fully live
  const pollStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('API offline');
      const data = await res.json();
      
      const worldRes = await fetch('/api/world');
      const worldData = await worldRes.json();

      const logsRes = await fetch('/api/simulation/logs');
      const logsData = await logsRes.json();

      setState((prev) => ({
        ...prev,
        serverStatus: data.serverStatus,
        runtimeMode: data.runtimeMode,
        serverConfig: data.serverConfig,
        bots: data.bots,
        worldGrid: worldData.worldGrid || [],
        logs: logsData.logs || [],
        activeScenario: data.activeScenario,
      }));
    } catch (err) {
      console.warn('Polling error:', err);
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
      }
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([pollStatus(), fetchProviders()]);
      setIsLoading(false);
    };
    init();

    const interval = setInterval(pollStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS HANDLERS ---

  const handleUpdateConfig = async (newConfig: Partial<any>) => {
    try {
      const res = await fetch('/api/server/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        await pollStatus();
      }
    } catch (err) {
      console.error('Failed to save server config:', err);
    }
  };

  const handleStartServer = async (acceptEULA: boolean = false, useEmulator: boolean = false) => {
    try {
      const res = await fetch('/api/server/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptEULA, useEmulator }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Server startup failed.');
      }
      await pollStatus();
    } catch (err: any) {
      console.error('Failed to start server:', err);
      throw err;
    }
  };

  const handleStopServer = async () => {
    try {
      await fetch('/api/server/stop', { method: 'POST' });
      await pollStatus();
    } catch (err) {
      console.error('Failed to stop server:', err);
    }
  };

  const handleSendCommand = async (command: string) => {
    try {
      await fetch('/api/server/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      await pollStatus();
    } catch (err) {
      console.error('Failed to execute command:', err);
    }
  };

  const handleParseScenario = async (markdown: string): Promise<Scenario | null> => {
    const res = await fetch('/api/scenario/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to parse scenario.');
    }
    const data = await res.json();
    return data.scenario;
  };

  const handleSpawnBots = async (scenario: Scenario) => {
    const res = await fetch('/api/simulation/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to spawn bots.');
    }
    await pollStatus();
  };

  const handleStartSimulation = async () => {
    try {
      await fetch('/api/simulation/start', { method: 'POST' });
      await pollStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopSimulation = async () => {
    try {
      await fetch('/api/simulation/stop', { method: 'POST' });
      await pollStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepManual = async () => {
    try {
      await fetch('/api/simulation/step', { method: 'POST' });
      await pollStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadHistoryList = async () => {
    const res = await fetch('/api/simulation/runs');
    if (!res.ok) return [];
    const data = await res.json();
    return data.runs;
  };

  const handleLoadRunDetails = async (id: string) => {
    const res = await fetch(`/api/simulation/runs/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.run;
  };

  const handleUpdateProvider = async (config: {
    id: string;
    type: LLMProviderType;
    apiKey: string;
    customUrl?: string;
    defaultModel?: string;
  }) => {
    const res = await fetch('/api/provider/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      throw new Error('Failed to update provider keys.');
    }
    await fetchProviders();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col items-center justify-center font-mono text-xs gap-3">
        <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div>
        <span className="tracking-widest uppercase text-brand-green">Initializing MISSI Control Systems...</span>
      </div>
    );
  }

  const isServerRunning = state.serverStatus === 'running';

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col font-sans selection:bg-brand-green selection:text-brand-bg">
      {/* Top Main Navigation Header Bar */}
      <header className="h-14 border-b border-brand-border bg-brand-panel flex items-center justify-between px-6 shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] ${
              state.serverStatus === 'running' 
                ? 'bg-brand-green text-brand-green' 
                : state.serverStatus === 'starting' 
                ? 'bg-yellow-500 text-yellow-500 animate-pulse' 
                : 'bg-red-500 text-red-500'
            }`}></div>
            <span className={`font-mono text-[10px] uppercase tracking-widest ${
              state.serverStatus === 'running' 
                ? 'text-brand-green' 
                : state.serverStatus === 'starting' 
                ? 'text-yellow-500' 
                : 'text-brand-muted'
            }`}>
              {state.serverStatus === 'running' ? 'System Online' : `Server: ${state.serverStatus}`}
            </span>
          </div>
          <div className="h-4 w-px bg-brand-border"></div>
          <h1 className="text-sm font-bold tracking-tighter uppercase font-mono">
            <span className="opacity-50">MISSI //</span> Minecraft Scenario Simulator
          </h1>
        </div>

        {/* Global indicators */}
        <div className="flex items-center gap-6">
          <div className="text-[10px] font-mono text-brand-muted text-right leading-tight hidden md:block">
            <span className="opacity-40">SESSION_ID:</span> 0x82FA91<br/>
            <span className="opacity-40">TIME:</span> {new Date().toLocaleTimeString()}
          </div>
          <div className="h-4 w-px bg-brand-border hidden md:block"></div>
          <div className="flex items-center gap-2">
            {state.serverStatus === 'stopped' ? (
              <button
                onClick={handleStartServer}
                className="bg-brand-green text-brand-bg text-[11px] px-3 py-1 font-bold uppercase tracking-wider rounded-none hover:opacity-90 transition-opacity"
              >
                Launch Server
              </button>
            ) : (
              <button
                onClick={handleStopServer}
                disabled={state.serverStatus === 'stopping'}
                className="bg-red-600 text-brand-text text-[11px] px-3 py-1 font-bold uppercase tracking-wider rounded-none hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Stop Server
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-grow p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mx-auto max-w-[1600px]">
        {/* Left Column (Grid width 5): Configurations, Scenario, Providers */}
        <section className="lg:col-span-5 space-y-6 flex flex-col">
          <ServerConfigCard
            serverStatus={state.serverStatus}
            runtimeMode={state.runtimeMode}
            config={state.serverConfig}
            onUpdateConfig={handleUpdateConfig}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onSendCommand={handleSendCommand}
          />

          <ScenarioCard
            onParseScenario={handleParseScenario}
            onSpawnBots={handleSpawnBots}
            serverStatus={state.serverStatus}
            activeScenario={state.activeScenario}
            onApplyWorldConfig={handleUpdateConfig}
          />

          <ProvidersCard
            providers={providers}
            onUpdateProvider={handleUpdateProvider}
          />
        </section>

        {/* Right Column (Grid width 7): Live View / Map / HistoryTabs */}
        <section className="lg:col-span-7 flex flex-col space-y-6">
          {/* Visual Tabs Navigation */}
          <div className="flex border border-brand-border bg-brand-panel p-1 rounded-none">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 py-2 px-5 text-xs font-mono font-bold tracking-wider uppercase rounded-none transition-all ${
                activeTab === 'monitor'
                  ? 'bg-brand-border-light text-brand-text border border-brand-border'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <Play className="w-3.5 h-3.5" /> 01 // Active Monitor
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 py-2 px-5 text-xs font-mono font-bold tracking-wider uppercase rounded-none transition-all ${
                activeTab === 'map'
                  ? 'bg-brand-border-light text-brand-text border border-brand-border'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> 02 // Spatial Map
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 py-2 px-5 text-xs font-mono font-bold tracking-wider uppercase rounded-none transition-all ${
                activeTab === 'history'
                  ? 'bg-brand-border-light text-brand-text border border-brand-border'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <History className="w-3.5 h-3.5" /> 03 // Audit Logs
            </button>
          </div>

          {/* Active Tab Viewport */}
          <div className="flex-grow">
            {activeTab === 'monitor' && (
              <LiveMonitor
                isSimulating={state.logs.some(l => l.type === 'system' && l.message.includes('loop started')) && !state.logs.some(l => l.type === 'system' && l.message.includes('stopped manually'))}
                currentStep={state.bots.length > 0 ? Math.max(1, Math.floor(state.logs.filter(l => l.message.includes('--- Simulation Step #')).length)) : 0}
                activeScenario={state.activeScenario}
                bots={state.bots}
                logs={state.logs}
                onStartSimulation={handleStartSimulation}
                onStopSimulation={handleStopSimulation}
                onStepManual={handleStepManual}
              />
            )}

            {activeTab === 'map' && (
              <WorldGridVisualizer
                worldGrid={state.worldGrid}
                bots={state.bots}
              />
            )}

            {activeTab === 'history' && (
              <RunHistory
                onLoadHistoryList={handleLoadHistoryList}
                onLoadRunDetails={handleLoadRunDetails}
              />
            )}
          </div>
        </section>
      </main>

      {/* Footer System Metrics Bar */}
      <footer className="h-10 border-t border-brand-border bg-brand-panel px-6 flex items-center justify-between text-[10px] font-mono text-brand-muted tracking-wider mt-auto shrink-0">
        <div>CORE: Mindcraft-Develop v3.1 | MINEFLAYER: 4.15.0</div>
        <div className="hidden sm:block">COORDINATION: team_bulletin_shared_context</div>
        <div>BUILD: 2026.FINAL_RELEASE</div>
      </footer>
    </div>
  );
}

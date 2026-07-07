import React, { useEffect, useRef } from 'react';
import { BotConfig, EventLog, EventType, Scenario } from '../types/index.js';
import { Play, Pause, Square, ChevronRight, Activity, Terminal, ShieldAlert, Heart, User, Sparkles } from 'lucide-react';

interface LiveMonitorProps {
  isSimulating: boolean;
  currentStep: number;
  activeScenario?: Scenario;
  bots: BotConfig[];
  logs: EventLog[];
  onStartSimulation: () => Promise<void>;
  onStopSimulation: () => Promise<void>;
  onStepManual: () => Promise<void>;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  isSimulating,
  currentStep,
  activeScenario,
  bots,
  logs,
  onStartSimulation,
  onStopSimulation,
  onStepManual,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll logs to bottom
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogStyle = (type: EventType) => {
    switch (type) {
      case EventType.BOT_THINK: return 'text-purple-400 font-bold';
      case EventType.BOT_ACTION: return 'text-amber-300 font-bold';
      case EventType.BOT_CHAT: return 'text-brand-green italic';
      case EventType.LLM_CALL: return 'text-blue-300 text-[10px]';
      case EventType.SERVER_START:
      case EventType.SERVER_STOP: return 'text-blue-400 font-bold';
      case EventType.SYSTEM: return 'text-brand-muted font-mono text-[10px]';
      case EventType.ERROR: return 'text-red-400 font-bold border-l border-red-500 pl-2 bg-red-500/5 py-0.5';
      default: return 'text-brand-text';
    }
  };

  const getLogTag = (type: EventType) => {
    switch (type) {
      case EventType.BOT_THINK: return 'THINK';
      case EventType.BOT_ACTION: return 'ACTION';
      case EventType.BOT_CHAT: return 'CHAT';
      case EventType.LLM_CALL: return 'API';
      case EventType.SERVER_START: return 'START';
      case EventType.SERVER_STOP: return 'STOP';
      case EventType.SYSTEM: return 'SYS';
      case EventType.ERROR: return 'ERR';
      default: return 'INFO';
    }
  };

  const getLogTagColor = (type: EventType) => {
    switch (type) {
      case EventType.BOT_THINK: return 'bg-purple-950/40 text-purple-300 border-purple-800/40';
      case EventType.BOT_ACTION: return 'bg-amber-950/40 text-amber-300 border-amber-800/40';
      case EventType.BOT_CHAT: return 'bg-brand-green/10 text-brand-green border-brand-green/30';
      case EventType.LLM_CALL: return 'bg-blue-950/40 text-blue-300 border-blue-800/40';
      case EventType.ERROR: return 'bg-red-950/40 text-red-300 border-red-800/40';
      default: return 'bg-brand-panel text-brand-muted border-brand-border';
    }
  };

  return (
    <div id="live-monitor" className="bg-brand-aside border border-brand-border rounded-none p-4 shadow-none flex flex-col h-full">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-brand-border pb-3 mb-4 gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-green animate-pulse" />
          <div>
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-muted font-bold">Autonomy Thread // ACTIVE_MONITOR</h2>
            {activeScenario && (
              <span className="text-[10px] text-brand-text font-mono block">Scenario: <strong>{activeScenario.title}</strong></span>
            )}
          </div>
        </div>

        {/* Action button rows */}
        <div className="flex items-center gap-2 w-full sm:w-auto font-mono">
          {isSimulating ? (
            <button
              onClick={onStopSimulation}
              className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase px-3 py-1.5 bg-red-600 hover:bg-red-700 text-brand-text border border-brand-border rounded-none transition-colors"
            >
              <Pause className="w-3.5 h-3.5 fill-brand-text" /> Pause Loop
            </button>
          ) : (
            <>
              <button
                onClick={onStartSimulation}
                disabled={bots.length === 0}
                className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase px-3 py-1.5 bg-brand-green text-brand-bg rounded-none hover:opacity-90 transition-all disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-brand-bg" /> Start Loop
              </button>
              <button
                onClick={onStepManual}
                disabled={bots.length === 0}
                className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase px-3 py-1.5 bg-brand-border-light border border-brand-border text-brand-text rounded-none hover:bg-brand-border transition-colors disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5 text-brand-green" /> Step Manual
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow">
        {/* Left Column: Objectives & Bot Vitals */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          {/* Scenario Objectives */}
          {activeScenario && (
            <div className="bg-brand-bg border border-brand-border rounded-none p-3.5">
              <h3 className="text-[10px] font-mono font-bold text-brand-green uppercase tracking-widest mb-2.5 block">// MISSION OBJECTIVES</h3>
              <div className="space-y-2">
                {activeScenario.objectives.map((obj, i) => {
                  const isHarvested = bots.some(b => b.inventory['oak_log'] && b.inventory['oak_log'] >= 1) && obj.includes('logs');
                  const isPlanks = bots.some(b => b.inventory['oak_planks'] && b.inventory['oak_planks'] >= 1) && obj.includes('Planks');
                  const isCrafted = bots.some(b => b.inventory['crafting_table'] && b.inventory['crafting_table'] >= 1) && obj.includes('Table');
                  const completed = isHarvested || isPlanks || isCrafted || currentStep > 3;

                  return (
                    <div key={i} className="flex items-start gap-2.5 text-xs font-mono">
                      <input
                        type="checkbox"
                        checked={!!completed}
                        readOnly
                        className="mt-0.5 w-3 h-3 rounded-none border-brand-border text-brand-green bg-brand-bg focus:ring-0 cursor-default"
                      />
                      <span className={completed ? 'text-brand-muted line-through opacity-60' : 'text-brand-text'}>{obj}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vitals of bots */}
          <div className="bg-brand-bg border border-brand-border rounded-none p-3.5 flex-grow overflow-y-auto max-h-[300px] lg:max-h-[380px]">
            <h3 className="text-[10px] font-mono font-bold text-brand-green uppercase tracking-widest mb-2.5 block">// ACTIVE LIFEFORMS</h3>
            
            {bots.length > 0 ? (
              <div className="space-y-4">
                {bots.map((bot) => (
                  <div key={bot.id} className="border-b border-brand-border pb-3 last:border-b-0 last:pb-0 font-mono">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-brand-green" />
                        <span className="text-xs font-bold text-brand-text">{bot.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-brand-muted">
                        [{bot.x}, {bot.y}, {bot.z}]
                      </span>
                    </div>
                    <div className="text-[9px] text-brand-muted mb-2 italic uppercase">ROLE: {bot.role}</div>

                    {/* Vitals metrics */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="flex items-center gap-1 bg-brand-panel border border-brand-border/60 px-2 py-0.5 rounded-none">
                        <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                        <span className="text-[9px] font-mono text-brand-text font-bold">{bot.health}/20 HP</span>
                      </div>
                      <div className="flex items-center gap-1 bg-brand-panel border border-brand-border/60 px-2 py-0.5 rounded-none">
                        <Sparkles className="w-3 h-3 text-brand-green" />
                        <span className="text-[9px] font-mono text-brand-text font-bold">{bot.food}/20 F</span>
                      </div>
                    </div>

                    {/* Inventory list */}
                    <div>
                      <span className="text-[9px] text-brand-muted block font-mono uppercase mb-1">INVENTORY_CONTENTS:</span>
                      {Object.keys(bot.inventory).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(bot.inventory).map(([item, count]) => (
                            <span key={item} className="text-[9px] bg-brand-panel border border-brand-border text-brand-green px-1.5 py-0.5 rounded-none font-mono font-bold">
                              {item}:{count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-brand-muted italic">EMPTY</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 text-brand-muted italic text-xs font-mono uppercase">
                No active entities spawned.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Event Terminal */}
        <div className="lg:col-span-2 flex flex-col bg-brand-bg border border-brand-border rounded-none overflow-hidden h-[300px] lg:h-auto min-h-[400px]">
          {/* Bar top */}
          <div className="bg-brand-panel border-b border-brand-border px-4 py-2 flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-brand-green" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Telemetry Event Logs</span>
            </div>
            <span className="text-[10px] font-bold text-brand-green">CYCLE: {currentStep}</span>
          </div>

          {/* Console logger output */}
          <div className="flex-grow p-4 overflow-y-auto font-mono text-[11px] space-y-1.5 max-h-[450px] bg-brand-bg">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-[9px] text-brand-muted select-none shrink-0 mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`text-[9px] font-bold border rounded-none px-1 shrink-0 ${getLogTagColor(log.type)}`}>
                    {getLogTag(log.type)}
                  </span>
                  {log.botName && (
                    <span className="text-purple-400 font-bold shrink-0">
                      [{log.botName}]
                    </span>
                  )}
                  <span className={`${getLogStyle(log.type)} whitespace-pre-wrap break-all`}>
                    {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-brand-muted italic text-center py-20 uppercase font-mono">
                <Terminal className="w-6 h-6 text-brand-border mb-2" />
                <span>Await event triggers...</span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { Scenario } from '../types/index.js';
import { DEFAULT_SCENARIOS } from '../data/scenarios.js';
import { FileCode, AlertCircle, Sparkles, ChevronDown, Upload } from 'lucide-react';

interface ScenarioCardProps {
  onParseScenario: (markdown: string) => Promise<Scenario | null>;
  onSpawnBots: (scenario: Scenario) => Promise<void>;
  serverStatus: 'stopped' | 'starting' | 'running' | 'stopping';
  activeScenario?: Scenario;
  onApplyWorldConfig?: (config: any) => Promise<void>;
  markdown: string;
  setMarkdown: React.Dispatch<React.SetStateAction<string>>;
  onSaveBotToLibrary?: (bot: any) => Promise<void>;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({
  onParseScenario,
  onSpawnBots,
  serverStatus,
  activeScenario,
  onApplyWorldConfig,
  markdown,
  setMarkdown,
  onSaveBotToLibrary,
}) => {
  const [parsedScenario, setParsedScenario] = useState<Scenario | null>(activeScenario || null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParseScenario = async (content: string) => {
    setError(null);
    setIsParsing(true);
    try {
      const scenario = await onParseScenario(content);
      if (scenario) {
        setParsedScenario(scenario);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse scenario markdown.');
      setParsedScenario(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const content = event.target.result as string;
          setMarkdown(content);
          setError(null);
          setIsParsing(true);
          try {
            const scenario = await onParseScenario(content);
            if (scenario) {
              setParsedScenario(scenario);
            }
          } catch (err: any) {
            setError(err.message || 'Failed to parse scenario markdown.');
            setParsedScenario(null);
          } finally {
            setIsParsing(false);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const content = event.target.result as string;
          setMarkdown(content);
          setError(null);
          setIsParsing(true);
          try {
            const scenario = await onParseScenario(content);
            if (scenario) {
              setParsedScenario(scenario);
            }
          } catch (err: any) {
            setError(err.message || 'Failed to parse scenario markdown.');
            setParsedScenario(null);
          } finally {
            setIsParsing(false);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePresetSelect = (presetMarkdown: string) => {
    setMarkdown(presetMarkdown);
    setShowPresets(false);
    setError(null);
  };

  const handleSpawn = async () => {
    if (!parsedScenario) return;
    setIsSpawning(true);
    setError(null);
    try {
      await onSpawnBots(parsedScenario);
    } catch (err: any) {
      setError(err.message || 'Failed to spawn bots.');
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div id="scenario-card" className="bg-brand-aside border border-brand-border rounded-none p-4 shadow-none flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-brand-green" />
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-muted font-bold font-mono">Scenario Setup // PARSER</h2>
        </div>

        {/* Presets Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase font-bold rounded-none border border-brand-border hover:bg-brand-row text-brand-text transition-colors"
          >
            Presets Templates <ChevronDown className="w-3.5 h-3.5 text-brand-muted" />
          </button>
          {showPresets && (
            <div className="absolute right-0 mt-1 w-64 bg-brand-panel border border-brand-border rounded-none shadow-2xl z-50 py-1">
              {DEFAULT_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.title}
                  onClick={() => handlePresetSelect(scenario.markdown)}
                  className="w-full text-left px-3 py-2 text-xs text-brand-text hover:bg-brand-row transition-colors border-b border-brand-border/40 last:border-0"
                >
                  <div className="font-mono font-bold text-[11px] text-brand-green">{scenario.title}</div>
                  <div className="text-brand-muted truncate text-[9px] font-mono">{scenario.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-grow">
        {/* Editor Area */}
        <div 
          className="flex flex-col h-full min-h-[300px]"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col gap-1.5 mb-2.5">
            <label className="block text-[9px] text-brand-muted uppercase font-mono italic">Scenario Markdown Source</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex flex-col items-center justify-center border border-dashed border-brand-border hover:border-brand-green bg-brand-panel hover:bg-brand-row/50 p-4 rounded-none cursor-pointer text-center transition-all duration-200"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".md,.txt"
                className="hidden"
              />
              <Upload className="w-5 h-5 text-brand-muted group-hover:text-brand-green mb-1.5 group-hover:scale-110 transition-all duration-200" />
              <div className="text-[10px] font-mono font-bold text-brand-text uppercase tracking-wider mb-0.5">
                Drag & Drop Scenario File
              </div>
              <div className="text-[9px] font-mono text-brand-muted">
                or click to browse (.md, .txt)
              </div>
            </div>
          </div>
          <div className="relative flex-grow flex flex-col">
            <textarea
              className={`w-full flex-grow text-xs font-mono bg-brand-bg border rounded-none p-3 text-brand-text focus:outline-none focus:border-brand-green resize-none h-[280px] transition-colors ${
                isDragging ? 'border-brand-green bg-brand-green/5' : 'border-brand-border'
              }`}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="# Scenario: My Adventure..."
            />
            {isDragging && (
              <div className="absolute inset-0 bg-brand-bg/85 border-2 border-dashed border-brand-green flex flex-col items-center justify-center text-brand-green pointer-events-none">
                <Upload className="w-8 h-8 animate-bounce mb-2" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Drop scenario file here</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => handleParseScenario(markdown)}
              disabled={isParsing}
              className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase px-3 py-1.5 rounded-none bg-brand-border-light text-brand-text border border-brand-border hover:bg-brand-border transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-green" />
              {isParsing ? 'Parsing...' : 'Parse Source'}
            </button>
          </div>
        </div>

        {/* Parsed & Validated Results Area */}
        <div className="bg-brand-bg border border-brand-border rounded-none p-4 flex flex-col justify-between h-full overflow-y-auto">
          {parsedScenario ? (
            <div className="space-y-4">
              <div>
                <span className="text-[9px] text-brand-green font-mono font-bold tracking-widest block mb-0.5">SCENARIO TITLE</span>
                <h3 className="text-xs font-mono font-bold text-brand-text">{parsedScenario.title}</h3>
                <p className="text-[11px] text-brand-muted mt-1 italic">{parsedScenario.description}</p>
              </div>

              <div>
                <span className="text-[9px] text-brand-green font-mono font-bold tracking-widest block mb-1">OBJECTIVES</span>
                <ul className="space-y-1">
                  {parsedScenario.objectives.map((obj, idx) => (
                    <li key={idx} className="text-xs text-brand-text font-mono flex items-start gap-1.5">
                      <span className="text-brand-green font-bold">//</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-[9px] text-brand-green font-mono font-bold tracking-widest block mb-1">BOT SWARM REGISTRY ({parsedScenario.bots.length})</span>
                <div className="border border-brand-border rounded-none overflow-hidden bg-brand-panel">
                  <table className="w-full text-left text-[10px] text-brand-text font-mono">
                    <thead className="bg-brand-row border-b border-brand-border text-brand-muted">
                      <tr>
                        <th className="p-2 text-[9px] font-bold uppercase">Name</th>
                        <th className="p-2 text-[9px] font-bold uppercase">Role</th>
                        <th className="p-2 text-[9px] font-bold uppercase">Model</th>
                        <th className="p-2 text-[9px] font-bold uppercase text-right">Spawn / Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border/30">
                      {parsedScenario.bots.map((bot) => (
                        <tr key={bot.id} className="hover:bg-brand-row">
                          <td className="p-2 font-bold text-brand-green">{bot.name}</td>
                          <td className="p-2 truncate max-w-[100px] text-brand-text">{bot.role}</td>
                          <td className="p-2 text-brand-muted">{bot.model}</td>
                          <td className="p-2 text-right">
                            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1 sm:gap-2">
                              {onSaveBotToLibrary && (
                                <button
                                  onClick={() => onSaveBotToLibrary(bot)}
                                  className="text-[9px] text-brand-green hover:underline font-bold uppercase tracking-tight"
                                  title="Save this agent config to your Bot Profile Library"
                                >
                                  Save Profile
                                </button>
                              )}
                              <span className="text-brand-muted text-[9px]">
                                [{bot.x},{bot.y},{bot.z}]
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedScenario.worldConfig && (
                <div className="bg-brand-panel border border-brand-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-brand-green font-mono font-bold tracking-widest uppercase">Detected World Settings</span>
                    <span className="text-[9px] font-mono text-brand-muted border border-brand-border px-1">AUTO-PARSED</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-brand-muted">
                    {parsedScenario.worldConfig.seed && <div>Seed: <strong className="text-brand-text">{parsedScenario.worldConfig.seed}</strong></div>}
                    {parsedScenario.worldConfig.gameMode && <div>Mode: <strong className="text-brand-text uppercase">{parsedScenario.worldConfig.gameMode}</strong></div>}
                    {parsedScenario.worldConfig.difficulty && <div>Diff: <strong className="text-brand-text uppercase">{parsedScenario.worldConfig.difficulty}</strong></div>}
                    {parsedScenario.worldConfig.port && <div>Port: <strong className="text-brand-text">{parsedScenario.worldConfig.port}</strong></div>}
                  </div>
                  {onApplyWorldConfig && serverStatus === 'stopped' && (
                    <button
                      onClick={async () => {
                        try {
                          if (onApplyWorldConfig && parsedScenario.worldConfig) {
                            await onApplyWorldConfig({
                              seed: parsedScenario.worldConfig.seed,
                              gameMode: parsedScenario.worldConfig.gameMode,
                              difficulty: parsedScenario.worldConfig.difficulty,
                              port: parsedScenario.worldConfig.port,
                            });
                            setApplySuccess(true);
                            setTimeout(() => setApplySuccess(false), 3000);
                          }
                        } catch (err: any) {
                          setError('Failed to apply configuration: ' + err.message);
                        }
                      }}
                      className="w-full text-center py-1 bg-brand-border hover:bg-brand-border-light text-brand-text border border-brand-border font-mono text-[9px] uppercase font-bold tracking-wider rounded-none cursor-pointer"
                    >
                      Apply settings to server host
                    </button>
                  )}
                  {applySuccess && (
                    <div className="text-[10px] text-brand-green font-mono uppercase font-bold text-center mt-1 animate-pulse">
                      ✓ Applied to Server Host!
                    </div>
                  )}
                </div>
              )}

              {serverStatus !== 'running' ? (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-none p-3 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-mono text-yellow-400">
                    Bots compiled. Server offline. Launch Minecraft host to attach agents to lifecycle.
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleSpawn}
                  disabled={isSpawning}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-none bg-brand-green text-brand-bg hover:opacity-90 font-mono font-bold text-xs uppercase transition-colors"
                >
                  {isSpawning ? 'Attaching bots...' : 'Spawn & Attach Swarm'}
                </button>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-brand-muted border border-dashed border-brand-border rounded-none">
              <FileCode className="w-8 h-8 text-brand-border mb-2" />
              <p className="text-xs font-mono">No parsed scenario loaded.</p>
              <p className="text-[9px] text-brand-muted mt-1 max-w-[200px] font-mono uppercase tracking-tight">
                Paste Markdown on the left or select a preset, then run parser
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/5 border border-red-500/20 text-red-400 text-xs p-3 rounded-none flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

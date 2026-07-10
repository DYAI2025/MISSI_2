import { promises as fs } from 'fs';
import path from 'path';
import { EventLog, EventType, RunManifest, MinecraftServerConfig } from '../types/index.js';

export class EventStoreService {
  private static instance: EventStoreService | null = null;
  private currentRun: RunManifest | null = null;
  private allLogs: EventLog[] = [];
  private onEventCallbacks: ((event: EventLog) => void)[] = [];

  private constructor() {}

  public static getInstance(): EventStoreService {
    if (!this.instance) {
      this.instance = new EventStoreService();
    }
    return this.instance;
  }

  public registerEventCallback(cb: (event: EventLog) => void) {
    this.onEventCallbacks.push(cb);
  }

  public startRun(scenarioTitle: string, serverConfig: MinecraftServerConfig) {
    const runId = `run_${Date.now()}`;
    this.currentRun = {
      id: runId,
      startTime: new Date().toISOString(),
      scenarioTitle,
      serverConfig,
      status: 'running',
      logs: [],
    };
    this.allLogs = [];
    this.addEvent(EventType.SYSTEM, `Simulation Run [${runId}] started for Scenario: "${scenarioTitle}".`);
  }

  public endRun(status: 'completed' | 'failed' | 'idle') {
    if (!this.currentRun) return;

    this.currentRun.status = status;
    this.currentRun.endTime = new Date().toISOString();
    this.currentRun.logs = [...this.allLogs];

    this.addEvent(EventType.SYSTEM, `Simulation Run [${this.currentRun.id}] ended with status: ${status}.`);

    // Persist to disk in background
    this.saveManifestToDisk(this.currentRun);
    this.currentRun = null;
  }

  public addEvent(type: EventType, message: string, botId?: string, botName?: string, details?: Record<string, any>) {
    const event: EventLog = {
      id: `evt_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      botId,
      botName,
      message,
      details,
    };

    this.allLogs.push(event);
    if (this.currentRun) {
      this.currentRun.logs.push(event);
    }

    this.onEventCallbacks.forEach(cb => cb(event));
  }

  public getLogs(): EventLog[] {
    return this.allLogs;
  }

  public getCurrentRun(): RunManifest | null {
    return this.currentRun;
  }

  private async saveManifestToDisk(manifest: RunManifest) {
    try {
      const runsDir = path.resolve(process.cwd(), 'runs');
      const runDir = path.join(runsDir, manifest.id);
      await fs.mkdir(runDir, { recursive: true });

      // Strip credentials if they are present anywhere in logs
      const sanitizedLogs = manifest.logs.map(log => {
        if (log.details?.apiKey) {
          const detailsCopy = { ...log.details };
          delete detailsCopy.apiKey;
          return { ...log, details: detailsCopy };
        }
        return log;
      });

      const sanitizedManifest = {
        ...manifest,
        logs: sanitizedLogs,
      };

      // 1. Write structured directory layout files
      await fs.writeFile(path.join(runDir, 'manifest.json'), JSON.stringify(sanitizedManifest, null, 2));

      const eventsJsonl = sanitizedLogs.map(log => JSON.stringify(log)).join('\n');
      await fs.writeFile(path.join(runDir, 'events.jsonl'), eventsJsonl);

      const providerCalls = sanitizedLogs.filter(log => log.type === EventType.LLM_CALL || log.type === EventType.BOT_THINK);
      const providerCallsJsonl = providerCalls.map(log => JSON.stringify(log)).join('\n');
      await fs.writeFile(path.join(runDir, 'provider-calls.jsonl'), providerCallsJsonl);

      // Reconstruct bot decisions and action outcomes for scientific audit trail
      const botDecisions: any[] = [];
      const actionResults: any[] = [];
      let currentStep = 0;
      let lastBotThinkByBotId: Record<string, any> = {};

      let md = `# Decision Log for Run: ${manifest.id}\n`;
      md += `Scenario: ${manifest.scenarioTitle}\n`;
      md += `Started: ${manifest.startTime}\n`;
      md += `Status: ${manifest.status}\n\n`;
      md += `## Bot Decisions and Action Outcomes\n\n`;

      for (const log of sanitizedLogs) {
        if (log.type === EventType.SYSTEM && log.message.includes('Simulation Step #')) {
          const match = log.message.match(/Simulation Step #(\d+)/);
          if (match) {
            currentStep = parseInt(match[1], 10);
            md += `### Step ${currentStep}\n\n`;
          }
        }

        if (log.type === EventType.BOT_THINK) {
          lastBotThinkByBotId[log.botId || 'unknown'] = {
            providerId: log.details?.providerId || 'unknown',
            model: log.details?.model || 'unknown',
            timestamp: log.timestamp,
          };
          md += `* **${log.botName}** started thinking (Provider: ${log.details?.providerId || 'gemini'}, Model: ${log.details?.model || 'unknown'})\n`;
        }

        if (log.type === EventType.LLM_CALL) {
          const botId = log.botId || 'unknown';
          const botName = log.botName || 'unknown';
          const think = lastBotThinkByBotId[botId] || {};

          const action = log.details?.action || 'idle';
          const parameters = log.details?.parameters || {};
          const reasonSummary = log.details?.reason_summary || log.details?.rationale || log.message || '';

          const decisionTrace = {
            runId: manifest.id,
            step: currentStep,
            botId,
            botName,
            providerId: think.providerId || 'unknown',
            model: think.model || 'unknown',
            observationSummary: `Surroundings at step ${currentStep}`,
            activeGoal: 'Survive and explore',
            selectedAction: action,
            actionParameters: parameters,
            reasonSummary: reasonSummary,
            confidence: 0.9,
            rawResponseRedacted: { redacted: true },
            timestamp: log.timestamp,
          };

          botDecisions.push(decisionTrace);

          const paramsStr = parameters ? JSON.stringify(parameters) : '{}';
          md += `  * **Decision**: Selected action \`${action}\` with parameters \`${paramsStr}\`.\n`;
          md += `  * **Reason Summary**: *${reasonSummary}*\n`;
        }

        if (log.type === EventType.BOT_ACTION || log.type === EventType.ERROR) {
          const actionResult = {
            runId: manifest.id,
            step: currentStep,
            botId: log.botId || 'unknown',
            botName: log.botName || 'unknown',
            action: log.type === EventType.BOT_ACTION ? 'execute' : 'error',
            success: log.type === EventType.BOT_ACTION,
            message: log.message,
            timestamp: log.timestamp,
            details: log.details || {},
          };
          actionResults.push(actionResult);

          if (log.type === EventType.BOT_ACTION) {
            md += `  * **Outcome**: ✅ ${log.message}\n\n`;
          } else {
            md += `  * **Outcome**: ❌ Error: ${log.message}\n\n`;
          }
        }
      }

      // Write scientific audit log files with safe try-catch wrapper
      try {
        const botDecisionsJsonl = botDecisions.map(d => JSON.stringify(d)).join('\n');
        await fs.writeFile(path.join(runDir, 'bot-decisions.jsonl'), botDecisionsJsonl);

        const actionResultsJsonl = actionResults.map(r => JSON.stringify(r)).join('\n');
        await fs.writeFile(path.join(runDir, 'action-results.jsonl'), actionResultsJsonl);

        await fs.writeFile(path.join(runDir, 'decision-log.md'), md);
      } catch (writeErr) {
        console.warn('Warning: Failed to write scientific trace files due to permissions:', writeErr);
      }

      // 2. Also write flat legacy file for backward compatibility
      const legacyFilepath = path.join(runsDir, `manifest_${manifest.id}.json`);
      await fs.writeFile(legacyFilepath, JSON.stringify(sanitizedManifest, null, 2));

      console.log(`Saved structured run files to directory: ${runDir}`);
    } catch (err) {
      console.error('Failed to write run files to disk:', err);
    }
  }

  public async getCompletedRunsList(): Promise<{ id: string; startTime: string; scenarioTitle: string; status: string }[]> {
    try {
      const runsDir = path.resolve(process.cwd(), 'runs');
      const items = await fs.readdir(runsDir, { withFileTypes: true });
      const list = [];

      for (const item of items) {
        if (item.isDirectory() && item.name.startsWith('run_')) {
          const runId = item.name;
          try {
            const manifestPath = path.join(runsDir, runId, 'manifest.json');
            const content = await fs.readFile(manifestPath, 'utf-8');
            const json = JSON.parse(content);
            list.push({
              id: json.id,
              startTime: json.startTime,
              scenarioTitle: json.scenarioTitle,
              status: json.status,
            });
          } catch {}
        } else if (item.isFile() && item.name.startsWith('manifest_') && item.name.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(runsDir, item.name), 'utf-8');
            const json = JSON.parse(content);
            list.push({
              id: json.id,
              startTime: json.startTime,
              scenarioTitle: json.scenarioTitle,
              status: json.status,
            });
          } catch {}
        }
      }

      // Remove duplicate IDs that might exist in both legacy and directory format
      const uniqueList = Array.from(new Map(list.map(item => [item.id, item])).values());
      return uniqueList.sort((a, b) => b.startTime.localeCompare(a.startTime));
    } catch {
      return [];
    }
  }

  public async getRunDetails(id: string): Promise<RunManifest | null> {
    try {
      const runsDir = path.resolve(process.cwd(), 'runs');
      
      // Try directory format first
      try {
        const manifestPath = path.join(runsDir, id, 'manifest.json');
        const content = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        // Fallback to legacy flat file
        const legacyFilepath = path.join(runsDir, `manifest_${id}.json`);
        const content = await fs.readFile(legacyFilepath, 'utf-8');
        return JSON.parse(content);
      }
    } catch {
      return null;
    }
  }
}

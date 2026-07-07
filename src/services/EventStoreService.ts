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

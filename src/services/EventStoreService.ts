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
      await fs.mkdir(runsDir, { recursive: true });

      const filepath = path.join(runsDir, `manifest_${manifest.id}.json`);
      // Strip credentials if they are present anywhere in logs
      const sanitizedLogs = manifest.logs.map(log => {
        if (log.details?.apiKey) {
          return { ...log, details: { ...log.details, apiKey: '***HIDDEN***' } };
        }
        return log;
      });

      const sanitizedManifest = {
        ...manifest,
        logs: sanitizedLogs,
      };

      await fs.writeFile(filepath, JSON.stringify(sanitizedManifest, null, 2));
      console.log(`Saved simulation run manifest to ${filepath}`);
    } catch (err) {
      console.error('Failed to save run manifest file:', err);
    }
  }

  public async getCompletedRunsList(): Promise<{ id: string; startTime: string; scenarioTitle: string; status: string }[]> {
    try {
      const runsDir = path.resolve(process.cwd(), 'runs');
      const files = await fs.readdir(runsDir);
      const list = [];

      for (const file of files) {
        if (file.startsWith('manifest_') && file.endsWith('.json')) {
          const content = await fs.readFile(path.join(runsDir, file), 'utf-8');
          const json = JSON.parse(content);
          list.push({
            id: json.id,
            startTime: json.startTime,
            scenarioTitle: json.scenarioTitle,
            status: json.status,
          });
        }
      }

      return list.sort((a, b) => b.startTime.localeCompare(a.startTime));
    } catch {
      return [];
    }
  }

  public async getRunDetails(id: string): Promise<RunManifest | null> {
    try {
      const runsDir = path.resolve(process.cwd(), 'runs');
      const filepath = path.join(runsDir, `manifest_${id}.json`);
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

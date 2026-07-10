import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SettingsService } from './SettingsService.js';

const execAsync = promisify(exec);

export interface PreflightReport {
  javaAvailable: boolean;
  eulaAccepted: boolean;
  jarExists: boolean;
  issues: string[];
  ready: boolean;
  status: 'ready' | 'blocked';
}

export class MinecraftServerPreflightService {
  private static instance: MinecraftServerPreflightService | null = null;

  private constructor() {}

  public static getInstance(): MinecraftServerPreflightService {
    if (!this.instance) {
      this.instance = new MinecraftServerPreflightService();
    }
    return this.instance;
  }

  /**
   * Run the system preflight diagnostics
   */
  public async runPreflight(): Promise<PreflightReport> {
    const issues: string[] = [];
    let javaAvailable = false;
    let eulaAccepted = false;
    let jarExists = false;

    // 1. Verify Java Availability
    let javaBin = 'java';
    let jarName = 'server.jar';
    let workingDirName = 'minecraft-server';
    try {
      const settings = SettingsService.getInstance();
      const runConfig = settings.getRuntimeConfig();
      if (runConfig) {
        if (runConfig.javaPath) javaBin = runConfig.javaPath;
        if (runConfig.jarPath) jarName = runConfig.jarPath;
        if (runConfig.workingDir) workingDirName = runConfig.workingDir;
      }
    } catch {
      // Ignored if SettingsService is not yet initialized
    }

    try {
      await execAsync(`${javaBin} -version`);
      javaAvailable = true;
    } catch {
      javaAvailable = false;
      issues.push(`Java binary "${javaBin}" not detected/executable. Real Minecraft server hosting requires Java 17+ installed.`);
    }

    // 2. Verify server.jar Existence
    const serverDir = path.resolve(process.cwd(), workingDirName);
    const jarPath = path.join(serverDir, jarName);
    try {
      await fs.access(jarPath);
      jarExists = true;
    } catch {
      jarExists = false;
      issues.push(`Minecraft server jar "${jarName}" is missing. Real Minecraft server hosting requires a valid jar at ${workingDirName}/${jarName}.`);
    }

    // 3. Verify EULA Acceptance in eula.txt
    const eulaPath = path.join(serverDir, 'eula.txt');
    try {
      const content = await fs.readFile(eulaPath, 'utf-8');
      if (content.includes('eula=true')) {
        eulaAccepted = true;
      } else {
        issues.push(`Minecraft EULA has not been accepted. eula.txt in ${workingDirName} contains eula=false.`);
      }
    } catch {
      eulaAccepted = false;
      issues.push(`eula.txt is missing. Real Minecraft server hosting requires accepting the Mojang EULA in ${workingDirName}.`);
    }

    let useEmulator = false;
    try {
      const settings = SettingsService.getInstance();
      const runConfig = settings.getRuntimeConfig();
      if (runConfig && runConfig.useEmulator) {
        useEmulator = true;
      }
    } catch {
      // Ignored
    }

    const ready = useEmulator || (javaAvailable && eulaAccepted && jarExists);
    const status = ready ? 'ready' : 'blocked';

    return {
      javaAvailable,
      eulaAccepted,
      jarExists,
      issues,
      ready,
      status,
    };
  }
}

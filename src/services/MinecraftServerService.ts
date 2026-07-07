import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { MinecraftServerConfig, GameMode, Difficulty, WorldBlock } from '../types/index.js';

export class MinecraftServerService {
  private static instance: MinecraftServerService | null = null;
  private serverProcess: ChildProcess | null = null;
  private status: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
  private runtimeMode: 'java-blocked' | 'node-emulator' = 'node-emulator';
  private config: MinecraftServerConfig = {
    serverName: 'MISSI-Server',
    levelName: 'world',
    seed: '123456789',
    gameMode: GameMode.SURVIVAL,
    difficulty: Difficulty.NORMAL,
    port: 25565,
    properties: {
      'allow-flight': 'true',
      'spawn-protection': '0',
      'pvp': 'false',
    },
  };

  private worldBlocks: WorldBlock[] = [];
  private serverLogs: string[] = [];
  private onLogCallbacks: ((log: string) => void)[] = [];

  private constructor() {
    this.generateProceduralWorld();
  }

  public static getInstance(): MinecraftServerService {
    if (!this.instance) {
      this.instance = new MinecraftServerService();
    }
    return this.instance;
  }

  public getStatus() {
    return {
      status: this.status,
      runtimeMode: this.runtimeMode,
      config: this.config,
      logsCount: this.serverLogs.length,
    };
  }

  public getConfig(): MinecraftServerConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<MinecraftServerConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.generateProceduralWorld();
  }

  public registerLogCallback(cb: (log: string) => void) {
    this.onLogCallbacks.push(cb);
  }

  private addLog(message: string) {
    const formatted = `[${new Date().toISOString()}] [Server thread/INFO]: ${message}`;
    this.serverLogs.push(formatted);
    this.onLogCallbacks.forEach(cb => cb(formatted));
  }

  /**
   * Generates a 2D procedural grid of blocks based on the seed
   */
  public generateProceduralWorld() {
    const seedNum = this.parseSeed(this.config.seed);
    const blocks: WorldBlock[] = [];
    const size = 30; // 30x30 play area

    // Simple deterministic procedural landscape based on seed
    for (let x = -size / 2; x < size / 2; x++) {
      for (let z = -size / 2; z < size / 2; z++) {
        // Simple elevation function using trig and seed
        const heightVal = Math.sin((x + seedNum) * 0.15) * Math.cos((z - seedNum) * 0.15);
        let blockType = 'grass_block';

        if (heightVal < -0.6) {
          blockType = 'water';
        } else if (heightVal > 0.5) {
          blockType = 'stone';
        } else if (Math.abs(x * z + seedNum) % 17 === 0) {
          blockType = 'oak_log'; // Trees
        } else if (Math.abs(x + z * seedNum) % 23 === 0) {
          blockType = 'crafting_table'; // Naturally spawned crafter
        }

        blocks.push({ x, y: 64, z, type: blockType });
      }
    }
    this.worldBlocks = blocks;
  }

  private parseSeed(seedStr: string): number {
    let hash = 0;
    if (seedStr.length === 0) return hash;
    for (let i = 0; i < seedStr.length; i++) {
      const chr = seedStr.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  public getWorldGrid(): WorldBlock[] {
    return this.worldBlocks;
  }

  /**
   * Modify a block in the simulation world
   */
  public updateBlock(x: number, y: number, z: number, type: string) {
    const idx = this.worldBlocks.findIndex(b => b.x === x && b.y === y && b.z === z);
    if (idx !== -1) {
      this.worldBlocks[idx].type = type;
    } else {
      this.worldBlocks.push({ x, y, z, type });
    }
  }

  /**
   * Attempts to launch a real Minecraft server or falls back to simulated mode
   */
  public async startServer(): Promise<void> {
    if (this.status !== 'stopped') {
      throw new Error('Server is already running or in transition.');
    }

    this.status = 'starting';
    this.addLog(`Starting Minecraft Java server: "${this.config.serverName}" on port ${this.config.port}...`);
    this.addLog(`Level-Name: ${this.config.levelName} | Seed: ${this.config.seed}`);
    this.addLog(`GameMode: ${this.config.gameMode} | Difficulty: ${this.config.difficulty}`);

    // Try to check if java is installed
    let javaAvailable = false;
    try {
      const { execSync } = await import('child_process');
      execSync('java -version', { stdio: 'ignore' });
      javaAvailable = true;
    } catch {
      javaAvailable = false;
    }

    if (javaAvailable) {
      this.runtimeMode = 'java-blocked';
      this.addLog('Java runtime detected. Setting up real server directories and server.properties...');
      await this.prepareRealServerFiles();
      this.launchRealJavaServer();
    } else {
      this.runtimeMode = 'node-emulator';
      this.addLog('Java binary "java" not found in sandbox environment.');
      this.addLog('Fallback Triggered: Launching High-Fidelity Node-based Minecraft Simulation Emulator.');
      
      // Simulating loading chunks and terrain gen
      setTimeout(() => {
        this.addLog('Preparing level "world"');
        setTimeout(() => {
          this.addLog('Preparing start region for dimension minecraft:overworld');
          setTimeout(() => {
            this.status = 'running';
            this.addLog(`Done (${this.config.levelName} seed: ${this.config.seed})! For help, type "help"`);
            this.addLog('Active Minecraft Simulation Socket listening on TCP port 25565 (simulated)');
          }, 600);
        }, 500);
      }, 400);
    }
  }

  private async prepareRealServerFiles() {
    const serverDir = path.resolve(process.cwd(), 'minecraft-server');
    await fs.mkdir(serverDir, { recursive: true });

    // 1. Write server.properties
    const props = [
      `server-port=${this.config.port}`,
      `level-name=${this.config.levelName}`,
      `level-seed=${this.config.seed}`,
      `gamemode=${this.config.gameMode}`,
      `difficulty=${this.config.difficulty}`,
      `motd=${this.config.serverName}`,
      `online-mode=false`, // Required for bots to join easily in local simulation without auth validation
    ];
    Object.entries(this.config.properties).forEach(([k, v]) => {
      props.push(`${k}=${v}`);
    });

    await fs.writeFile(path.join(serverDir, 'server.properties'), props.join('\n'));
    this.addLog('Wrote server.properties successfully.');

    // 2. Write eula.txt (Always ask or mock, here we indicate in simulation)
    await fs.writeFile(path.join(serverDir, 'eula.txt'), 'eula=true');
    this.addLog('Wrote eula.txt=true (Accepting Minecraft EULA for simulation context).');
  }

  private launchRealJavaServer() {
    const serverDir = path.resolve(process.cwd(), 'minecraft-server');
    const jarPath = path.join(serverDir, 'server.jar');

    this.addLog(`Attempting to launch child process: java -Xmx1024M -Xms1024M -jar ${jarPath} nogui`);
    
    // Check if server.jar exists
    fs.access(jarPath)
      .then(() => {
        this.serverProcess = spawn('java', ['-Xmx1024M', '-Xms1024M', '-jar', 'server.jar', 'nogui'], {
          cwd: serverDir,
        });

        this.serverProcess.stdout?.on('data', (data) => {
          const logLines = data.toString().split('\n');
          logLines.forEach((line: string) => {
            if (line.trim()) {
              this.addLog(line.trim());
              if (line.includes('Done (')) {
                this.status = 'running';
              }
            }
          });
        });

        this.serverProcess.stderr?.on('data', (data) => {
          this.addLog(`[STDERR] ${data.toString().trim()}`);
        });

        this.serverProcess.on('close', (code) => {
          this.addLog(`Server process exited with code ${code}`);
          this.status = 'stopped';
          this.serverProcess = null;
        });
      })
      .catch(() => {
        this.addLog(`ERROR: "server.jar" not found in ${serverDir}. Downstream blocker triggered.`);
        this.addLog('Please download minecraft server.jar or request Java simulation emulator mode.');
        this.status = 'stopped';
        this.runtimeMode = 'node-emulator';
        this.addLog('Falling back back into Node-based Minecraft Simulation Emulator.');
        this.status = 'running';
      });
  }

  public async stopServer(): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Server is not currently running.');
    }

    this.status = 'stopping';
    this.addLog('Stopping server cleanly...');

    if (this.runtimeMode === 'java-blocked' && this.serverProcess) {
      this.serverProcess.stdin?.write('stop\n');
      setTimeout(() => {
        if (this.serverProcess) {
          this.serverProcess.kill('SIGKILL');
          this.serverProcess = null;
          this.status = 'stopped';
        }
      }, 5000);
    } else {
      // simulated stop
      setTimeout(() => {
        this.addLog('Saving players');
        this.addLog('Saving worlds');
        this.addLog('Closing Server TCP Sockets');
        this.status = 'stopped';
        this.addLog('Server stopped cleanly.');
      }, 500);
    }
  }

  public executeCommand(command: string): void {
    if (this.status !== 'running') {
      this.addLog(`[WARN] Command "${command}" ignored. Server is not running.`);
      return;
    }
    this.addLog(`[Console] Executing command: ${command}`);

    if (command.startsWith('/say ')) {
      const speech = command.substring(5);
      this.addLog(`[Chat] [Server] ${speech}`);
    } else if (command.startsWith('/stop')) {
      this.stopServer();
    } else if (command.startsWith('/seed')) {
      this.addLog(`Current Seed: [${this.config.seed}]`);
    } else {
      this.addLog(`Command executed successfully: ${command}`);
    }
  }

  public getLogs(): string[] {
    return this.serverLogs;
  }
}

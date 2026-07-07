export enum GameMode {
  SURVIVAL = 'survival',
  CREATIVE = 'creative',
  ADVENTURE = 'adventure',
  SPECTATOR = 'spectator',
}

export enum Difficulty {
  PEACEFUL = 'peaceful',
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
}

export interface MinecraftServerConfig {
  serverName: string;
  levelName: string;
  seed: string;
  gameMode: GameMode;
  difficulty: Difficulty;
  port: number;
  properties: Record<string, string>;
}

export enum LLMProviderType {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OPENROUTER = 'openrouter',
  OLLAMA = 'ollama',
  LMSTUDIO = 'lmstudio',
}

export interface LLMProviderConfig {
  id: string;
  type: LLMProviderType;
  name: string;
  apiKey: string; // Stored in memory / session on backend
  customUrl?: string; // For Ollama / LMStudio / OpenRouter custom endpoints
  defaultModel: string;
}

export interface BotConfig {
  id: string;
  name: string;
  role: string;
  goal: string;
  providerId: string;
  model: string;
  inventory: Record<string, number>;
  x: number;
  y: number;
  z: number;
  health: number;
  food: number;
}

export interface Scenario {
  title: string;
  description: string;
  objectives: string[];
  bots: BotConfig[];
  worldConfig?: {
    seed?: string;
    gameMode?: string;
    difficulty?: string;
    port?: number;
  };
}

export enum EventType {
  SERVER_START = 'server_start',
  SERVER_STOP = 'server_stop',
  BOT_JOIN = 'bot_join',
  BOT_LEAVE = 'bot_leave',
  BOT_THINK = 'bot_think',
  BOT_ACTION = 'bot_action',
  BOT_CHAT = 'bot_chat',
  LLM_CALL = 'llm_call',
  SYSTEM = 'system',
  ERROR = 'error',
}

export interface EventLog {
  id: string;
  timestamp: string;
  type: EventType;
  botId?: string;
  botName?: string;
  message: string;
  details?: Record<string, any>;
}

export interface RunManifest {
  id: string;
  startTime: string;
  endTime?: string;
  scenarioTitle: string;
  serverConfig: MinecraftServerConfig;
  status: 'idle' | 'running' | 'completed' | 'failed';
  logs: EventLog[];
}

export interface WorldBlock {
  x: number;
  y: number;
  z: number;
  type: string;
}

export interface SimulationState {
  serverStatus: 'stopped' | 'starting' | 'running' | 'stopping' | 'blocked' | 'failed';
  runtimeMode: 'live' | 'simulation' | 'blocked' | 'failed' | 'stopped';
  serverConfig: MinecraftServerConfig;
  bots: BotConfig[];
  logs: EventLog[];
  worldGrid: WorldBlock[];
  activeScenario?: Scenario;
}

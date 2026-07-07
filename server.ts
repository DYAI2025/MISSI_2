import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { MinecraftServerService } from './src/services/MinecraftServerService.js';
import { ScenarioService } from './src/services/ScenarioService.js';
import { EventStoreService } from './src/services/EventStoreService.js';
import { BotOrchestratorService } from './src/services/BotOrchestratorService.js';
import { GameMode, Difficulty, EventType } from './src/types/index.js';

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Standard Middlewares
  app.use(express.json());

  const serverService = MinecraftServerService.getInstance();
  const eventStore = EventStoreService.getInstance();
  const orchestrator = BotOrchestratorService.getInstance();

  // Pipe server service logs into event store service for live monitoring
  serverService.registerLogCallback((log) => {
    eventStore.addEvent(EventType.SYSTEM, log);
  });

  // --- API ROUTES ---

  /**
   * Status API
   */
  app.get('/api/status', (req, res) => {
    const serverStatus = serverService.getStatus();
    const simStatus = orchestrator.getSimulationState();
    const bots = orchestrator.getBots();
    const worldGrid = serverService.getWorldGrid();
    
    res.json({
      serverStatus: serverStatus.status,
      runtimeMode: serverStatus.runtimeMode,
      serverConfig: serverStatus.config,
      isSimulating: simStatus.isSimulating,
      currentStep: simStatus.currentStep,
      activeScenario: simStatus.activeScenario,
      bots,
      worldGridSize: worldGrid.length,
    });
  });

  /**
   * World block layout grid
   */
  app.get('/api/world', (req, res) => {
    res.json({
      worldGrid: serverService.getWorldGrid(),
    });
  });

  /**
   * Update server properties
   */
  app.post('/api/server/config', (req, res) => {
    const { serverName, levelName, seed, gameMode, difficulty, port, properties } = req.body;
    try {
      serverService.updateConfig({
        serverName: serverName || undefined,
        levelName: levelName || undefined,
        seed: seed || undefined,
        gameMode: (gameMode as GameMode) || undefined,
        difficulty: (difficulty as Difficulty) || undefined,
        port: port ? parseInt(port, 10) : undefined,
        properties: properties || undefined,
      });
      res.json({ success: true, config: serverService.getConfig() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * Server startup
   */
  app.post('/api/server/start', async (req, res) => {
    try {
      await serverService.startServer();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Server shutdown
   */
  app.post('/api/server/stop', async (req, res) => {
    try {
      await serverService.stopServer();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Send arbitrary command line strings
   */
  app.post('/api/server/command', (req, res) => {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command string is required.' });
    }
    serverService.executeCommand(command);
    res.json({ success: true });
  });

  /**
   * Parse Markdown Scenario
   */
  app.post('/api/scenario/parse', (req, res) => {
    const { markdown } = req.body;
    if (!markdown) {
      return res.status(400).json({ error: 'Markdown string is required.' });
    }
    try {
      const parsed = ScenarioService.parseMarkdown(markdown);
      ScenarioService.validate(parsed);
      res.json({ success: true, scenario: parsed });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * Spawn bots in active server
   */
  app.post('/api/simulation/spawn', async (req, res) => {
    const { scenario } = req.body;
    if (!scenario) {
      return res.status(400).json({ error: 'Scenario configuration is required.' });
    }
    try {
      await orchestrator.spawnBots(scenario);
      res.json({ success: true, bots: orchestrator.getBots() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Launch the simulation loop
   */
  app.post('/api/simulation/start', (req, res) => {
    const { intervalMs } = req.body;
    try {
      orchestrator.startSimulation(intervalMs || 8000);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Halt the simulation loop
   */
  app.post('/api/simulation/stop', (req, res) => {
    try {
      orchestrator.stopSimulation();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Step manually through simulation
   */
  app.post('/api/simulation/step', async (req, res) => {
    try {
      await orchestrator.executeSimulationStep();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Get historical runs manifests list
   */
  app.get('/api/simulation/runs', async (req, res) => {
    const runs = await eventStore.getCompletedRunsList();
    res.json({ runs });
  });

  /**
   * Get specific run logs detail
   */
  app.get('/api/simulation/runs/:id', async (req, res) => {
    const run = await eventStore.getRunDetails(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run manifest not found.' });
    }
    res.json({ run });
  });

  /**
   * Get LLM provider definitions (safely concealing secrets)
   */
  app.get('/api/providers', (req, res) => {
    const list = orchestrator.getProviders().map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      customUrl: p.customUrl,
      defaultModel: p.defaultModel,
      isConfigured: !!(p.apiKey || (p.type === 'gemini' && process.env.GEMINI_API_KEY)),
    }));
    res.json({ providers: list });
  });

  /**
   * Update credentials for standard provider
   */
  app.post('/api/provider/update', (req, res) => {
    const { id, type, apiKey, customUrl, defaultModel } = req.body;
    if (!id || !type) {
      return res.status(400).json({ error: 'Provider ID and Type are required.' });
    }
    try {
      orchestrator.updateProvider({
        id,
        type,
        name: id === 'gemini' ? 'Google Gemini' : id === 'openai' ? 'OpenAI GPT' : id === 'anthropic' ? 'Anthropic Claude' : id === 'openrouter' ? 'OpenRouter' : id === 'ollama' ? 'Ollama' : 'LM Studio',
        apiKey: apiKey || '',
        customUrl: customUrl || undefined,
        defaultModel: defaultModel || '',
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Retrieve current event logs buffer
   */
  app.get('/api/simulation/logs', (req, res) => {
    res.json({
      logs: eventStore.getLogs(),
    });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start Listener
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MISSI running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot failure:', err);
});

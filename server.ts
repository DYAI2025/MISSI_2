import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { MinecraftServerService } from './src/services/MinecraftServerService.js';
import { ScenarioService } from './src/services/ScenarioService.js';
import { EventStoreService } from './src/services/EventStoreService.js';
import { BotOrchestratorService } from './src/services/BotOrchestratorService.js';
import { GameMode, Difficulty, EventType } from './src/types/index.js';
import { SmokeTestService } from './src/services/SmokeTestService.js';
import { LLMProviderService } from './src/services/LLMProviderService.js';

import { SecretStoreService } from './src/services/SecretStoreService.js';
import { SettingsService } from './src/services/SettingsService.js';
import { ScenarioLibraryService } from './src/services/ScenarioLibraryService.js';
import { BotProfileService } from './src/services/BotProfileService.js';

// Resolve directory paths for both ES Modules and CommonJS bundles
let currentDirname = '';
try {
  currentDirname = path.dirname(fileURLToPath(import.meta.url));
} catch {
  currentDirname = __dirname;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Standard Middlewares
  app.use(express.json());

  // Initialize persistent services
  const secrets = SecretStoreService.getInstance();
  await secrets.init();
  const settings = SettingsService.getInstance();
  await settings.init();
  const scenarioLibrary = ScenarioLibraryService.getInstance();
  await scenarioLibrary.init();
  const botProfileService = BotProfileService.getInstance();
  await botProfileService.init();

  const serverService = MinecraftServerService.getInstance();
  serverService.loadConfig();

  const eventStore = EventStoreService.getInstance();
  const orchestrator = BotOrchestratorService.getInstance();

  // Restore active scenario if set in workspace config
  const workspaceConfig = settings.getWorkspaceConfig();
  if (workspaceConfig.activeScenarioId) {
    const activeSc = scenarioLibrary.getScenario(workspaceConfig.activeScenarioId);
    if (activeSc) {
      orchestrator.setActiveScenario(activeSc.parsedScenario);
      console.log(`[Startup] Restored active scenario: ${activeSc.title} (${workspaceConfig.activeScenarioId})`);
    }
  }

  // Pipe server service logs into event store service for live monitoring
  serverService.registerLogCallback((log) => {
    eventStore.addEvent(EventType.SYSTEM, log);
  });

  // --- API ROUTES ---

  /**
   * Health check routes
   */
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

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
      allowSimulationMode: process.env.ALLOW_SIMULATION_MODE === 'true',
      not_live_ready: serverStatus.runtimeMode === 'simulation' || process.env.ALLOW_SIMULATION_MODE !== 'true',
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
   * Delete the generated world folders
   */
  app.delete('/api/server/world', async (req, res) => {
    try {
      const serverStatus = serverService.getStatus();
      if (serverStatus.status !== 'stopped') {
        return res.status(400).json({ error: 'Server must be stopped to delete the generated world.' });
      }

      const levelName = serverService.getConfig().levelName || 'world';

      // Prevent path traversal
      if (!levelName || levelName.includes('..') || levelName.includes('/') || levelName.includes('\\')) {
        return res.status(400).json({ error: 'Invalid level name.' });
      }

      const worldDir = path.resolve(process.cwd(), 'minecraft-server', levelName);

      try {
        await fs.rm(worldDir, { recursive: true, force: true });
        // Regenerate the visual world grid in simulation
        serverService.generateProceduralWorld();
        res.json({ success: true, message: `World folder '${levelName}' deleted successfully.` });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to delete world: ${err.message}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
      const { acceptEULA, useEmulator } = req.body;
      await serverService.startServer(!!acceptEULA, !!useEmulator);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Provider connectivity smoke test (Legacy and new routes)
   */
  app.post('/api/providers/:id/test', async (req, res) => {
    try {
      const { id } = req.params;
      const { type, apiKey, customUrl, defaultModel } = req.body;
      
      const providerType = type || settings.getProviders().find(p => p.id === id)?.type;
      if (!providerType) {
        return res.status(400).json({ error: 'Provider type is required for verification test.' });
      }

      let effectiveApiKey = apiKey;
      if (effectiveApiKey === undefined || effectiveApiKey === '' || effectiveApiKey.startsWith('*')) {
        effectiveApiKey = secrets.getSecret(id);
        if (!effectiveApiKey) {
          if (providerType === 'gemini') {
            effectiveApiKey = process.env.GEMINI_API_KEY || '';
          } else if (providerType === 'openai') {
            effectiveApiKey = process.env.OPENAI_API_KEY || '';
          } else if (providerType === 'anthropic') {
            effectiveApiKey = process.env.ANTHROPIC_API_KEY || '';
          } else if (providerType === 'openrouter') {
            effectiveApiKey = process.env.OPENROUTER_API_KEY || '';
          }
        }
      }

      if (!effectiveApiKey && providerType !== 'ollama' && providerType !== 'lmstudio') {
        return res.status(400).json({ error: 'missing_key', message: 'API key is missing or not configured.' });
      }

      const storedProvider = settings.getProviders().find(p => p.id === id);
      const finalCustomUrl = customUrl !== undefined ? customUrl : storedProvider?.customUrl;
      const finalDefaultModel = defaultModel !== undefined ? defaultModel : (storedProvider?.defaultModel || '');

      const config = {
        id,
        type: providerType,
        name: id === 'gemini' ? 'Google Gemini' : id === 'openai' ? 'OpenAI GPT' : id === 'anthropic' ? 'Anthropic Claude' : id === 'openrouter' ? 'OpenRouter' : id === 'ollama' ? 'Ollama' : 'LM Studio',
        apiKey: effectiveApiKey || '',
        customUrl: finalCustomUrl || undefined,
        defaultModel: finalDefaultModel || '',
      };

      const result = await LLMProviderService.testConnection(config);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/provider/test', async (req, res) => {
    try {
      const { id, type, apiKey, customUrl, defaultModel } = req.body;
      if (!id || !type) {
        return res.status(400).json({ error: 'Provider ID and Type are required for verification test.' });
      }

      let effectiveApiKey = apiKey;
      if (effectiveApiKey === undefined || effectiveApiKey === '' || effectiveApiKey.startsWith('*')) {
        effectiveApiKey = secrets.getSecret(id);
        if (!effectiveApiKey) {
          if (type === 'gemini') {
            effectiveApiKey = process.env.GEMINI_API_KEY || '';
          } else if (type === 'openai') {
            effectiveApiKey = process.env.OPENAI_API_KEY || '';
          } else if (type === 'anthropic') {
            effectiveApiKey = process.env.ANTHROPIC_API_KEY || '';
          } else if (type === 'openrouter') {
            effectiveApiKey = process.env.OPENROUTER_API_KEY || '';
          }
        }
      }

      if (!effectiveApiKey && type !== 'ollama' && type !== 'lmstudio') {
        return res.status(400).json({ error: 'missing_key', message: 'API key is missing or not configured.' });
      }

      const storedProvider = settings.getProviders().find(p => p.id === id);
      const finalCustomUrl = customUrl !== undefined ? customUrl : storedProvider?.customUrl;
      const finalDefaultModel = defaultModel !== undefined ? defaultModel : (storedProvider?.defaultModel || '');

      const config = {
        id,
        type,
        name: id === 'gemini' ? 'Google Gemini' : id === 'openai' ? 'OpenAI GPT' : id === 'anthropic' ? 'Anthropic Claude' : id === 'openrouter' ? 'OpenRouter' : id === 'ollama' ? 'Ollama' : 'LM Studio',
        apiKey: effectiveApiKey || '',
        customUrl: finalCustomUrl || undefined,
        defaultModel: finalDefaultModel || '',
      };

      const result = await LLMProviderService.testConnection(config);
      res.json(result);
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
   * Run TCP Minecraft Server & Bot Connection Protocol Mock Diagnostic Test
   */
  app.post('/api/test/protocol-mock-diagnostic', async (req, res) => {
    const { serverName, levelName, seed, gameMode, difficulty, port } = req.body;
    try {
      const result = await SmokeTestService.getInstance().runSmokeTest({
        name: serverName || 'SMOKE-Server',
        level: levelName || 'world',
        seed: seed || '987654321',
        mode: gameMode || 'survival',
        difficulty: difficulty || 'normal',
        port: port ? parseInt(port, 10) : 25565,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
   * Delete specific run manifest and its logs from disk
   */
  app.delete('/api/simulation/runs/:id', async (req, res) => {
    try {
      const runsDir = path.resolve(process.cwd(), 'runs');
      const runId = req.params.id;
      // Prevent path traversal
      if (!runId || runId.includes('..') || !runId.startsWith('run_')) {
        return res.status(400).json({ error: 'Invalid run ID.' });
      }

      const runDir = path.join(runsDir, runId);
      try {
        await fs.rm(runDir, { recursive: true, force: true });
      } catch (e) {}

      const legacyFilepath = path.join(runsDir, `manifest_${runId}.json`);
      try {
        await fs.unlink(legacyFilepath);
      } catch (e) {}

      res.json({ success: true, message: `Run manifest ${runId} deleted successfully.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Clear all completed runs and logs
   */
  app.delete('/api/simulation/runs', async (req, res) => {
    try {
      const runsDir = path.resolve(process.cwd(), 'runs');
      try {
        await fs.rm(runsDir, { recursive: true, force: true });
        await fs.mkdir(runsDir, { recursive: true });
      } catch (e) {}
      res.json({ success: true, message: 'All run logs cleared.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Get Settings Aggregate
   */
  app.get('/api/settings', (req, res) => {
    try {
      const serverConfig = settings.getServerConfig();
      const workspace = settings.getWorkspaceConfig();
      const list = settings.getProviders().map(p => {
        const meta = secrets.getSecretMetadata(p.id);
        return {
          id: p.id,
          type: p.type,
          name: p.name,
          customUrl: p.customUrl,
          defaultModel: p.defaultModel,
          isConfigured: !!(p.apiKey && p.apiKey.length > 0),
          secretMetadata: meta,
        };
      });
      const scenarios = scenarioLibrary.getScenarios();
      const botProfiles = botProfileService.getProfiles();

      res.json({
        serverConfig,
        workspace,
        providers: list,
        scenarios,
        botProfiles,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Get LLM provider definitions (safely concealing secrets)
   */
  app.get('/api/providers', (req, res) => {
    const list = settings.getProviders().map(p => {
      const meta = secrets.getSecretMetadata(p.id);
      return {
        id: p.id,
        type: p.type,
        name: p.name,
        customUrl: p.customUrl,
        defaultModel: p.defaultModel,
        isConfigured: !!(p.apiKey && p.apiKey.length > 0),
        secretMetadata: meta,
      };
    });
    res.json({ providers: list });
  });

  /**
   * Update credentials for standard provider
   */
  app.post('/api/provider/update', async (req, res) => {
    const { id, type, apiKey, customUrl, defaultModel } = req.body;
    if (!id || !type) {
      return res.status(400).json({ error: 'Provider ID and Type are required.' });
    }
    try {
      const saved = await settings.saveProvider({
        id,
        type,
        name: id === 'gemini' ? 'Google Gemini' : id === 'openai' ? 'OpenAI GPT' : id === 'anthropic' ? 'Anthropic Claude' : id === 'openrouter' ? 'OpenRouter' : id === 'ollama' ? 'Ollama' : 'LM Studio',
        apiKey: apiKey || '',
        customUrl: customUrl || undefined,
        defaultModel: defaultModel || '',
      });
      orchestrator.updateProvider(saved);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Update provider config (PUT route)
   */
  app.put('/api/providers/:id', async (req, res) => {
    try {
      const saved = await settings.saveProvider({
        ...req.body,
        id: req.params.id,
      });
      orchestrator.updateProvider(saved);
      const meta = secrets.getSecretMetadata(saved.id);
      res.json({
        success: true,
        provider: {
          id: saved.id,
          type: saved.type,
          name: saved.name,
          customUrl: saved.customUrl,
          defaultModel: saved.defaultModel,
          isConfigured: !!(saved.apiKey && saved.apiKey.length > 0),
          secretMetadata: meta,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Delete provider secret
   */
  app.delete('/api/providers/:id/secret', async (req, res) => {
    try {
      await settings.deleteProviderSecret(req.params.id);
      const updated = settings.getProviders().find(p => p.id === req.params.id);
      if (updated) {
        orchestrator.updateProvider(updated);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Server config GET/PUT
   */
  app.get('/api/settings/server', (req, res) => {
    res.json({ success: true, config: settings.getServerConfig() });
  });

  app.put('/api/settings/server', async (req, res) => {
    try {
      const updated = await settings.saveServerConfig(req.body);
      serverService.updateConfig(updated);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * Workspace config GET/PUT
   */
  app.get('/api/settings/workspace', (req, res) => {
    res.json({ success: true, config: settings.getWorkspaceConfig() });
  });

  app.put('/api/settings/workspace', async (req, res) => {
    try {
      const updated = await settings.saveWorkspaceConfig(req.body);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * Scenarios Library CRUD
   */
  app.get('/api/scenarios', (req, res) => {
    res.json({ scenarios: scenarioLibrary.getScenarios() });
  });

  app.post('/api/scenarios', async (req, res) => {
    const { id, title, description, markdown, parsedScenario } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Scenario ID is required.' });
    }
    try {
      let finalParsed = parsedScenario;
      if (!finalParsed && markdown) {
        finalParsed = ScenarioService.parseMarkdown(markdown);
        ScenarioService.validate(finalParsed);
      }
      if (!finalParsed) {
        return res.status(400).json({ error: 'Scenario parsed configuration or markdown is required.' });
      }
      const item = {
        id,
        title: title || finalParsed.title,
        description: description || finalParsed.description || '',
        originalMarkdown: markdown || '',
        parsedScenario: finalParsed,
        lastSavedAt: new Date().toISOString(),
      };
      const saved = await scenarioLibrary.saveScenarioItem(item);
      res.json({ success: true, scenario: saved });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/scenarios/:id', (req, res) => {
    const sc = scenarioLibrary.getScenario(req.params.id);
    if (!sc) {
      return res.status(404).json({ error: 'Scenario not found.' });
    }
    res.json({ scenario: sc });
  });

  app.put('/api/scenarios/:id', async (req, res) => {
    const { title, description, markdown, parsedScenario } = req.body;
    try {
      let finalParsed = parsedScenario;
      if (!finalParsed && markdown) {
        finalParsed = ScenarioService.parseMarkdown(markdown);
        ScenarioService.validate(finalParsed);
      }
      const existing = scenarioLibrary.getScenario(req.params.id);
      if (!existing && !finalParsed) {
        return res.status(404).json({ error: 'Scenario not found and no parsed data provided.' });
      }
      const item = {
        id: req.params.id,
        title: title || existing?.title || finalParsed?.title || 'Untitled',
        description: description || existing?.description || finalParsed?.description || '',
        originalMarkdown: markdown || existing?.originalMarkdown || '',
        parsedScenario: finalParsed || existing?.parsedScenario,
        lastSavedAt: new Date().toISOString(),
      };
      const saved = await scenarioLibrary.saveScenarioItem(item as any);
      res.json({ success: true, scenario: saved });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/scenarios/:id', async (req, res) => {
    try {
      await scenarioLibrary.deleteScenario(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/scenarios/:id/apply', async (req, res) => {
    const sc = scenarioLibrary.getScenario(req.params.id);
    if (!sc) {
      return res.status(404).json({ error: 'Scenario not found.' });
    }
    try {
      orchestrator.setActiveScenario(sc.parsedScenario);
      await settings.saveWorkspaceConfig({ activeScenarioId: req.params.id });
      res.json({ success: true, scenario: sc });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Bot Profiles Library CRUD
   */
  app.get('/api/bot-profiles', (req, res) => {
    res.json({ profiles: botProfileService.getProfiles() });
  });

  app.post('/api/bot-profiles', async (req, res) => {
    try {
      const saved = await botProfileService.saveProfile(req.body);
      res.json({ success: true, profile: saved });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/bot-profiles/:id', (req, res) => {
    const prof = botProfileService.getProfile(req.params.id);
    if (!prof) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json({ profile: prof });
  });

  app.put('/api/bot-profiles/:id', async (req, res) => {
    try {
      const data = { ...req.body, id: req.params.id };
      const saved = await botProfileService.saveProfile(data);
      res.json({ success: true, profile: saved });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/bot-profiles/:id', async (req, res) => {
    try {
      await botProfileService.deleteProfile(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
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
    app.get(/^\/(?!api).*/, (req, res) => {
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

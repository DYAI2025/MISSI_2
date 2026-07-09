import { Scenario, BotConfig, GameMode } from '../types/index.js';

export class ScenarioService {
  /**
   * Parses scenario Markdown text into a structured Scenario object.
   */
  public static parseMarkdown(markdown: string): Scenario {
    const lines = markdown.split('\n');
    let title = 'Default Minecraft Scenario';
    let description = 'A simulation run.';
    let version: string | undefined = undefined;
    let scenarioPrompt: string | undefined = undefined;
    let scenarioPromptLines: string[] = [];
    const objectives: string[] = [];
    const bots: BotConfig[] = [];
    const worldConfig: { seed?: string; gameMode?: string; game_mode?: string; difficulty?: string; port?: number; levelName?: string; level_name?: string; properties?: Record<string, string> } = {};

    let currentSection: 'meta' | 'objectives' | 'bots' | 'world_config' | 'scenario_prompt' | 'none' = 'meta';
    let currentBot: Partial<BotConfig> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check section headers
      if (line.startsWith('# ')) {
        const scenarioMatch = line.match(/^#\s*(Scenario:\s*)?(.*)$/i);
        if (scenarioMatch) {
          title = scenarioMatch[2].trim();
        }
        currentSection = 'meta';
        continue;
      }

      if (line.match(/^##\s*(Scenario\s*Prompt|ScenarioPrompt|System\s*Prompt)/i)) {
        currentSection = 'scenario_prompt';
        continue;
      }

      if (line.startsWith('## World Configuration') || line.startsWith('## World Config') || line.startsWith('## Server Config')) {
        currentSection = 'world_config';
        continue;
      }

      if (line.startsWith('## Objectives')) {
        currentSection = 'objectives';
        continue;
      }

      if (line.startsWith('## Bots') || line.startsWith('## Agents')) {
        currentSection = 'bots';
        continue;
      }

      // Process section lines
      if (currentSection === 'scenario_prompt') {
        scenarioPromptLines.push(lines[i]);
        continue;
      }

      if (currentSection === 'meta') {
        const vMatch = line.match(/^[-*+=\d.]*\s*Version\s*[:=]\s*(.*)$/i);
        const pMatch = line.match(/^[-*+=\d.]*\s*(Scenario\s*Prompt|ScenarioPrompt|System\s*Prompt)\s*[:=]\s*(.*)$/i);
        if (vMatch) {
          version = vMatch[1].trim();
        } else if (pMatch) {
          scenarioPrompt = pMatch[2].trim();
        } else if (!line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
          description = line;
        }
      } else if (currentSection === 'world_config') {
        const seedMatch = line.match(/^[-*+=\d.]*\s*Seed\s*[:=]\s*(.*)$/i);
        const gameModeMatch = line.match(/^[-*+=\d.]*\s*(Game\s*Mode|GameMode|game_mode)\s*[:=]\s*(.*)$/i);
        const difficultyMatch = line.match(/^[-*+=\d.]*\s*Difficulty\s*[:=]\s*(.*)$/i);
        const portMatch = line.match(/^[-*+=\d.]*\s*Port\s*[:=]\s*(.*)$/i);
        const levelNameMatch = line.match(/^[-*+=\d.]*\s*(LevelName|Level\s*Name|level_name|level-name)\s*[:=]\s*(.*)$/i);

        if (seedMatch) {
          worldConfig.seed = seedMatch[1].trim();
        } else if (gameModeMatch) {
          const gm = gameModeMatch[2].trim().toLowerCase();
          worldConfig.gameMode = gm;
          worldConfig.game_mode = gm;
        } else if (difficultyMatch) {
          worldConfig.difficulty = difficultyMatch[1].trim().toLowerCase();
        } else if (portMatch) {
          const p = parseInt(portMatch[1].trim(), 10);
          if (!isNaN(p)) worldConfig.port = p;
        } else if (levelNameMatch) {
          const ln = levelNameMatch[2].trim();
          worldConfig.levelName = ln;
          worldConfig.level_name = ln;
        }
      } else if (currentSection === 'objectives') {
        const itemMatch = line.match(/^[-*+]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
        if (itemMatch) {
          objectives.push(itemMatch[1].trim());
        }
      } else if (currentSection === 'bots') {
        // Checking for a new bot header
        if (line.startsWith('### Bot:') || line.startsWith('### Agent:') || line.startsWith('### ')) {
          if (currentBot && currentBot.name) {
            bots.push(ScenarioService.finalizeBot(currentBot));
          }
          const name = line.replace(/^###\s*(Bot:|Agent:)?\s*/i, '').trim();
          currentBot = {
            id: `bot_${Math.random().toString(36).substr(2, 9)}`,
            name,
            role: 'Assistant',
            goal: 'Survive and explore',
            providerId: 'gemini',
            model: 'gemini-3.5-flash',
            inventory: {},
            x: Math.floor(Math.random() * 20) - 10,
            y: 64,
            z: Math.floor(Math.random() * 20) - 10,
            health: 20,
            food: 20,
          };
        } else if (currentBot) {
          const roleMatch = line.match(/^[-*+=\d.]*\s*Role\s*[:=]\s*(.*)$/i);
          const goalMatch = line.match(/^[-*+=\d.]*\s*Goal\s*[:=]\s*(.*)$/i);
          const providerMatch = line.match(/^[-*+=\d.]*\s*Provider\s*[:=]\s*(.*)$/i);
          const modelMatch = line.match(/^[-*+=\d.]*\s*Model\s*[:=]\s*(.*)$/i);
          const charPromptMatch = line.match(/^[-*+=\d.]*\s*(Character\s*Prompt|CharacterPrompt|character_prompt)\s*[:=]\s*(.*)$/i);
          const behPromptMatch = line.match(/^[-*+=\d.]*\s*(Behavior\s*Prompt|BehaviorPrompt|behavior_prompt)\s*[:=]\s*(.*)$/i);
          const posMatch = line.match(/^[-*+=\d.]*\s*Position\s*[:=]\s*(.*)$/i);
          const invMatch = line.match(/^[-*+=\d.]*\s*Inventory\s*[:=]\s*(.*)$/i);

          if (roleMatch) {
            currentBot.role = roleMatch[1].trim();
          } else if (goalMatch) {
            currentBot.goal = goalMatch[1].trim();
          } else if (providerMatch) {
            currentBot.providerId = providerMatch[1].trim().toLowerCase();
          } else if (modelMatch) {
            currentBot.model = modelMatch[1].trim();
          } else if (charPromptMatch) {
            const val = charPromptMatch[2].trim();
            currentBot.characterPrompt = val;
            currentBot.character_prompt = val;
          } else if (behPromptMatch) {
            const val = behPromptMatch[2].trim();
            currentBot.behaviorPrompt = val;
            currentBot.behavior_prompt = val;
          } else if (posMatch) {
            const posStr = posMatch[1].trim();
            const coords = posStr.split(',').map(c => parseInt(c.trim(), 10));
            if (coords.length >= 3 && coords.every(c => !isNaN(c))) {
              currentBot.x = coords[0];
              currentBot.y = coords[1];
              currentBot.z = coords[2];
            }
          } else if (invMatch) {
            const invStr = invMatch[1].trim();
            const items = invStr.split(',').map(item => item.trim());
            const inv: Record<string, number> = {};
            items.forEach(it => {
              const parts = it.split(':');
              if (parts.length === 2) {
                const count = parseInt(parts[1].trim(), 10);
                inv[parts[0].trim()] = isNaN(count) ? 1 : count;
              } else {
                inv[it] = 1;
              }
            });
            currentBot.inventory = inv;
          }
        }
      }
    }

    // Push last bot if exists
    if (currentBot && currentBot.name) {
      bots.push(ScenarioService.finalizeBot(currentBot));
    }

    const finalPrompt = scenarioPrompt || (scenarioPromptLines.length > 0 ? scenarioPromptLines.join('\n').trim() : undefined);

    return {
      title,
      description,
      version,
      objectives: objectives.length > 0 ? objectives : ['Explore the Minecraft world'],
      bots: bots.length > 0 ? bots : [this.getDefaultBot('LumberjackBob')],
      scenarioPrompt: finalPrompt,
      scenario_prompt: finalPrompt,
      worldConfig: Object.keys(worldConfig).length > 0 ? worldConfig : undefined,
    };
  }

  private static finalizeBot(bot: Partial<BotConfig>): BotConfig {
    const characterPrompt = bot.characterPrompt || bot.character_prompt;
    const behaviorPrompt = bot.behaviorPrompt || bot.behavior_prompt;
    return {
      id: bot.id || `bot_${Math.random().toString(36).substr(2, 9)}`,
      name: bot.name || 'Minebot',
      role: bot.role || 'Assistant',
      goal: bot.goal || 'Explore',
      providerId: bot.providerId || 'gemini',
      model: bot.model || 'gemini-3.5-flash',
      inventory: bot.inventory || {},
      x: bot.x ?? 0,
      y: bot.y ?? 64,
      z: bot.z ?? 0,
      health: bot.health ?? 20,
      food: bot.food ?? 20,
      characterPrompt,
      character_prompt: characterPrompt,
      behaviorPrompt,
      behavior_prompt: behaviorPrompt,
    };
  }

  private static getDefaultBot(name: string): BotConfig {
    return {
      id: `bot_${Math.random().toString(36).substr(2, 9)}`,
      name,
      role: 'Woodcutter',
      goal: 'Harvest Oak Wood Planks and craft crafting table',
      providerId: 'gemini',
      model: 'gemini-3.5-flash',
      inventory: { 'stone_axe': 1 },
      x: 0,
      y: 64,
      z: 0,
      health: 20,
      food: 20,
    };
  }

  /**
   * Validates a parsed Scenario object. Throws error if invalid.
   */
  public static validate(scenario: Scenario): void {
    if (!scenario.title || scenario.title.trim() === '') {
      throw new Error('Scenario must have a title.');
    }
    if (!scenario.objectives || scenario.objectives.length === 0) {
      throw new Error('Scenario must have at least one objective.');
    }
    if (!scenario.bots || scenario.bots.length === 0) {
      throw new Error('Scenario must define at least one bot.');
    }
    scenario.bots.forEach(bot => {
      if (!bot.name || bot.name.trim() === '') {
        throw new Error('Bot must have a valid name.');
      }
      if (!bot.role || bot.role.trim() === '') {
        throw new Error(`Bot ${bot.name} must have a specified role.`);
      }
      if (!bot.goal || bot.goal.trim() === '') {
        throw new Error(`Bot ${bot.name} must have a specified goal.`);
      }
      if (typeof bot.x !== 'number' || typeof bot.y !== 'number' || typeof bot.z !== 'number') {
        throw new Error(`Bot ${bot.name} coordinates must be numbers.`);
      }
    });
  }
}

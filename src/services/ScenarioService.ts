import { Scenario, BotConfig, GameMode } from '../types/index.js';

export class ScenarioService {
  /**
   * Parses scenario Markdown text into a structured Scenario object.
   */
  public static parseMarkdown(markdown: string): Scenario {
    const lines = markdown.split('\n');
    let title = 'Default Minecraft Scenario';
    let description = 'A simulation run.';
    let scenarioPrompt: string | undefined = undefined;
    const objectives: string[] = [];
    const bots: BotConfig[] = [];
    const worldConfig: { seed?: string; gameMode?: string; difficulty?: string; port?: number; levelName?: string; properties?: Record<string, string> } = {};

    let currentSection: 'meta' | 'objectives' | 'bots' | 'world_config' | 'none' = 'meta';
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
      if (currentSection === 'meta') {
        if (line.startsWith('- Scenario Prompt:') || line.startsWith('* Scenario Prompt:') || line.startsWith('- ScenarioPrompt:') || line.startsWith('* ScenarioPrompt:') || line.startsWith('- System Prompt:') || line.startsWith('* System Prompt:')) {
          scenarioPrompt = line.replace(/^[-*]\s*(Scenario\s*Prompt|ScenarioPrompt|System\s*Prompt):\s*/i, '').trim();
        } else if (!line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
          description = line;
        }
      } else if (currentSection === 'world_config') {
        if (line.startsWith('- Seed:') || line.startsWith('* Seed:')) {
          worldConfig.seed = line.replace(/^[-*]\s*Seed:\s*/i, '').trim();
        } else if (line.startsWith('- GameMode:') || line.startsWith('* GameMode:')) {
          worldConfig.gameMode = line.replace(/^[-*]\s*GameMode:\s*/i, '').trim().toLowerCase();
        } else if (line.startsWith('- Difficulty:') || line.startsWith('* Difficulty:')) {
          worldConfig.difficulty = line.replace(/^[-*]\s*Difficulty:\s*/i, '').trim().toLowerCase();
        } else if (line.startsWith('- Port:') || line.startsWith('* Port:')) {
          const p = parseInt(line.replace(/^[-*]\s*Port:\s*/i, '').trim(), 10);
          if (!isNaN(p)) worldConfig.port = p;
        } else if (line.startsWith('- LevelName:') || line.startsWith('* LevelName:') || line.startsWith('- Level Name:') || line.startsWith('* Level Name:') || line.startsWith('- level-name:') || line.startsWith('* level-name:')) {
          worldConfig.levelName = line.replace(/^[-*]\s*(LevelName|Level\s*Name|level-name):\s*/i, '').trim();
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
            bots.push(this.finalizeBot(currentBot));
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
          // Parse bot fields
          if (line.startsWith('- Role:') || line.startsWith('* Role:')) {
            currentBot.role = line.replace(/^[-*]\s*Role:\s*/i, '').trim();
          } else if (line.startsWith('- Goal:') || line.startsWith('* Goal:')) {
            currentBot.goal = line.replace(/^[-*]\s*Goal:\s*/i, '').trim();
          } else if (line.startsWith('- Provider:') || line.startsWith('* Provider:')) {
            currentBot.providerId = line.replace(/^[-*]\s*Provider:\s*/i, '').trim().toLowerCase();
          } else if (line.startsWith('- Model:') || line.startsWith('* Model:')) {
            currentBot.model = line.replace(/^[-*]\s*Model:\s*/i, '').trim();
          } else if (line.startsWith('- Character Prompt:') || line.startsWith('* Character Prompt:') || line.startsWith('- CharacterPrompt:') || line.startsWith('* CharacterPrompt:')) {
            currentBot.characterPrompt = line.replace(/^[-*]\s*(Character\s*Prompt|CharacterPrompt):\s*/i, '').trim();
          } else if (line.startsWith('- Behavior Prompt:') || line.startsWith('* Behavior Prompt:') || line.startsWith('- BehaviorPrompt:') || line.startsWith('* BehaviorPrompt:')) {
            currentBot.behaviorPrompt = line.replace(/^[-*]\s*(Behavior\s*Prompt|BehaviorPrompt):\s*/i, '').trim();
          } else if (line.startsWith('- Position:') || line.startsWith('* Position:')) {
            const posStr = line.replace(/^[-*]\s*Position:\s*/i, '').trim();
            const coords = posStr.split(',').map(c => parseInt(c.trim(), 10));
            if (coords.length >= 3 && coords.every(c => !isNaN(c))) {
              currentBot.x = coords[0];
              currentBot.y = coords[1];
              currentBot.z = coords[2];
            }
          } else if (line.startsWith('- Inventory:') || line.startsWith('* Inventory:')) {
            const invStr = line.replace(/^[-*]\s*Inventory:\s*/i, '').trim();
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
      bots.push(this.finalizeBot(currentBot));
    }

    return {
      title,
      description,
      objectives: objectives.length > 0 ? objectives : ['Explore the Minecraft world'],
      bots: bots.length > 0 ? bots : [this.getDefaultBot('LumberjackBob')],
      scenarioPrompt,
      worldConfig: Object.keys(worldConfig).length > 0 ? worldConfig : undefined,
    };
  }

  private static finalizeBot(bot: Partial<BotConfig>): BotConfig {
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

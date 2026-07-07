import { describe, it, expect } from 'vitest';
import { ScenarioService } from '../services/ScenarioService.js';
import { GameMode } from '../types/index.js';

describe('ScenarioService', () => {
  it('should parse a valid Markdown scenario into a structured Scenario object', () => {
    const md = `
# Scenario: Forest Survival Run

A deep wilderness survival test for Mineflayer bots.

## World Configuration
- Seed: 987654321
- GameMode: survival
- Difficulty: hard
- Port: 25565

## Objectives
- Gather 5 oak wood blocks
- Craft a wooden pickaxe
- Locate coal ore

## Bots
### Bot: LumberjackBob
- Role: Timber Harvester
- Goal: Chop trees and manage charcoal stocks
- Provider: gemini
- Model: gemini-2.5-flash
- Position: 10, 64, -20
- Inventory: stone_axe:1, bread:5
    `;

    const scenario = ScenarioService.parseMarkdown(md);

    expect(scenario.title).toBe('Forest Survival Run');
    expect(scenario.description).toBe('A deep wilderness survival test for Mineflayer bots.');
    expect(scenario.worldConfig?.seed).toBe('987654321');
    expect(scenario.worldConfig?.gameMode).toBe('survival');
    expect(scenario.worldConfig?.difficulty).toBe('hard');
    expect(scenario.worldConfig?.port).toBe(25565);
    
    expect(scenario.objectives).toContain('Gather 5 oak wood blocks');
    expect(scenario.objectives).toContain('Craft a wooden pickaxe');
    expect(scenario.objectives).toContain('Locate coal ore');

    expect(scenario.bots.length).toBe(1);
    const bob = scenario.bots[0];
    expect(bob.name).toBe('LumberjackBob');
    expect(bob.role).toBe('Timber Harvester');
    expect(bob.goal).toBe('Chop trees and manage charcoal stocks');
    expect(bob.providerId).toBe('gemini');
    expect(bob.model).toBe('gemini-2.5-flash');
    expect(bob.x).toBe(10);
    expect(bob.y).toBe(64);
    expect(bob.z).toBe(-20);
    expect(bob.inventory).toEqual({ stone_axe: 1, bread: 5 });
  });

  it('should correctly validate a parsed scenario object', () => {
    const validScenario = {
      title: 'Valid Scenario',
      description: 'Desc',
      objectives: ['Objective 1'],
      bots: [
        {
          id: 'bot_1',
          name: 'Botty',
          role: 'Scout',
          goal: 'Explore',
          providerId: 'gemini',
          model: 'gemini-3.5-flash',
          inventory: {},
          x: 0,
          y: 64,
          z: 0,
          health: 20,
          food: 20,
        }
      ]
    };

    expect(() => ScenarioService.validate(validScenario)).not.toThrow();
  });

  it('should throw validation error if title is empty', () => {
    const invalidScenario = {
      title: '',
      description: 'Desc',
      objectives: ['Objective 1'],
      bots: []
    };

    expect(() => ScenarioService.validate(invalidScenario)).toThrow('Scenario must have a title.');
  });

  it('should throw validation error if objectives list is empty', () => {
    const invalidScenario = {
      title: 'No Objectives Scenario',
      description: 'Desc',
      objectives: [],
      bots: []
    };

    expect(() => ScenarioService.validate(invalidScenario)).toThrow('Scenario must have at least one objective.');
  });
});

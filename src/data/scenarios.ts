export const DEFAULT_SCENARIOS = [
  {
    title: 'Wood Harvesting Challenge',
    description: 'Bots coordinate to harvest Oak logs and assemble a crafting table on the server.',
    markdown: `# Scenario: Wood Harvesting Challenge
A challenge where bots coordinate to gather wood and craft basic tools.

## Objectives
- Gather 16 Oak Logs
- Craft 16 Oak Wood Planks
- Craft 1 Crafting Table
- Assemble and place the crafting table

## Bots
### Bot: LumberjackBob
- Role: Primary wood harvester
- Goal: Move to oak logs, harvest them, and tell Sally when finished
- Provider: gemini
- Model: gemini-3.5-flash
- Position: 4, 64, 4
- Inventory: wooden_axe: 1

### Bot: CrafterSally
- Role: Tool and table craftsman
- Goal: Ask Bob for wood, receive planks, and place a crafting table
- Provider: gemini
- Model: gemini-3.5-flash
- Position: -3, 64, -2
- Inventory: sticks: 4
`,
  },
  {
    title: 'Survival Sheltering Task',
    description: 'Agents coordinate to gather cobblestone, secure wood, and build a protective grid boundary.',
    markdown: `# Scenario: Survival Sheltering Task
Agents build a secure parameter out of stone and wood to prepare for nightfall.

## Objectives
- Mine 8 Cobblestone blocks
- Collect 8 Oak Wood logs
- Construct a 4x4 stone boundary
- Place a torch or marker block

## Bots
### Bot: BuilderBen
- Role: Structural architect
- Goal: Receives stone, builds a flat 4x4 foundation wall, and keeps guard
- Provider: gemini
- Model: gemini-3.5-flash
- Position: 8, 64, -6
- Inventory: stone_pickaxe: 1

### Bot: GathererGaby
- Role: Resource miner
- Goal: Locates stone hills, mines cobblestone, and delivers to BuilderBen
- Provider: gemini
- Model: gemini-3.5-flash
- Position: -8, 64, 7
- Inventory: iron_pickaxe: 1, coal: 2
`,
  },
  {
    title: 'Colleague Exploration & Chat',
    description: 'An interactive conversation and spatial walk across the server between agents.',
    markdown: `# Scenario: Colleague Exploration
Agents map out the server map coordinates together and exchange research ideas.

## Objectives
- Traverse from corner to corner
- Chat with team members to discuss world seeds
- Share coordinates of interesting formations

## Bots
### Bot: ExplorerEli
- Role: Field cartographer
- Goal: Move around corners, search for lakes, and talk with Ava
- Provider: gemini
- Model: gemini-3.5-flash
- Position: -10, 64, -10
- Inventory: map: 1

### Bot: SurveyorAva
- Role: Landscape analyst
- Goal: Stand near center, verify grid levels, and log findings in chat
- Provider: gemini
- Model: gemini-3.5-flash
- Position: 2, 64, 2
- Inventory: compass: 1
`,
  }
];

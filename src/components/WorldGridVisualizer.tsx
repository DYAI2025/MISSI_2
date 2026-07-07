import React, { useState } from 'react';
import { WorldBlock, BotConfig } from '../types/index.js';
import { Compass, Info, User } from 'lucide-react';

interface WorldGridVisualizerProps {
  worldGrid: WorldBlock[];
  bots: BotConfig[];
}

export const WorldGridVisualizer: React.FC<WorldGridVisualizerProps> = ({
  worldGrid,
  bots,
}) => {
  const [hoveredBlock, setHoveredBlock] = useState<{ x: number; z: number; type: string } | null>(null);

  // Define grid layout limits
  // Map coordinates run from -15 to 14
  const minCoord = -15;
  const maxCoord = 14;
  const gridSize = 30;

  // Render color styles for block types
  const getBlockColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'water': return 'bg-sky-650 border border-sky-800/30';
      case 'stone': return 'bg-slate-600 border border-slate-700/30';
      case 'oak_log': return 'bg-amber-800 border border-amber-950/20';
      case 'crafting_table': return 'bg-brand-green border border-brand-green/40 ring-1 ring-brand-green/30';
      case 'grass_block': return 'bg-emerald-800 border border-emerald-900/20';
      case 'air': return 'bg-brand-bg border border-brand-border/10';
      default: return 'bg-emerald-700 border border-emerald-800/20';
    }
  };

  // Build matrix for grid render
  const matrix: (WorldBlock | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

  worldGrid.forEach((block) => {
    // Translate coords (-15 to 14) to indexes (0 to 29)
    const row = block.z - minCoord;
    const col = block.x - minCoord;

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      matrix[row][col] = block;
    }
  });

  return (
    <div id="world-grid-visualizer" className="bg-brand-aside border border-brand-border rounded-none p-4 shadow-none flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-brand-green" />
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-muted font-bold">Spatial Vector Map // LOCATIONS</h2>
        </div>
        <div className="text-[9px] font-mono text-brand-muted flex items-center gap-1 bg-brand-bg border border-brand-border px-2 py-0.5 rounded-none uppercase">
          <span>Dimensions: 30x30 coordinates</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 flex-grow">
        {/* Left Column: Visual Map Matrix */}
        <div className="xl:col-span-3 flex justify-center items-center bg-brand-bg rounded-none border border-brand-border p-4 overflow-auto">
          <div className="relative">
            {/* The grid of blocks */}
            <div className="grid grid-cols-30 gap-[1px] bg-brand-border p-0.5 border border-brand-border/80 rounded-none select-none">
              {matrix.map((rowArr, zIdx) => (
                <div key={zIdx} className="contents">
                  {rowArr.map((block, xIdx) => {
                    const actualX = xIdx + minCoord;
                    const actualZ = zIdx + minCoord;

                    // Check if a bot stands here
                    const standingBots = bots.filter(
                      (b) => b.x === actualX && b.z === actualZ
                    );

                    return (
                      <div
                        key={xIdx}
                        className={`w-3 h-3 sm:w-4 sm:h-4 rounded-none relative cursor-crosshair transition-all hover:scale-125 hover:z-20 ${
                          block ? getBlockColor(block.type) : 'bg-brand-bg'
                        }`}
                        onMouseEnter={() =>
                          setHoveredBlock({
                            x: actualX,
                            z: actualZ,
                            type: block ? block.type : 'air',
                          })
                        }
                        onMouseLeave={() => setHoveredBlock(null)}
                      >
                        {/* Render bot pin if stands on this coordinate */}
                        {standingBots.length > 0 && (
                          <div className="absolute inset-0 bg-brand-green rounded-none flex items-center justify-center border border-brand-bg text-[8px] font-mono font-bold text-brand-bg shadow-none animate-pulse z-10">
                            {standingBots[0].name[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Key Legends & Selected Inspector */}
        <div className="xl:col-span-1 space-y-4 flex flex-col justify-between">
          <div className="bg-brand-bg border border-brand-border rounded-none p-3.5">
            <h3 className="text-[10px] font-mono font-bold text-brand-green uppercase tracking-widest mb-3 block">// MAP SYMBOLOGY</h3>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase">
              <div className="flex items-center gap-1.5 text-brand-text">
                <span className="w-3 h-3 rounded-none bg-emerald-800 border border-emerald-900/20" />
                <span>Grass</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-text">
                <span className="w-3 h-3 rounded-none bg-sky-650 border border-sky-800/20" />
                <span>Water</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-text">
                <span className="w-3 h-3 rounded-none bg-slate-600 border border-slate-700/20" />
                <span>Stone</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-text">
                <span className="w-3 h-3 rounded-none bg-amber-800 border border-amber-950/20" />
                <span>Oak Log</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-text">
                <span className="w-3 h-3 rounded-none bg-brand-green border border-brand-green/40" />
                <span>Crafting</span>
              </div>
            </div>
          </div>

          {/* Active Bot position stats */}
          <div className="bg-brand-bg border border-brand-border rounded-none p-3.5">
            <h3 className="text-[10px] font-mono font-bold text-brand-green uppercase tracking-widest mb-2.5 block">// ENTITY GPS COORDS</h3>
            {bots.length > 0 ? (
              <div className="space-y-2 font-mono">
                {bots.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs border-b border-brand-border/40 pb-1.5 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-1.5 text-brand-text">
                      <User className="w-3.5 h-3.5 text-brand-green" />
                      <span>{b.name}</span>
                    </div>
                    <span className="font-mono text-brand-green font-bold">
                      X:{b.x} | Z:{b.z}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] font-mono text-brand-muted uppercase italic">No active entities located.</div>
            )}
          </div>

          {/* Hover block details inspector */}
          <div className="bg-brand-bg border border-brand-border rounded-none p-3.5 flex-grow min-h-[90px] flex flex-col justify-center">
            {hoveredBlock ? (
              <div className="space-y-1 font-mono uppercase">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-green">
                  <Info className="w-3.5 h-3.5" />
                  <span>BLOCK INSPECTOR</span>
                </div>
                <div className="text-xs text-brand-text font-bold">TYPE: <span className="text-brand-green">{hoveredBlock.type}</span></div>
                <div className="text-[10px] text-brand-muted">VECTORS: [X: {hoveredBlock.x}, Z: {hoveredBlock.z}]</div>
              </div>
            ) : (
              <div className="text-center text-[10px] text-brand-muted italic font-mono uppercase tracking-tight">
                Hover cells to parse coordinates
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

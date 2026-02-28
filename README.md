## System Overview

AetherShips is a pixel art game with the following core architecture:

### Data Storage Pipeline

```
Each Block
└─ State Data (32 bits) → type, color, health, is_burning
    ↓
Chunk (Custom HTMLElement)
├─ position: (x, y)
├─ block_count: number of non-empty blocks (deleted when 0)
├─ dirty: boolean (whether the chunk needs to be re-rendered)
├─ groups (rectangles of contiguous utility blocks)
│  ├─ coords (x, y, w, h)
│  └─ type (battery, engine, etc.)
├─ layers (floor/background, walls/interactables, exterior/top)
│  ├─ blocks: Uint32Array[1024] (32x32 blocks)
│  ├─ blocks_ctx: CanvasRenderingContext2D (for rendering)
│  └─ glow_ctx: CanvasRenderingContext2D (for rendering glow effects)
└─ Canvas DOM children with 32x32 resolution
    ↓
Entity (Custom HTMLElement) (ship, asteroid, planet, etc.)
├─ position (x, y, r)
├─ velocity (vx, vy, vr)
├─ mass (cmx, cmy, mass)
└─ Chunk DOM children
    ↓
Game (Custom HTMLElement)
└─ Entity DOM children
```

### Data Storage Pipeline

```
Each Block
└─ State Data (32 bits) → type, color, health, is_burning
    ↓
Layer (3 per chunk: floor/background, walls/interactables, exterior/top)
├─ blocks: Uint32Array[1024] (32x32 blocks)
├─ block_count: number of non-empty blocks
├─ glow_count: number of glowing blocks
├─ dirty: boolean for render tracking
├─ main canvas & context: CanvasRenderingContext2D (for rendering)
├─ main_img_data & buf: ImageData & Uint32Array (for pixel manipulation)
├─ glow canvas & context: CanvasRenderingContext2D (for glow effects)
└─ glow_img_data & buf: ImageData & Uint32Array (for glow pixel manipulation)
    ↓
Chunk (Custom HTMLElement)
├─ position: (x, y)
├─ block_count: sum of all layer block counts (chunk deleted when 0)
├─ glow_count: sum of all layer glow counts
├─ groups (rectangles of contiguous utility blocks)
│  ├─ coords (x, y, w, h)
│  └─ type (battery, engine, etc.)
├─ layers: Array[3] of Layer instances
└─ Canvas DOM children with 32x32 resolution (from layers)
    ↓
Entity (Custom HTMLElement) (ship, asteroid, planet, etc.)
├─ position (x, y, r)
├─ velocity (vx, vy, vr)
├─ mass (cx, cy, mass)
├─ dirty_layers: Array of layers needing render
└─ Chunk DOM children
    ↓
Game (Custom HTMLElement)
└─ Entity DOM children
```

### Entity DOM and JS Structure

```
Game (Custom HTMLElement)
└─ global data (seed, galaxy name...)
    ↓
Entity (Custom HTMLElement) (ship, asteroid, planet, etc.)
├─ position (x, y, r)
├─ velocity (vx, vy, vr)
├─ mass (cx, cy, mass)
├─ groups (rectangles of contiguous utility blocks)
│  ├─ coords (x, y, w, h)
│  └─ block type
└─ dirty_layers: Array of layers needing render
    ↓
EntityLayer (3 per entity: floor/background, walls/interactables, exterior/top)
├─ blocks: Uint32Array[1024] (32x32 blocks)
├─ block_count: number of non-empty blocks
├─ glow_count: number of glowing blocks
├─ dirty: boolean for render tracking
├─ main context: CanvasRenderingContext2D (for rendering)
├─ main_img_data & buf: ImageData & Uint32Array (for pixel manipulation)
├─ glow context: CanvasRenderingContext2D (for glow effects)
└─ glow_img_data & buf: ImageData & Uint32Array (for glow pixel manipulation)
    ↓
Canvas 32x32 (block color pixels, glow)
```

_Note: Layers and chunk data are managed in-memory and rendered via canvases, but are not saved as separate files. Only entity-level data is persisted to disk._

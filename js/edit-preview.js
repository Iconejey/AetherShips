/**
 * Canvas overlay that renders a pixelized tool preview in edit mode.
 * Each block that would be affected by the active tool is highlighted on screen,
 * aligned to the followed entity's block grid using the camera transform.
 */
class EditPreview extends HTMLElement {
	constructor() {
		super();
		this.canvas = null;
		this.ctx = null;
		this.mouse_x = 0;
		this.mouse_y = 0;
		this.drag_start_block_x = null;
		this.drag_start_block_y = null;
		this.is_dragging = false;
		this.raf_id = null;
	}

	connectedCallback() {
		this.canvas = document.createElement('canvas');
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.appendChild(this.canvas);
		this.ctx = this.canvas.getContext('2d');

		window.addEventListener('mousemove', e => this.onMouseMove(e));
		window.addEventListener('mousedown', e => this.onMouseDown(e));
		window.addEventListener('mouseup', () => this.onMouseUp());
		window.addEventListener('resize', () => this.onResize());

		this.scheduleDraw();
	}

	disconnectedCallback() {
		if (this.raf_id !== null) {
			cancelAnimationFrame(this.raf_id);
			this.raf_id = null;
		}
	}

	onResize() {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
	}

	onMouseMove(e) {
		this.mouse_x = e.clientX;
		this.mouse_y = e.clientY;
	}

	onMouseDown(e) {
		if (game?.mode !== 'edit') return;
		if (game.isSpacePressed()) return;

		const tool = game.selected_tool;
		if (tool === 'pen') return;

		const block = this.screenToBlock(this.mouse_x, this.mouse_y);
		if (!block) return;

		this.drag_start_block_x = block.bx;
		this.drag_start_block_y = block.by;
		this.is_dragging = true;
	}

	onMouseUp() {
		this.is_dragging = false;
		this.drag_start_block_x = null;
		this.drag_start_block_y = null;
	}

	scheduleDraw() {
		this.raf_id = requestAnimationFrame(() => {
			this.draw();
			this.scheduleDraw();
		});
	}

	/**
	 * Returns the entity-space info needed to project between block and screen coords.
	 * Uses entity.style.left/top (set each frame by updateEntityPositions) so the
	 * inspect_offset is already baked in — no separate modulo bookkeeping required.
	 * @returns {{ entity_left: number, entity_top: number, entity_rotation: number, scale: number }|null}
	 */
	getEntityInfo() {
		const entity = game?.camera?.followed_entity;
		if (!entity) return null;

		const entity_left = parseFloat(entity.style.left);
		const entity_top = parseFloat(entity.style.top);
		if (isNaN(entity_left) || isNaN(entity_top)) return null;

		const entity_rotation = entity.position.r - game.camera.r;
		const scale = game.scale;

		return { entity_left, entity_top, entity_rotation, scale };
	}

	/**
	 * Converts viewport screen coordinates to the entity's integer block coordinates.
	 * To keep the grid aligned with the rendered pixels, `entity_left` already carries
	 * `inspect_offset_screen_x % scale` worth of subpixel shift from the camera update.
	 * @param {number} sx
	 * @param {number} sy
	 * @returns {{ bx: number, by: number }|null}
	 */
	screenToBlock(sx, sy) {
		const info = this.getEntityInfo();
		if (!info) return null;

		const { entity_left, entity_top, entity_rotation, scale } = info;
		const dx = sx - entity_left;
		const dy = sy - entity_top;

		// Undo entity rotation to reach axis-aligned entity CSS space
		const cos_r = Math.cos(-entity_rotation);
		const sin_r = Math.sin(-entity_rotation);
		const unrot_x = dx * cos_r - dy * sin_r;
		const unrot_y = dx * sin_r + dy * cos_r;

		return {
			bx: Math.floor(unrot_x / scale),
			by: Math.floor(unrot_y / scale)
		};
	}

	// ── Shape generators ──────────────────────────────────────────────────────

	getRectBlocks(x1, y1, x2, y2) {
		const min_x = Math.min(x1, x2);
		const max_x = Math.max(x1, x2);
		const min_y = Math.min(y1, y2);
		const max_y = Math.max(y1, y2);

		const blocks = [];
		for (let y = min_y; y <= max_y; y++) {
			for (let x = min_x; x <= max_x; x++) {
				blocks.push([x, y]);
			}
		}
		return blocks;
	}

	/**
	 * Matches entity.fillEllipse's rasterization: bounding box (x1,y1)→(x2,y2),
	 * blocks included when their unit-circle normalized centre is within the ellipse.
	 */
	getEllipseBlocks(x1, y1, x2, y2) {
		const min_x = Math.min(x1, x2);
		const max_x = Math.max(x1, x2);
		const min_y = Math.min(y1, y2);
		const max_y = Math.max(y1, y2);

		const w = max_x - min_x + 1;
		const h = max_y - min_y + 1;
		const half_w = w / 2;
		const half_h = h / 2;

		const blocks = [];
		for (let offset_y = 0; offset_y < h; offset_y++) {
			for (let offset_x = 0; offset_x < w; offset_x++) {
				const nx = (offset_x + 0.5 - half_w) / half_w;
				const ny = (offset_y + 0.5 - half_h) / half_h;
				if (nx * nx + ny * ny <= 1) {
					blocks.push([min_x + offset_x, min_y + offset_y]);
				}
			}
		}
		return blocks;
	}

	/** Bresenham's line rasterization */
	getLineBlocks(x1, y1, x2, y2) {
		const blocks = [];
		let dx = Math.abs(x2 - x1);
		let dy = Math.abs(y2 - y1);
		const sx = x1 < x2 ? 1 : -1;
		const sy = y1 < y2 ? 1 : -1;
		let err = dx - dy;
		let x = x1;
		let y = y1;

		while (true) {
			blocks.push([x, y]);
			if (x === x2 && y === y2) break;
			const e2 = 2 * err;
			if (e2 > -dy) {
				err -= dy;
				x += sx;
			}
			if (e2 < dx) {
				err += dx;
				y += sy;
			}
		}
		return blocks;
	}

	// ── Preview logic ─────────────────────────────────────────────────────────

	getPreviewBlocks() {
		const tool = game?.selected_tool;
		if (!tool) return [];

		const cursor = this.screenToBlock(this.mouse_x, this.mouse_y);
		if (!cursor) return [];

		const { bx, by } = cursor;

		// Before any drag starts, all shape tools show only the cursor block
		if (!this.is_dragging || this.drag_start_block_x === null) {
			return [[bx, by]];
		}

		const sx = this.drag_start_block_x;
		const sy = this.drag_start_block_y;

		if (tool === 'rectangle') return this.getRectBlocks(sx, sy, bx, by);
		if (tool === 'ellipse') return this.getEllipseBlocks(sx, sy, bx, by);
		if (tool === 'line') return this.getLineBlocks(sx, sy, bx, by);

		return [[bx, by]];
	}

	// ── Rendering ─────────────────────────────────────────────────────────────

	draw() {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (game?.mode !== 'edit') return;
		if (!game.camera?.followed_entity) return;

		const info = this.getEntityInfo();
		if (!info) return;

		const { entity_left, entity_top, entity_rotation, scale } = info;

		const preview_blocks = this.getPreviewBlocks();
		if (preview_blocks.length === 0) return;

		const edit_mode = $('side-bar multi-select#edit-mode')?.value;
		let fill_color, stroke_color;

		fill_color = {
			erase: '#ff3c3c4d',
			paint: '#ffc83c4d',
			place: '#ffffff4d'
		}[edit_mode];

		// Apply the same transform the entity-root CSS uses:
		//   translate(entity_left, entity_top)  →  rotate(entity_rotation)  →  scale(game_scale)
		// This maps entity block coord (bx, by) to screen pixel (bx * scale, by * scale) in the
		// rotated canvas coordinate system.
		ctx.save();
		ctx.translate(entity_left, entity_top);
		ctx.rotate(entity_rotation);

		// Fill pass — all preview blocks in one path for performance
		ctx.fillStyle = fill_color;
		ctx.beginPath();
		for (const [bx, by] of preview_blocks) {
			ctx.rect(bx * scale, by * scale, scale, scale);
		}
		ctx.fill();

		// Stroke pass — 1 px border on every block
		ctx.strokeStyle = stroke_color;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const [bx, by] of preview_blocks) {
			ctx.rect(bx * scale + 0.5, by * scale + 0.5, scale - 1, scale - 1);
		}

		ctx.restore();
	}
}

customElements.define('edit-preview', EditPreview);

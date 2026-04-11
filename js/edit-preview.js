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
		this.pen_is_down = false;
	}

	connectedCallback() {
		this.canvas = document.createElement('canvas');
		this.appendChild(this.canvas);
		this.ctx = this.canvas.getContext('2d');
		this.onResize();

		window.addEventListener('mousemove', e => this.onMouseMove(e));
		window.addEventListener('mousedown', e => this.onMouseDown(e));
		window.addEventListener('auxclick', e => this.onAuxClick(e));
		window.addEventListener('mouseup', () => this.onMouseUp());
		window.addEventListener('contextmenu', e => {
			if (game?.mode === 'edit') e.preventDefault();
		});
		window.addEventListener('keydown', e => this.onKeyDown(e));
		window.addEventListener('resize', () => this.onResize());
	}

	onResize() {
		const dpr = window.devicePixelRatio || 1;
		this.canvas.width = window.innerWidth * dpr;
		this.canvas.height = window.innerHeight * dpr;
	}

	isUiPointerEvent(event) {
		const target_element = event.target;
		if (!(target_element instanceof Element)) return false;
		return Boolean(target_element.closest('.ui'));
	}

	onMouseMove(e) {
		this.mouse_x = e.clientX;
		this.mouse_y = e.clientY;

		if (this.pen_is_down) {
			if (this.isUiPointerEvent(e)) return;
			const edit_mode = game.edit_mode;
			if (edit_mode === 'place' || edit_mode === 'erase' || edit_mode === 'paint') this.applyEdit();
		}
	}

	copyBlockUnderCursor(color_only = false) {
		const entity = game?.camera?.followed_entity;
		if (!entity) return;

		const cursor = this.screenToBlock(this.mouse_x, this.mouse_y);
		if (!cursor) return;

		const layer = game.selected_layer;
		const info = entity.getBlockInfo(layer, cursor.bx, cursor.by);
		if (info.is_empty) return;

		if (!color_only) game.selected_block = info.name;
		game.selected_paint_color = rgba8888ToHex(info.color);
	}

	onMouseDown(e) {
		if (game?.mode !== 'edit') return;
		if (game.isSpacePressed()) return;
		if (this.isUiPointerEvent(e)) return;
		const edit_mode = game.edit_mode;

		// Pick action
		if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
			e.preventDefault();
			return this.copyBlockUnderCursor(edit_mode === 'paint');
		}

		if (e.button !== 0) return;

		const tool = game.selected_tool;

		if (tool === 'pen') {
			this.pen_is_down = true;
			if (edit_mode === 'place' || edit_mode === 'erase' || edit_mode === 'paint') this.applyEdit();
			return;
		}

		const block = this.screenToBlock(this.mouse_x, this.mouse_y);
		if (!block) return;

		this.drag_start_block_x = block.bx;
		this.drag_start_block_y = block.by;
		this.is_dragging = true;
	}

	onMouseUp() {
		if (this.is_dragging) this.applyEdit();
		this.cancelDrag();
	}

	onAuxClick(e) {
		if (game?.mode !== 'edit') return;
		if (game.isSpacePressed()) return;
		if (this.isUiPointerEvent(e)) return;

		const edit_mode = $('side-bar multi-select#edit-mode')?.value;
		const is_pick_action = [1, 2, 3, 4].includes(e.button);
		if (edit_mode !== 'paint' || !is_pick_action) return;

		e.preventDefault();
		this.mouse_x = e.clientX;
		this.mouse_y = e.clientY;
		this.copyBlockColorUnderCursor();
	}

	onKeyDown(e) {
		if (e.key === 'Escape') {
			const edit_mode_select = $('side-bar multi-select#edit-mode');

			// Cancel dragging tool
			if (this.is_dragging) this.cancelDrag();
			// Cancel erase edit mode
			else if (game.edit_mode === 'erase') edit_mode_select.value = 'place';
			// Go back to pen tool
			else if (game.selected_tool !== 'pen') game.selected_tool = 'pen';
		}
	}

	cancelDrag() {
		this.is_dragging = false;
		this.pen_is_down = false;
		this.drag_start_block_x = null;
		this.drag_start_block_y = null;
	}

	applyEdit() {
		const entity = game?.camera?.followed_entity;
		if (!entity) return;

		const edit_mode = game.edit_mode;
		const layer = game.selected_layer;
		const block_name = game.selected_block;
		const selected_paint_color = hexToRgba8888(game.selected_paint_color);
		const blocks = this.getPreviewBlocks();
		if (blocks.length === 0) return;

		let has_any_change = false;
		for (const [bx, by] of blocks) {
			// Place mode
			if (edit_mode === 'place') {
				if (entity.setByName(layer, bx, by, block_name, selected_paint_color)) has_any_change = true;
			}

			// Erase mode
			else if (edit_mode === 'erase') {
				entity.deleteBlock(layer, bx, by);
				has_any_change = true;
			}

			// Paint mode
			else if (edit_mode === 'paint') {
				if (entity.paintBlock(layer, bx, by, selected_paint_color)) has_any_change = true;
			}
		}

		if (has_any_change) entity.render();
	}

	// scheduleDraw() removed; draw will be called by game loop

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

	/**
	 * Picks grid intervals so zooming out does not flood the screen with lines.
	 * When density gets too high, previous major lines become minor lines, then
	 * every 4 minor lines becomes the new major line.
	 * @param {number} scale
	 * @returns {{ minor_step: number, major_step: number }}
	 */
	getGridSteps(scale) {
		const min_minor_spacing_px = 32;
		let minor_step = 8;

		while (minor_step * scale < min_minor_spacing_px) {
			minor_step *= 4;
		}

		return {
			minor_step,
			major_step: minor_step * 4
		};
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

		const is_map_mode = document.body.classList.contains('map-mode');
		const is_edit_mode = window.game?.mode === 'edit';

		if (!is_edit_mode && !is_map_mode) return;
		if (!game.camera?.followed_entity) return;

		const info = this.getEntityInfo();
		if (!info) return;

		const { entity_left, entity_top, entity_rotation, scale } = info;
		const dpr = window.devicePixelRatio || 1;

		// Apply the translation first
		ctx.save();
		ctx.scale(dpr, dpr);
		ctx.translate(entity_left, entity_top);

		// ── Grid ─────────────────────────────────────────────────────────────
		// Compute the visible block range by over-extending by a few blocks to avoid clipping.
		const hw = window.innerWidth / 2 + entity_left;
		const hh = window.innerHeight / 2 + entity_top;
		const half_diag = Math.sqrt(hw * hw + hh * hh);
		const block_radius = Math.ceil(half_diag / scale) + 32;

		const first = -block_radius;
		const last = block_radius;

		// Map mode
		if (is_map_mode) {
			ctx.save();
			// Map mode aligns to the world, rotating opposite to camera
			ctx.rotate(-game.camera.r);

			const sector_size = 8192;

			// Get world position of the entity we're currently aligned to
			const entity = game.camera.followed_entity;

			// Adjust sector grid offset based on entity's world position.
			const entity_world_x = entity.position.x;
			const entity_world_y = entity.position.y;

			ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
			ctx.lineWidth = Math.min(3, 50 * scale);
			ctx.beginPath();

			for (let b = Math.ceil((first + entity_world_x) / sector_size) * sector_size; b <= last + entity_world_x; b += sector_size) {
				const x = (b - entity_world_x) * scale;
				ctx.moveTo(x, first * scale);
				ctx.lineTo(x, last * scale);
			}
			for (let b = Math.ceil((first + entity_world_y) / sector_size) * sector_size; b <= last + entity_world_y; b += sector_size) {
				const y = (b - entity_world_y) * scale;
				ctx.moveTo(first * scale, y);
				ctx.lineTo(last * scale, y);
			}
			ctx.stroke();
			ctx.restore();

			// Rotate block overlay previews with entity since they're attached to entity
			ctx.rotate(entity_rotation);
		}

		// Edit mode
		else {
			ctx.rotate(entity_rotation);
			const { minor_step, major_step } = this.getGridSteps(scale);

			// Minor lines every `minor_step` blocks
			ctx.strokeStyle = 'rgba(255,255,255,0.08)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let b = Math.ceil(first / minor_step) * minor_step; b <= last; b += minor_step) {
				if (b % major_step === 0) continue; // drawn in major pass
				ctx.moveTo(b * scale, first * scale);
				ctx.lineTo(b * scale, last * scale);
				ctx.moveTo(first * scale, b * scale);
				ctx.lineTo(last * scale, b * scale);
			}
			ctx.stroke();

			// Major lines every `major_step` blocks
			ctx.strokeStyle = 'rgba(255,255,255,0.22)';
			ctx.beginPath();
			for (let b = Math.ceil(first / major_step) * major_step; b <= last; b += major_step) {
				ctx.moveTo(b * scale, first * scale);
				ctx.lineTo(b * scale, last * scale);
				ctx.moveTo(first * scale, b * scale);
				ctx.lineTo(last * scale, b * scale);
			}
			ctx.stroke();
			// ─────────────────────────────────────────────────────────────────────

			// -x axis
			ctx.save();
			ctx.strokeStyle = '#d44141'; // red
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(-16, 0);
			ctx.stroke();
			ctx.restore();

			// -y axis
			ctx.save();
			ctx.strokeStyle = '#45bc49'; // green
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(0, -16);
			ctx.stroke();
			ctx.restore();
		}

		// Fill pass — all preview blocks in one path for performance
		if (is_edit_mode) {
			const preview_blocks = this.getPreviewBlocks();
			if (preview_blocks.length > 0) {
				const edit_mode = $('side-bar multi-select#edit-mode')?.value;
				const fill_color =
					{
						erase: '#ff3c3c4d',
						paint: '#ffc83c4d',
						place: '#ffffff4d'
					}[edit_mode] ?? '#ffffff4d';

				ctx.fillStyle = fill_color;
				ctx.beginPath();
				for (const [bx, by] of preview_blocks) {
					ctx.rect(bx * scale, by * scale, scale, scale);
				}
				ctx.fill();
			}
		}

		ctx.restore();
	}
}

customElements.define('edit-preview', EditPreview);

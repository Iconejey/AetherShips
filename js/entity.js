/**
 * Creates an object able to manipulate multiple attributes stored in a single uint32 inside a Uint32Array. The config is an array of [name, size_in_bits] pairs.
 * @param {Array} config - An array of [name, size_in_bits] pairs defining the structure.
 * @returns {Struct} A class that can manipulate the defined structure.
 * @example
 * const MyStruct = defineBitStruct([
 *   ['type', 4],
 *   ['health', 8],
 *   ['is_active', 1]
 * ]);
 *
 * const data = new Uint32Array(10);
 * const myStructInstance = new MyStruct();
 * myStructInstance.update(data, 0, { type: 5, health: 100, isActive: 1 });
 * console.log(myStructInstance.type.get(data, 0)); // 5
 * console.log(myStructInstance.health.get(data, 0)); // 100
 * console.log(myStructInstance.isActive.get(data, 0)); // 1
 */
class Struct {
	constructor(config) {
		let offset = 0;
		for (const [name, size] of config) {
			const field_offset = offset;
			this[name] = {
				get(arr, index) {
					const int32 = arr[index];
					return (int32 >>> field_offset) & ((1 << size) - 1);
				},
				set(arr, index, value) {
					const int32 = arr[index];
					arr[index] = (int32 & ~(((1 << size) - 1) << field_offset)) | ((value & ((1 << size) - 1)) << field_offset);
					return arr[index] !== int32; // Return true if the value was changed
				}
			};
			offset += size;
		}

		this.size = offset;
		this.config = config;

		if (this.size > 32) throw new Error(`BitStruct config exceeds 32 bits (total: ${this.size} bits)`);
	}

	/*
	 * Updates the values in the given Uint32Array at the specified index based on the provided object.
	 * @param {Uint32Array} arr - The array to update.
	 * @param {number} index - The index in the array to update.
	 * @param {Object} obj - An object containing the values to set, where keys correspond to the struct's field names.
	 */
	update(arr, index, obj) {
		let changed = false;
		for (const key in obj) {
			changed ||= this[key]?.set(arr, index, obj[key]);
		}
		return changed;
	}

	/*
	 * Converts the values at the specified index in the given Uint32Array into an object based on the struct's configuration.
	 * @param {Uint32Array} arr - The array to read from.
	 * @param {number} index - The index in the array to read.
	 * @returns {Object} An object containing the values of the struct's fields, where keys correspond to the field names.
	 */
	toObject(arr, index) {
		const obj = {};
		for (const [name] of this.config) {
			obj[name] = this[name].get(arr, index);
		}
		return obj;
	}
}

const state_struct = new Struct([
	['type', 8], // Needed for rules and block type identification
	['health', 7],
	['is_burning', 1]
]);

/**
 * Randomly selects one item from the provided array.
 * @param {Array} arr - The array to select from.
 * @returns {*} A random element from the array.
 */
function oneOf(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

let block_categories = {};
const blocks_by_type = {};
const blocks_by_name = {};

/**
 * Represents a single layer within a chunk, containing blocks and rendering surfaces
 */
class Layer {
	get entity() {
		return this.entity_layer.parentElement;
	}

	constructor(chunk_layer, layer_index, entity_layer) {
		this.chunk_layer = chunk_layer;
		this.entity_layer = entity_layer;
		this.layer_index = layer_index;
		this.block_states = new Uint32Array(1024); // 32x32 blocks (type, health, is_burning)
		this.block_colors = new Uint32Array(1024); // 32x32 colors (32-bit RGBA8888)
		this.block_count = 0;
		this.glow_count = 0;
		this.dirty = false;

		this.addCanvas('main');
	}

	/*
	 * Adds a canvas element to the layer for rendering either the main block colors or glow effects.
	 * @param {string} type - The type of canvas to add ('main' for block colors, 'glow' for glow effects).
	 */
	addCanvas(type) {
		const canvas = document.createElement('canvas');
		const size = type === 'glow' ? 33 : 32;
		canvas.width = size;
		canvas.height = size;
		if (type === 'glow') canvas.classList.add('glow');

		// Z-index within layer: main = 0, glow = 1
		const z_index_within_layer = type === 'glow' ? 1 : 0;
		canvas.style.zIndex = z_index_within_layer.toString();

		// Position canvas for its chunk
		canvas.style.left = `${this.chunk_layer.chunk_x * 32}px`;
		canvas.style.top = `${this.chunk_layer.chunk_y * 32}px`;

		const ctx = canvas.getContext('2d');
		const img_data = ctx.createImageData(size, size);
		const buf = new Uint32Array(img_data.data.buffer);

		this[type] = { canvas, ctx, img_data, buf };
		this.entity_layer.appendChild(canvas);
	}

	/**
	 * Puts the current image data onto the main canvas. Should be called after drawing pixels to update the visible layer.
	 */
	render() {
		this.main.ctx.putImageData(this.main.img_data, 0, 0);
		this.glow?.ctx.putImageData(this.glow.img_data, 0, 0);
		this.dirty = false;
	}

	/**
	 * Sets the block at the specified (x, y) coordinates within the layer to the given fields.
	 *
	 * If the fields object contains a 'state' property, its value (a uint32) is directly assigned to the block state at the given position.
	 * Otherwise, the fields object is interpreted as individual struct fields and updated via state_struct.update.
	 *
	 * @param {number} x - The x-coordinate of the block to set (0-31).
	 * @param {number} y - The y-coordinate of the block to set (0-31).
	 * @param {Object} fields - An object containing the fields to set for the block. If 'state' is present, it is used directly; otherwise, keys correspond to the struct's field names (e.g., type, health, is_burning, color).
	 * @param {number} [fields.state] - (Optional) The raw uint32 value to assign directly to the block state.
	 * @param {number} [fields.color] - (Optional) The RGBA8888 color value to assign to the block color buffer.
	 * @return {boolean} True if the block state was changed
	 */
	setBlock(x, y, fields, skip_events = false) {
		if (fields.type === 0 && fields.state === undefined) throw new Error('Cannot set block type to 0 (empty) using setBlock, use deleteBlock instead');
		const layer_blocks = this.block_states;
		const index = y * 32 + x;

		const old_type = state_struct.type.get(layer_blocks, index);
		const old_state = layer_blocks[index];
		let changed = false;

		// If state is provided directly, use it
		if ('state' in fields) {
			layer_blocks[index] = fields.state >>> 0;
			if (old_state !== layer_blocks[index]) changed = true;
		}

		// Else update individual fields using the struct definition
		else changed ||= state_struct.update(layer_blocks, index, fields);

		const new_type = state_struct.type.get(layer_blocks, index);
		if (old_type === 0) this.block_count++;

		const had_glow = blocks_by_type[old_type]?.glow ?? false;
		const has_glow = blocks_by_type[new_type]?.glow ?? false;
		if (!had_glow && has_glow) {
			this.glow_count++;
			if (this.glow_count === 1) this.addCanvas('glow');
		}
		if (had_glow && !has_glow) this.glow_count--;

		// Store color separately
		if (fields.color !== undefined) {
			changed ||= this.block_colors[index] !== fields.color;
			this.block_colors[index] = fields.color;
		}

		if (changed && !skip_events) {
			this.entity.flagMassUpdate();
			const had_utility = blocks_by_type[old_type]?.utility ?? false;
			const has_utility = blocks_by_type[new_type]?.utility ?? false;
			if (had_utility || has_utility) this.entity.flagGroupUpdate();
		}

		this.drawPixel(x, y);
		if (!skip_events) game.planSave(1000);
		return changed;
	}

	/**
	 * Deletes the block at the specified (x, y) coordinates within the layer, setting it to an empty state
	 * @param {number} x - The x-coordinate of the block to delete (0-31).
	 * @param {number} y - The y-coordinate of the block to delete (0-31).
	 */
	deleteBlock(x, y, skip_events = false) {
		const index = y * 32 + x;
		const old_type = state_struct.type.get(this.block_states, index);
		const empty = old_type === 0;
		if (empty) return;

		this.block_states[index] = 0; // Set to empty state
		this.block_colors[index] = 0; // Clear color

		const had_glow = blocks_by_type[old_type]?.glow ?? false;
		if (had_glow) {
			this.glow_count--;
			if (this.glow_count === 0 && this.glow) {
				this.glow.canvas.remove();
				delete this.glow;
			}
		}
		this.block_count--;

		// If layer still has blocks but no glow, keep main canvas
		// If layer is completely empty, remove main canvas (handled by Entity)
		if (this.block_count > 0) this.drawPixel(x, y);

		if (!skip_events) {
			this.entity.flagMassUpdate();
			const had_utility = blocks_by_type[old_type]?.utility ?? false;
			if (had_utility) this.entity.flagGroupUpdate();
			game.planSave(1000);
		}
	}

	clearGlowPixel(x, y) {
		if (!this.glow) return;

		const glow_buf = this.glow.buf;
		for (let offset_y = 0; offset_y < 2; offset_y++) {
			for (let offset_x = 0; offset_x < 2; offset_x++) {
				const glow_index = (y + offset_y) * 33 + x + offset_x;
				glow_buf[glow_index] = 0;
			}
		}
	}

	/**
	 * Draws a pixel of the specified color at the specified (x, y) coordinates within the layer
	 * Uses the 32-bit color stored in block_colors array
	 * @param {number} x - The x-coordinate of the pixel to draw (0-31).
	 * @param {number} y - The y-coordinate of the pixel to draw (0-31).
	 */
	drawPixel(x, y) {
		const main_buf = this.main.buf;
		const block_index = y * 32 + x;
		const block_type = state_struct.type.get(this.block_states, block_index);
		const has_glow = blocks_by_type[block_type]?.glow ?? false;

		// Get the 32-bit RGBA8888 color
		const rgba8888 = this.block_colors[block_index];

		// Extract RGBA components (already 8-bit)
		const r = (rgba8888 >> 24) & 0xff;
		const g = (rgba8888 >> 16) & 0xff;
		const b = (rgba8888 >> 8) & 0xff;
		const a = rgba8888 & 0xff;

		// Write ABGR format to buffer (little-endian RGBA)
		main_buf[block_index] = (a << 24) | (b << 16) | (g << 8) | r;

		this.clearGlowPixel(x, y);

		if (has_glow && this.glow) {
			const glow_buf = this.glow.buf;
			const glow_RGBA8888 = (a << 24) | (b << 16) | (g << 8) | r;

			for (let offset_y = 0; offset_y < 2; offset_y++) {
				for (let offset_x = 0; offset_x < 2; offset_x++) {
					const glow_index = (y + offset_y) * 33 + x + offset_x;
					glow_buf[glow_index] = glow_RGBA8888;
				}
			}
		}

		// Mark as dirty for rendering
		if (!this.dirty) {
			this.dirty = true;
			this.entity.dirty_layers.push(this);
		}
	}

	/**
	 * Set block at (x, y) with the default state of the specified block name
	 * @param {number} x - The x-coordinate of the block to initialize (0-31).
	 * @param {number} y - The y-coordinate of the block to initialize (0-31).
	 * @param {string} name - The name of the block type to initialize (e.g., "rock").
	 * @return {boolean} True if the block was changed
	 */
	setByName(x, y, name, color = null) {
		const block = blocks_by_name[name];
		if (!block) throw new Error(`Block name "${name}" does not exist`);
		return this.setBlock(x, y, block.init(color));
	}

	/**
	 * Set block at (x, y) with the default state of the specified block type
	 * @param {number} x - The x-coordinate of the block to initialize (0-31).
	 * @param {number} y - The y-coordinate of the block to initialize (0-31).
	 * @param {number} type - The numeric type of the block to initialize (e.g., 1 for dirt).
	 * @return {boolean} True if the block was changed
	 */
	setByType(x, y, type, color = null) {
		const block = blocks_by_type[type];
		if (!block) throw new Error(`Block type "${type}" does not exist`);
		return this.setBlock(x, y, block.init(color));
	}

	/**
	 * Gets block metadata at local coordinates.
	 * @param {number} x - Local block x (0-31)
	 * @param {number} y - Local block y (0-31)
	 * @returns {{ type: number, color: number, is_empty: boolean, can_be_painted: boolean }}
	 */
	getBlockInfo(x, y) {
		const index = y * 32 + x;
		const type = state_struct.type.get(this.block_states, index);
		const is_empty = !type;
		const block_def = blocks_by_type[type];
		const can_be_painted = !is_empty && block_def?.can_be_painted;

		return {
			type,
			name: block_def?.name ?? 'unknown',
			color: this.block_colors[index],
			is_empty,
			can_be_painted
		};
	}

	/**
	 * Paints block color when block is non-empty and paintable.
	 * @param {number} x - Local block x (0-31)
	 * @param {number} y - Local block y (0-31)
	 * @param {number} color - RGBA8888 color
	 * @returns {boolean} True when color was applied
	 */
	paintBlock(x, y, color) {
		const info = this.getBlockInfo(x, y);
		if (info.is_empty || !info.can_be_painted) return false;

		// Preserve alpha channel
		const old_color = info.color || 0;
		const old_alpha = old_color & 0xff;

		// Compose new color: new RGB, old alpha
		const new_color = (color & 0xffffff00) | old_alpha;

		// If color is the same, skip update
		if (info.color === new_color) return false;

		// Update block color and redraw
		this.setBlock(x, y, { color: new_color });
		return true;
	}

	/**
	 * Saves the block state and color data for this chunk layer
	 * @returns {Promise<void>}
	 */
	async save() {
		const serialized_entity = this.entity.serialize();
		const layer_index = this.layer_index;
		const chunk_x = this.chunk_layer.chunk_x;
		const chunk_y = this.chunk_layer.chunk_y;

		// Save block states
		await window.saves.writeLayerChunk(game.galaxy.name, serialized_entity, layer_index, chunk_x, chunk_y, 'states', this.block_states);

		// Save block colors
		await window.saves.writeLayerChunk(game.galaxy.name, serialized_entity, layer_index, chunk_x, chunk_y, 'colors', this.block_colors);
	}
}

/**
 * Custom HTMLElement representing a single layer (0, 1, or 2) within an entity
 * Contains all canvases for blocks at this depth
 */
class EntityLayer extends HTMLElement {
	constructor() {
		super();
		this.chunk_layers = new Map(); // Map of "cx,cy" -> ChunkLayer
	}

	/**
	 * Gets or creates a chunk-layer at the specified chunk coordinates
	 * @param {number} cx - The chunk x coordinate
	 * @param {number} cy - The chunk y coordinate
	 * @param {boolean} create - Whether to create if it doesn't exist
	 * @returns {{chunk_x: number, chunk_y: number, layer: any}|null}
	 */
	getChunkLayer(cx, cy, create = false) {
		const key = `${cx},${cy}`;
		let chunk_layer = this.chunk_layers.get(key);

		if (!chunk_layer && create) {
			chunk_layer = { chunk_x: cx, chunk_y: cy, layer: null };
			this.chunk_layers.set(key, chunk_layer);
		}

		return chunk_layer;
	}

	/**
	 * Removes a chunk-layer and its canvases
	 * @param {number} cx - The chunk x coordinate
	 * @param {number} cy - The chunk y coordinate
	 */
	removeChunkLayer(cx, cy) {
		const key = `${cx},${cy}`;
		const chunk_layer = this.chunk_layers.get(key);
		if (chunk_layer && chunk_layer.layer) {
			// Remove canvases from DOM
			chunk_layer?.layer?.main?.canvas?.remove();
			chunk_layer?.layer?.glow?.canvas?.remove();
		}
		this.chunk_layers.delete(key);
	}
}

customElements.define('entity-layer', EntityLayer);

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeTemplateData(base_data = {}, override_data = {}) {
	const merged_data = { ...base_data };

	for (const key in override_data) {
		const base_value = base_data[key];
		const override_value = override_data[key];

		if (isPlainObject(base_value) && isPlainObject(override_value)) {
			merged_data[key] = mergeTemplateData(base_value, override_value);
			continue;
		}

		merged_data[key] = override_value;
	}

	return merged_data;
}

/**
 * Custom HTMLElement representing an entity (ship, asteroid, planet, etc.)
 */
class Entity extends HTMLElement {
	static generateId() {
		return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
	}

	static create(position, add_to_dom = false) {
		const entity = document.createElement('entity-root');
		entity.id = Entity.generateId();
		if (add_to_dom) entity.addToDOM();
		entity.position = { ...position };
		entity.fillRect(1, -1, -1, 2, 2, 'iron_hull_tier_1');
		entity.render();
		return entity;
	}

	static async fromSerialized(data, load_blocks = false) {
		const entity = document.createElement('entity-root');
		for (const key in data) entity[key] = data[key];
		entity.addToDOM();
		if (load_blocks) await entity.loadBlocks();
		return entity;
	}

	static async fromTemplate(template_name, add_to_dom = false, data = {}) {
		const template_data = await window.templates.loadEntity(template_name);
		const entity_data = mergeTemplateData(template_data, data);
		const entity = document.createElement('entity-root');

		for (const key in entity_data) entity[key] = entity_data[key];
		entity.id = Entity.generateId();
		if (add_to_dom) entity.addToDOM();

		await entity.loadBlocksFromSource(
			layer_index => window.templates.listChunks(template_name, layer_index),
			(layer_index, cx, cy, type) => window.templates.loadLayerChunk(template_name, layer_index, cx, cy, type),
			'template'
		);

		return entity;
	}

	static async loadNearby(position, radius) {
		// Get entities in sector
		const serialized_entities = await window.saves.loadEntities(game.galaxy.name, position);

		// Load entities within radius
		for (const serialized_entity of serialized_entities) {
			const entity_position = serialized_entity.position;
			const dx = entity_position.x - position.x;
			const dy = entity_position.y - position.y;
			if (dx * dx + dy * dy <= radius * radius) {
				await Entity.fromSerialized(serialized_entity, true);
			}
		}
	}

	static get(id) {
		return game.$(`#${id}`);
	}

	static blockToChunkCoord(x, y) {
		return {
			cx: Math.floor(x / 32),
			cy: Math.floor(y / 32)
		};
	}

	static globalPosition(position) {
		return {
			chunk: {
				cx: Math.floor((position.x / 32) % 256),
				cy: Math.floor((position.y / 32) % 256)
			},
			sector: {
				sx: Math.floor(position.x / (32 * 256)),
				sy: Math.floor(position.y / (32 * 256))
			}
		};
	}

	constructor() {
		super();
		this.position = { x: 0, y: 0, r: 0 };
		this.velocity = { vx: 0, vy: 0, vr: 0 };
		this.mass = { cx: 0, cy: 0, total: 0 };
		this.dirty_layers = [];
		this.groups_need_update = true;
		this.mass_needs_update = true;
		this.utility_groups = [];
	}

	flagMassUpdate() {
		this.mass_needs_update = true;
	}

	flagGroupUpdate() {
		this.groups_need_update = true;
	}

	updateMass(force = false) {
		if (!this.mass_needs_update && !force) return;

		let total_mass = 0;
		let sum_x = 0;
		let sum_y = 0;

		for (const entity_layer of this.querySelectorAll('entity-layer')) {
			for (const chunk_layer of entity_layer.chunk_layers.values()) {
				const layer = chunk_layer.layer;
				if (!layer) continue;

				const cx = chunk_layer.chunk_x;
				const cy = chunk_layer.chunk_y;

				for (let i = 0; i < 1024; i++) {
					const type = state_struct.type.get(layer.block_states, i);
					if (type) {
						const mass = blocks_by_type[type]?.mass || 10;
						const local_x = i % 32;
						const local_y = Math.floor(i / 32);
						const x = cx * 32 + local_x;
						const y = cy * 32 + local_y;

						total_mass += mass;
						sum_x += (x + 0.5) * mass;
						sum_y += (y + 0.5) * mass;
					}
				}
			}
		}

		if (total_mass > 0) {
			this.mass.cx = sum_x / total_mass;
			this.mass.cy = sum_y / total_mass;
			this.mass.total = total_mass;
		} else {
			this.mass.cx = 0;
			this.mass.cy = 0;
			this.mass.total = 0;
		}

		let com_el = this.querySelector('.center-of-mass');
		if (!com_el) {
			com_el = document.createElement('div');
			com_el.className = 'center-of-mass';
			com_el.innerHTML = html`
				<div>
					<div class="yellow square"></div>
					<div class="dark square"></div>
				</div>
				<div>
					<div class="dark square"></div>
					<div class="yellow square"></div>
				</div>
			`;

			this.appendChild(com_el);
		}

		// CSS position mapping
		com_el.style.left = `${this.mass.cx}px`;
		com_el.style.top = `${this.mass.cy}px`;

		this.mass_needs_update = false;
	}

	getGroup(x, y) {
		for (const group of this.utility_groups) {
			if (x >= group.x && x < group.x + group.w && y >= group.y && y < group.y + group.h) {
				return group;
			}
		}
		return null;
	}

	getGroupInfo(target_group) {
		if (!target_group) return null;

		const total_blocks = target_group.w * target_group.h;
		const block_def = blocks_by_type[target_group.type];
		const block_mass = block_def?.mass || 10;
		const total_mass = block_mass * total_blocks;

		const result = {
			type: block_def?.name,
			size: `${target_group.w}x${target_group.h} (${total_blocks} blocks)`,
			mass: total_mass
		};

		const process = (types, callback) => {
			if (types.includes(block_def?.name)) {
				const new_attrs = callback(block_def);
				Object.assign(result, new_attrs);
			}
		};

		// Solar panels
		process(['solar_panel_tier_1', 'solar_panel_tier_2', 'solar_panel_tier_3', 'solar_panel_tier_4'], def => ({}));

		// Capacitors
		process(['basic_capacitor', 'high_density_capacitor'], def => ({}));

		// Refineries
		process(['industrial_refinery', 'uranium_refinery', 'bio_refinery'], def => ({}));

		// Generators
		process(['bio_fuel_electric_generator', 'uranium_electric_generator'], def => ({}));

		// Greenhouse
		process(['greenhouse'], def => ({}));

		// Thrusters
		process(['electric_thruster', 'bio_fuel_thruster', 'uranium_thruster'], def => ({}));

		// Warp drive and gate
		process(['warp_drive', 'warp_gate'], def => ({}));

		// Cannons
		process(['cannon_tier_1', 'cannon_tier_2', 'cannon_tier_3', 'cannon_tier_4'], def => ({}));

		// Missiles and guided missiles
		process(['missile_launcher_tier_1', 'missile_launcher_tier_2', 'missile_launcher_tier_3', 'guided_missile_launcher_tier_1', 'guided_missile_launcher_tier_2', 'guided_missile_launcher_tier_3'], def => ({}));

		// Flare launcher
		process(['flare_launcher'], def => ({}));

		// Containers
		process(['industrial_container', 'bio_fuel_container', 'uranium_container'], def => ({}));

		// Radars
		process(['radar'], def => ({}));

		return result;
	}

	updateUtilityGroups(force = false) {
		if (!this.groups_need_update && !force) return;

		const new_groups = [];
		const visited = new Set();
		const utility_blocks = [];

		const getUtilityType = (l, x, y) => {
			const info = this.getBlockInfo(l, x, y);
			if (info.is_empty) return null;
			return blocks_by_type[info.type]?.utility ? info.type : null;
		};

		// Collect all utility blocks across all layers
		for (const entity_layer of this.querySelectorAll('entity-layer')) {
			const l = Number(entity_layer.dataset.layer);
			for (const chunk_layer of entity_layer.chunk_layers.values()) {
				const layer = chunk_layer.layer;
				if (!layer) continue;

				const cx = chunk_layer.chunk_x;
				const cy = chunk_layer.chunk_y;

				for (let i = 0; i < 1024; i++) {
					const type = state_struct.type.get(layer.block_states, i);
					if (type && blocks_by_type[type] && blocks_by_type[type].utility) {
						const local_x = i % 32;
						const local_y = Math.floor(i / 32);
						const x = cx * 32 + local_x;
						const y = cy * 32 + local_y;
						utility_blocks.push({ l, x, y, type });
					}
				}
			}
		}

		for (const block of utility_blocks) {
			const { l, x, y, type } = block;
			const key = `${l},${x},${y}`;
			if (visited.has(key)) continue;

			// Flood fill to find all connected utility blocks of the SAME type
			const group_blocks = [];
			const queue = [{ x, y }];
			visited.add(key);

			let min_x = x,
				max_x = x,
				min_y = y,
				max_y = y;
			let head = 0;

			while (head < queue.length) {
				const curr = queue[head++];
				group_blocks.push(curr);

				if (curr.x < min_x) min_x = curr.x;
				if (curr.x > max_x) max_x = curr.x;
				if (curr.y < min_y) min_y = curr.y;
				if (curr.y > max_y) max_y = curr.y;

				const neighbors = [
					{ dx: 1, dy: 0 },
					{ dx: -1, dy: 0 },
					{ dx: 0, dy: 1 },
					{ dx: 0, dy: -1 }
				];

				for (const n of neighbors) {
					const nx = curr.x + n.dx;
					const ny = curr.y + n.dy;
					const n_key = `${l},${nx},${ny}`;

					if (!visited.has(n_key)) {
						if (getUtilityType(l, nx, ny) === type) {
							visited.add(n_key);
							queue.push({ x: nx, y: ny });
						}
					} // else already visited or not matching
				}
			}

			const w = max_x - min_x + 1;
			const h = max_y - min_y + 1;

			// Validate
			if (w < 2 || h < 2 || group_blocks.length !== w * h) continue;

			// Surrounded by empty or non-utility blocks?
			let surrounded = true;
			for (let sy = min_y - 1; sy <= max_y + 1; sy++) {
				for (let sx = min_x - 1; sx <= max_x + 1; sx++) {
					// Ignore inner blocks (the rectangle itself)
					if (sx >= min_x && sx <= max_x && sy >= min_y && sy <= max_y) continue;
					if (getUtilityType(l, sx, sy) !== null) {
						surrounded = false;
						break;
					}
				}
				if (!surrounded) break;
			}

			if (surrounded) {
				// We have a valid new simple rectangle group.
				new_groups.push({ l, type, x: min_x, y: min_y, w, h, data: {} });
			}
		}

		// Merge data from old arrays (as requested in Management mode.md)
		// - exact match: copy old
		// - overlaps: merge
		const final_groups = [];
		for (const ng of new_groups) {
			const overlaps = this.utility_groups.filter(og => og.l === ng.l && og.type === ng.type && Math.max(og.x, ng.x) <= Math.min(og.x + og.w - 1, ng.x + ng.w - 1) && Math.max(og.y, ng.y) <= Math.min(og.y + og.h - 1, ng.y + ng.h - 1));

			// Exact match
			if (overlaps.length === 1 && overlaps[0].x === ng.x && overlaps[0].y === ng.y && overlaps[0].w === ng.w && overlaps[0].h === ng.h) {
				final_groups.push(overlaps[0]);
			}

			// Overlaps, merge data
			else if (overlaps.length > 0) {
				let merged_data = {};
				for (const og of overlaps) merged_data = { ...merged_data, ...og.data };

				ng.data = merged_data;
				final_groups.push(ng);
			}

			// No overlap, just brand new
			else {
				final_groups.push(ng);
			}
		}

		this.utility_groups = final_groups;
		this.groups_need_update = false;
	}

	createEntityLayer(layer_index) {
		let entity_layer = this.querySelector(`entity-layer[data-layer="${layer_index}"]`);
		if (entity_layer) return entity_layer;

		entity_layer = document.createElement('entity-layer');
		entity_layer.layer_index = layer_index;
		entity_layer.dataset.layer = layer_index;

		// Set z-index based on layer depth
		entity_layer.style.zIndex = layer_index.toString();

		// Add drop shadow to layers above 0
		if (layer_index > 0) entity_layer.style.filter = 'drop-shadow(0 0 1px rgba(0, 0, 0, .5))';

		this.appendChild(entity_layer);
		return entity_layer;
	}

	toLocalCoord(value) {
		return ((value % 32) + 32) % 32;
	}

	/**
	 * Gets the EntityLayer at the specified layer index.
	 * @param {number} layer_index - The layer index (0-2)
	 * @param {boolean} create - Whether to create the entity layer if it doesn't exist
	 * @returns {EntityLayer|null}
	 */
	getEntityLayer(layer_index, create = false) {
		let entity_layer = this.querySelector(`entity-layer[data-layer="${layer_index}"]`);
		if (!entity_layer && create) entity_layer = this.createEntityLayer(layer_index);
		return entity_layer;
	}

	/**
	 * Gets or creates a chunk-layer at the specified chunk coordinates and layer
	 * @param {number} layer_index - The layer index (0-2)
	 * @param {number} cx - The chunk x coordinate
	 * @param {number} cy - The chunk y coordinate
	 * @param {boolean} create - Whether to create if it doesn't exist
	 * @returns {ChunkLayer|null}
	 */
	getChunkLayer(layer_index, cx, cy, create = false) {
		const entity_layer = this.getEntityLayer(layer_index, create);
		if (!entity_layer) return null;
		return entity_layer.getChunkLayer(cx, cy, create);
	}

	/**
	 * Gets or creates a Layer for the specified chunk coordinates and layer index
	 * @param {number} layer_index - The layer index (0-2)
	 * @param {number} cx - The chunk x coordinate
	 * @param {number} cy - The chunk y coordinate
	 * @param {boolean} create - Whether to create if it doesn't exist
	 * @returns {Layer|null}
	 */
	getLayer(layer_index, cx, cy, create = false) {
		const entity_layer = this.getEntityLayer(layer_index, create);
		if (!entity_layer) return null;

		const chunk_layer = entity_layer.getChunkLayer(cx, cy, create);
		if (!chunk_layer) return null;
		if (chunk_layer.layer) return chunk_layer.layer;
		if (!create) return null;

		const layer = new Layer(chunk_layer, layer_index, entity_layer);
		chunk_layer.layer = layer;
		return layer;
	}

	/*
	 * Gets all chunk-layers (across all entity-layers)
	 * @returns {Array<ChunkLayer>}
	 */
	getAllChunkLayers() {
		const chunk_layers = [];
		for (let i = 0; i < 3; i++) {
			const entity_layer = this.getEntityLayer(i);
			if (entity_layer) chunk_layers.push(...entity_layer.chunk_layers.values());
		}
		return chunk_layers;
	}

	/**
	 * Sets the block at the specified (x, y) coordinates within the entity's layers to the given fields.
	 * @param {number} l - The layer index (0-2) to set the block in.
	 * @param {number} x - The x-coordinate of the block to set.
	 * @param {number} y - The y-coordinate of the block to set.
	 * @param {Object} fields - An object containing the fields to set for the block, where keys correspond to the struct's field names.
	 * @returns {Boolean} True if the block has changed
	 */
	setBlock(l, x, y, fields) {
		const { cx, cy } = Entity.blockToChunkCoord(x, y);
		const layer = this.getLayer(l, cx, cy, true);
		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		return layer.setBlock(local_x, local_y, fields);
	}

	/**
	 * Set block at (x, y) with the default state of the specified block name
	 * @param {number} l - The layer index (0-2) to set the block in.
	 * @param {number} x - The x-coordinate of the block to initialize.
	 * @param {number} y - The y-coordinate of the block to initialize.
	 * @param {string} name - The name of the block type to initialize (e.g., "dirt").
	 * @return {boolean} True if the block was changed
	 */
	setByName(l, x, y, name, color = null) {
		const { cx, cy } = Entity.blockToChunkCoord(x, y);
		const layer = this.getLayer(l, cx, cy, true);
		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		return layer.setByName(local_x, local_y, name, color);
	}

	/**
	 * Set block at (x, y) with the default state of the specified block type
	 * @param {number} l - The layer index (0-2) to set the block in.
	 * @param {number} x - The x-coordinate of the block to initialize.
	 * @param {number} y - The y-coordinate of the block to initialize.
	 * @param {number} type - The numeric type of the block to initialize (e.g., 1 for dirt).
	 * @return {boolean} True if the block was changed
	 */
	setByType(l, x, y, type, color = null) {
		const { cx, cy } = Entity.blockToChunkCoord(x, y);
		const layer = this.getLayer(l, cx, cy, true);
		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		return layer.setByType(local_x, local_y, type, color);
	}

	/**
	 * Deletes the block at the specified (x, y) coordinates within the entity's layers
	 * @param {number} l - The layer index (0-2) to delete the block from.
	 * @param {number} x - The x-coordinate of the block to delete.
	 * @param {number} y - The y-coordinate of the block to delete.
	 */
	deleteBlock(l, x, y) {
		const { cx, cy } = Entity.blockToChunkCoord(x, y);
		const entity_layer = this.getEntityLayer(l);
		if (!entity_layer) return;

		const chunk_layer = entity_layer.getChunkLayer(cx, cy, false);
		if (!chunk_layer || !chunk_layer.layer) return;

		const layer = chunk_layer.layer;
		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		layer.deleteBlock(local_x, local_y);

		// If layer is now empty, remove the chunk-layer entirely
		if (layer.block_count === 0) {
			entity_layer.removeChunkLayer(cx, cy);
		}
	}

	/**
	 * Returns block metadata at world block coordinates.
	 * @param {number} l - Layer index (0-2)
	 * @param {number} x - World block x
	 * @param {number} y - World block y
	 * @returns {{ type: number, color: number, is_empty: boolean, can_be_painted: boolean }}
	 */
	getBlockInfo(l, x, y) {
		const { cx, cy } = Entity.blockToChunkCoord(x, y);
		const entity_layer = this.getEntityLayer(l);
		if (!entity_layer) {
			return { type: 0, color: 0, is_empty: true, can_be_painted: false };
		}

		const chunk_layer = entity_layer.getChunkLayer(cx, cy, false);
		if (!chunk_layer || !chunk_layer.layer) {
			return { type: 0, color: 0, is_empty: true, can_be_painted: false };
		}

		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		return chunk_layer.layer.getBlockInfo(local_x, local_y);
	}

	/**
	 * Paints block color at world block coordinates when block is non-empty and paintable.
	 * @param {number} l - Layer index (0-2)
	 * @param {number} x - World block x
	 * @param {number} y - World block y
	 * @param {number} color - RGBA8888 color
	 * @returns {boolean} True when color was applied
	 */
	paintBlock(l, x, y, color) {
		const { cx, cy } = Entity.blockToChunkCoord(x, y);
		const entity_layer = this.getEntityLayer(l);
		if (!entity_layer) return false;

		const chunk_layer = entity_layer.getChunkLayer(cx, cy, false);
		if (!chunk_layer || !chunk_layer.layer) return false;

		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		return chunk_layer.layer.paintBlock(local_x, local_y, color);
	}

	/**
	 * Fills a rectangular area of blocks at the specified (x, y, w, h) coordinates
	 * @param {number} l - The layer index (0-2) to set the blocks in.
	 * @param {number} x - The x-coordinate of the top-left corner of the rectangle to fill.
	 * @param {number} y - The y-coordinate of the top-left corner of the rectangle to fill.
	 * @param {number} w - The width of the rectangle to fill (in blocks).
	 * @param {number} h - The height of the rectangle to fill (in blocks).
	 * @param {string} name - The name of the block type to fill with (e.g., "dirt").
	 */
	fillRect(l, x, y, w, h, name) {
		for (let offset_y = 0; offset_y < h; offset_y++) {
			for (let offset_x = 0; offset_x < w; offset_x++) {
				this.setByName(l, x + offset_x, y + offset_y, name);
			}
		}
	}

	/**
	 * Fills an elliptical area of blocks centered at the specified (x, y) coordinates.
	 * @param {number} l - The layer index (0-2) to set the blocks in.
	 * @param {number} x - The x-coordinate of the center of the ellipse to fill.
	 * @param {number} y - The y-coordinate of the center of the ellipse to fill.
	 * @param {number} w - The width of the ellipse to fill (in blocks).
	 * @param {number} h - The height of the ellipse to fill (in blocks).
	 * @param {string} name - The name of the block type to fill with (e.g., "dirt").
	 */
	fillEllipse(l, x, y, w, h, name) {
		x--;
		y--;
		const half_w = w / 2;
		const half_h = h / 2;
		const start_x = Math.round(x - (w - 1) / 2);
		const start_y = Math.round(y - (h - 1) / 2);

		for (let offset_y = 0; offset_y < h; offset_y++) {
			for (let offset_x = 0; offset_x < w; offset_x++) {
				const normalized_x = (offset_x + 0.5 - half_w) / half_w;
				const normalized_y = (offset_y + 0.5 - half_h) / half_h;
				if (normalized_x ** 2 + normalized_y ** 2 <= 1) {
					const local_x = start_x + offset_x;
					const local_y = start_y + offset_y;
					this.setByName(l, local_x, local_y, name);
				}
			}
		}
	}

	/**
	 * Renders all dirty layers of the entity by calling their render methods, then clears the dirty layers list
	 */
	render() {
		for (const dirty_layer of this.dirty_layers) dirty_layer?.render();
		this.dirty_layers.length = 0;
		this.updateMass();
	}

	/**
	 * Adds entity to the DOM
	 */
	addToDOM() {
		window.game.appendChild(this);
	}

	/**
	 * Serializes the entity's data into a JSON string for saving
	 */
	serialize() {
		const obj = {};
		const keys = ['id', 'position', 'velocity', 'mass', 'utility_groups'];
		for (const key of keys) obj[key] = this[key];
		return obj;
	}

	/**
	 * Serializes and saves this entity using window.saves.writeEntity
	 * @returns {Promise<void>}
	 */
	async save() {
		const galaxy_name = game.galaxy.name;
		const entity_data = this.serialize();
		await window.saves.writeEntity(galaxy_name, entity_data);

		// Save all blocks data
		for (const chunk_layer of this.getAllChunkLayers()) {
			await chunk_layer?.layer.save(galaxy_name);
		}
	}

	async loadBlocksFromSource(list_chunks, load_layer_chunk, source_name = 'data') {
		for (const layer_index of [0, 1, 2]) {
			const chunk_coords = await list_chunks(layer_index);
			if (!chunk_coords.length) continue;

			const entity_layer = this.getEntityLayer(layer_index, true);

			for (const coord of chunk_coords) {
				const { cx, cy } = coord;
				const chunk_layer = entity_layer.getChunkLayer(cx, cy, true);

				const [states_array, colors_array] = await Promise.all([load_layer_chunk(layer_index, cx, cy, 'states'), load_layer_chunk(layer_index, cx, cy, 'colors')]);

				if (!states_array || !colors_array) {
					throw new Error(`Failed to load ${source_name} chunk layer at (${cx}, ${cy}) for layer ${layer_index}`);
				}

				let layer = chunk_layer.layer;
				if (!layer) {
					layer = new Layer(chunk_layer, layer_index, entity_layer);
					chunk_layer.layer = layer;
				}

				for (let i = 0; i < 1024; i++) {
					const x = i % 32;
					const y = Math.floor(i / 32);

					if (states_array[i] === 0) {
						layer.deleteBlock(x, y, true /* skip_events */);
						continue;
					}

					layer.setBlock(
						x,
						y,
						{
							state: states_array[i],
							color: colors_array[i]
						},
						true /* skip_events */
					);
				}
			}
		}

		this.groups_need_update = false;
		this.flagMassUpdate();
		this.render();
	}

	/**
	 * Loads entity blocks from save, ensuring all chunk layers are created and loaded
	 */
	async loadBlocks() {
		const serialized_entity = this.serialize();
		const galaxy_name = game.galaxy.name;

		await this.loadBlocksFromSource(
			layer_index => window.saves.listChunks(galaxy_name, serialized_entity, layer_index),
			(layer_index, cx, cy, type) => window.saves.loadLayerChunk(galaxy_name, serialized_entity, layer_index, cx, cy, type),
			'save'
		);
	}
}

customElements.define('entity-root', Entity);

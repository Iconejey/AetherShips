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
		for (const key in obj) {
			if (this[key]) this[key].set(arr, index, obj[key]);
		}
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

console.log(`State struct size: ${state_struct.size} bits`);

/**
 * Randomly selects one item from the provided array.
 * @param {Array} arr - The array to select from.
 * @returns {*} A random element from the array.
 */
function oneOf(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Creates a slight variation of an RGBA8888 color in lightness and saturation only.
 * @param {number} rgba8888 - An RGBA8888 color value (32-bit: 8 bits each for R, G, B, A).
 * @returns {number} A slightly varied color in the same RGBA8888 format.
 */
function varyColor(rgba8888) {
	// Extract RGBA channels (8 bits each)
	let r = (rgba8888 >> 24) & 0xff;
	let g = (rgba8888 >> 16) & 0xff;
	let b = (rgba8888 >> 8) & 0xff;
	const a = rgba8888 & 0xff;

	const variation = Math.random() * 0.5 + 0.7; // Random variation between 0.7 and 1.2
	r = Math.min(255, Math.max(0, Math.round(r * variation)));
	g = Math.min(255, Math.max(0, Math.round(g * variation)));
	b = Math.min(255, Math.max(0, Math.round(b * variation)));

	// Reconstruct the color
	const varied = (r << 24) | (g << 16) | (b << 8) | a;
	const hex = varied.toString(16).padStart(8, '0');
	console.log(`0x${hex}`);
	return varied >>> 0; // Ensure unsigned interpretation
}

for (let i = 0; i < 3; i++) varyColor(0x888888ff);

// Define block types and their default states, properties, and colors
const blocks = {
	// Minerals
	dirt: {
		init: (x, y) => ({
			type: 1,
			color: oneOf([0x79563aff, 0x916745ff, 0x815c3eff, 0x835d3fff]),
			health: 2
		}),
		death: (arr, index) => (arr[index] = 0) // Empty block on death
	},
	stone: {
		init: (x, y) => ({
			type: 2,
			color: oneOf([0x606060ff, 0x686868ff, 0x6f6f6fff]),
			health: 4
		}),
		death: (arr, index) => (arr[index] = 0) // Empty block on death
	},

	// Vegetation
	grass: {
		init: (x, y) => ({
			type: 3,
			color: oneOf([0x858f4fff, 0x7a8547ff, 0x8a9a57ff, 0x80904eff]),
			health: 1
		}),
		death: (arr, index) => (arr[index] = 0) // Empty block on death
	},

	// Decorative
	lamp: {
		init: (x, y) => ({
			type: 32,
			color: 0xffff88ff,
			health: 2
		}),
		death: (arr, index) => (arr[index] = 0), // Empty block on death
		can_be_painted: true,
		glow: true
	}
};

const blocks_by_type = {};
for (const block_name in blocks) {
	const block_type = blocks[block_name].init(0, 0).type;
	if (blocks_by_type[block_type]) throw new Error(`Duplicate block type ${block_type} for block "${block_name}"`);
	blocks_by_type[block_type] = blocks[block_name];
}

/**
 * Represents a single layer within a chunk, containing blocks and rendering surfaces
 */
class Layer {
	get entity() {
		return this.chunk.parentElement;
	}

	constructor(chunk, layer_index) {
		this.chunk = chunk;
		this.layer_index = layer_index;
		this.blocks = new Uint32Array(1024); // 32x32 blocks (type, health, is_burning)
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

		// Set z-index: main = layer*2, glow = layer*2+1
		// Layer 0: main=0, glow=1; Layer 1: main=2, glow=3; Layer 2: main=4, glow=5
		const z_index = this.layer_index * 2 + (type === 'glow' ? 1 : 0);
		canvas.style.zIndex = z_index.toString();

		// Apply drop shadow only to main canvases in layers 1 and 2 (not layer 0)
		if (type === 'main' && this.layer_index > 0) {
			canvas.style.filter = 'drop-shadow(0 0 1px rgba(0, 0, 0, 1))';
		}

		const ctx = canvas.getContext('2d');
		const img_data = ctx.createImageData(size, size);
		const buf = new Uint32Array(img_data.data.buffer);

		this[type] = { canvas, ctx, img_data, buf };
		this.chunk.appendChild(canvas);
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
	 * Sets the block at the specified (x, y) coordinates within the layer to the given fields
	 * @param {number} x - The x-coordinate of the block to set (0-31).
	 * @param {number} y - The y-coordinate of the block to set (0-31).
	 * @param {Object} fields - An object containing the fields to set for the block, where keys correspond to the struct's field names.
	 */
	setBlock(x, y, fields) {
		if (fields.type === 0) throw new Error('Cannot set block type to 0 (empty) using setBlock, use deleteBlock instead');
		const layer_blocks = this.blocks;
		const index = y * 32 + x;

		const old_type = state_struct.type.get(layer_blocks, index);
		state_struct.update(layer_blocks, index, fields);
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
			this.block_colors[index] = fields.color;
		}
		this.drawPixel(x, y);
	}

	/**
	 * Deletes the block at the specified (x, y) coordinates within the layer, setting it to an empty state
	 * @param {number} x - The x-coordinate of the block to delete (0-31).
	 * @param {number} y - The y-coordinate of the block to delete (0-31).
	 */
	deleteBlock(x, y) {
		const index = y * 32 + x;
		const old_type = state_struct.type.get(this.blocks, index);
		const empty = old_type === 0;
		if (empty) return;

		this.blocks[index] = 0; // Set to empty state
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

		// Only draw if the layer still has blocks
		if (this.block_count > 0) this.drawPixel(x, y);
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
		const block_type = state_struct.type.get(this.blocks, block_index);
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
	 * @param {string} name - The name of the block type to initialize (e.g., "dirt").
	 */
	setByName(x, y, name) {
		const block = blocks[name];
		if (!block) throw new Error(`Block type "${name}" does not exist`);
		this.setBlock(x, y, block.init(x, y));
	}

	/**
	 * Set block at (x, y) with the default state of the specified block type
	 * @param {number} x - The x-coordinate of the block to initialize (0-31).
	 * @param {number} y - The y-coordinate of the block to initialize (0-31).
	 * @param {number} type - The numeric type of the block to initialize (e.g., 1 for dirt).
	 */
	setByType(x, y, type) {
		const block_name = blocks_by_type[type];
		if (!block_name) throw new Error(`Block type "${type}" does not exist`);
		this.setByName(x, y, block_name);
	}
}

/**
 * Custom HTMLElement representing a chunk of blocks
 * Each chunk contains a 32x32 grid of blocks, stored as a Uint32Array of length 1024
 */
class Chunk extends HTMLElement {
	get block_count() {
		let count = 0;
		for (const layer of this.layers) count += layer?.block_count ?? 0;
		return count;
	}

	get glow_count() {
		let count = 0;
		for (const layer of this.layers) count += layer?.glow_count ?? 0;
		return count;
	}

	constructor(x, y) {
		super();
		this.pos = { x, y };
		this.groups = [];
		this.layers = [null, null, null];
		this.style.left = `${x * 32}px`;
		this.style.top = `${y * 32}px`;
	}

	/**
	 * Gets or creates a layer at the specified index
	 * @param {number} index - The layer index (0-2)
	 * @param {boolean} create - Whether to create the layer if it doesn't exist
	 * @returns {Layer|null} The layer at the specified index, or null if it doesn't exist and create is false
	 */
	getLayer(index, create = false) {
		if (this.layers[index]) return this.layers[index];
		if (!create) return null;

		const layer = new Layer(this, index);
		this.layers[index] = layer;
		return layer;
	}
}

customElements.define('chunk-elem', Chunk);

/**
 * Custom HTMLElement representing an entity (ship, asteroid, planet, etc.)
 */
class Entity extends HTMLElement {
	get chunks() {
		return Array.from(this.children);
	}

	toLocalCoord(value) {
		return ((value % 32) + 32) % 32;
	}

	constructor() {
		super();
		this.position = { x: 0, y: 0, r: 0 };
		this.velocity = { vx: 0, vy: 0, vr: 0 };
		this.mass = { cx: 0, cy: 0, mass: 0 };
		this.dirty_layers = [];
	}

	/*
	 * Gets the chunk at the specified (x, y) coordinates
	 * @param {number} x - The x-coordinate of the chunk to get (0-31).
	 * @param {number} y - The y-coordinate of the chunk to get (0-31).
	 * @param {boolean} create - Whether to create the chunk if it doesn't exist.
	 * @return {Chunk} The chunk at the specified coordinates, or null if it doesn't exist and create is false.
	 */
	getChunk(bx, by, create = false) {
		const cx = Math.floor(bx / 32);
		const cy = Math.floor(by / 32);
		let chunk = this.chunks.find(c => c.pos.x === cx && c.pos.y === cy);
		if (!chunk && create) {
			chunk = new Chunk(cx, cy);
			this.appendChild(chunk);
		}
		return chunk;
	}

	/*
	 * Sets the block at the specified (x, y) coordinates within the entity's chunks to the given fields.
	 * @param {number} l - The layer index (0-2) to set the block in.
	 * @param {number} x - The x-coordinate of the block to set.
	 * @param {number} y - The y-coordinate of the block to set.
	 * @param {Object} fields - An object containing the fields to set for the block, where keys correspond to the struct's field names.
	 */
	setBlock(l, x, y, fields) {
		const chunk = this.getChunk(x, y, true);
		const layer = chunk.getLayer(l, true);
		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		layer.setBlock(local_x, local_y, fields);
	}

	/**
	 * Set block at (x, y) with the default state of the specified block name
	 * @param {number} l - The layer index (0-2) to set the block in.
	 * @param {number} x - The x-coordinate of the block to initialize.
	 * @param {number} y - The y-coordinate of the block to initialize.
	 * @param {string} name - The name of the block type to initialize (e.g., "dirt").
	 */
	setByName(l, x, y, name) {
		const chunk = this.getChunk(x, y, true);
		const layer = chunk.getLayer(l, true);
		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		layer.setByName(local_x, local_y, name);
	}

	/**
	 * Set block at (x, y) with the default state of the specified block type
	 * @param {number} l - The layer index (0-2) to set the block in.
	 * @param {number} x - The x-coordinate of the block to initialize.
	 * @param {number} y - The y-coordinate of the block to initialize.
	 * @param {number} type - The numeric type of the block to initialize (e.g., 1 for dirt).
	 */
	setByType(l, x, y, type) {
		const chunk = this.getChunk(x, y, true);
		const layer = chunk.getLayer(l, true);
		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		layer.setByType(local_x, local_y, type);
	}

	/**
	 * Deletes the block at the specified (x, y) coordinates within the entity's chunks
	 * @param {number} l - The layer index (0-2) to delete the block from.
	 * @param {number} x - The x-coordinate of the block to delete.
	 * @param {number} y - The y-coordinate of the block to delete.
	 */
	deleteBlock(l, x, y) {
		const chunk = this.getChunk(x, y, false);
		if (!chunk) return;

		const layer = chunk.getLayer(l, false);
		if (!layer) return;

		const local_x = this.toLocalCoord(x);
		const local_y = this.toLocalCoord(y);
		layer.deleteBlock(local_x, local_y);

		// If chunk is now empty, remove it entirely
		if (chunk.block_count === 0) chunk.remove();
		// Otherwise, if layer is now empty, remove just the layer
		else if (layer.block_count === 0) {
			layer.main.canvas.remove();
			layer.glow.canvas.remove();
			chunk.layers[l] = null;
		}
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
		console.log(`Rendering ${this.dirty_layers.length} dirty layers`);
		for (const dirty_layer of this.dirty_layers) dirty_layer?.render();
		this.dirty_layers.length = 0;
	}
}

customElements.define('entity-elem', Entity);

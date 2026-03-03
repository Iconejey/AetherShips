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
	['color', 16],
	['health', 7],
	['is_burning', 1]
]);

console.log(`State struct size: ${state_struct.size} bits`);

// Define block types and their default states, properties, and colors
const blocks = {
	// Minerals
	dirt: {
		init: (x, y) => ({
			type: 1,
			color: 0xa75f,
			health: 2
		}),
		death: (arr, index) => (arr[index] = 0) // Empty block on death
	},
	lamp: {
		init: (x, y) => ({
			type: 2,
			color: 0x8f8f,
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
		this.blocks = new Uint32Array(1024); // 32x32 blocks
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

		const RGBA4444 = state_struct.color.get(layer_blocks, index);
		this.drawPixel(x, y, RGBA4444);
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
		if (this.block_count > 0) this.drawPixel(x, y, 0);
	}

	/**
	 * Draws a pixel of the specified color at the specified (x, y) coordinates within the layer
	 * NOTE: Glow effects are ignored for now
	 * @param {number} x - The x-coordinate of the pixel to draw (0-31).
	 * @param {number} y - The y-coordinate of the pixel to draw (0-31).
	 * @param {number} RGBA4444 - A 16-bit integer representing the color in RGBA4444 format.
	 */
	drawPixel(x, y, RGBA4444) {
		const main_buf = this.main.buf;
		const block_index = y * 32 + x;
		const block_type = state_struct.type.get(this.blocks, block_index);
		const has_glow = blocks_by_type[block_type]?.glow ?? false;

		// Extract 4-bit RGBA components and convert to 8-bit
		const r = ((RGBA4444 >> 12) & 0xf) * 17;
		const g = ((RGBA4444 >> 8) & 0xf) * 17;
		const b = ((RGBA4444 >> 4) & 0xf) * 17;
		const a = (RGBA4444 & 0xf) * 17;

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

	render() {
		console.log(`Rendering ${this.dirty_layers.length} dirty layers`);
		for (const dirty_layer of this.dirty_layers) dirty_layer?.render();
		this.dirty_layers.length = 0;
	}
}

customElements.define('entity-elem', Entity);

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
			color: 0xf00f,
			health: 2
		}),
		death: (arr, index) => (arr[index] = 0), // Empty block on death
		can_be_painted: true
	}
};

const blocks_by_type = {};
for (const block_name in blocks) {
	const block_type = blocks[block_name].init(0, 0).type;
	if (blocks_by_type[block_type]) throw new Error(`Duplicate block type ${block_type} for block "${block_name}"`);
	blocks_by_type[block_type] = block_name;
}

/**
 * Represents a single layer within a chunk, containing blocks and rendering surfaces
 */
class Layer {
	get entity() {
		return this.chunk.parentElement;
	}

	constructor(chunk) {
		this.chunk = chunk;
		this.blocks = new Uint32Array(1024); // 32x32 blocks
		this.block_count = 0;
		this.glow_count = 0;
		this.dirty = false;

		for (const type of ['main', 'glow']) {
			const canvas = document.createElement('canvas');
			canvas.width = 32;
			canvas.height = 32;
			if (type === 'glow') canvas.classList.add('glow');

			const ctx = canvas.getContext('2d');
			const img_data = ctx.createImageData(32, 32);
			const buf = new Uint32Array(img_data.data.buffer);

			this[type] = { canvas, ctx, img_data, buf };
		}
	}

	/**
	 * Puts the current image data onto the main canvas. Should be called after drawing pixels to update the visible layer.
	 * NOTE: Glow effects are ignored for now, so the glow canvas is not updated.
	 */
	render() {
		this.main.ctx.putImageData(this.main.img_data, 0, 0);
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
		const blocks = this.blocks;
		const index = y * 32 + x;
		const was_empty = state_struct.type.get(blocks, index) === 0;
		state_struct.update(blocks, index, fields);
		if (was_empty) this.block_count++;
		const RGBA4444 = state_struct.color.get(blocks, index);
		this.drawPixel(x, y, RGBA4444);
	}

	/**
	 * Deletes the block at the specified (x, y) coordinates within the layer, setting it to an empty state
	 * @param {number} x - The x-coordinate of the block to delete (0-31).
	 * @param {number} y - The y-coordinate of the block to delete (0-31).
	 */
	deleteBlock(x, y) {
		const index = y * 32 + x;
		const empty = state_struct.type.get(this.blocks, index) === 0;
		if (empty) return;

		this.blocks[index] = 0; // Set to empty state
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
		const buf = this.main.buf;

		// Extract 4-bit RGBA components and convert to 8-bit
		const r = ((RGBA4444 >> 12) & 0xf) * 17;
		const g = ((RGBA4444 >> 8) & 0xf) * 17;
		const b = ((RGBA4444 >> 4) & 0xf) * 17;
		const a = (RGBA4444 & 0xf) * 17;

		// Write ABGR format to buffer (little-endian RGBA)
		buf[y * 32 + x] = (a << 24) | (b << 16) | (g << 8) | r;

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

		const layer = new Layer(this);
		this.layers[index] = layer;
		this.appendChild(layer.main.canvas);
		this.appendChild(layer.glow.canvas);
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
		layer.setBlock(x % 32, y % 32, fields);
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
		layer.setByName(x % 32, y % 32, name);
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
		layer.setByType(x % 32, y % 32, type);
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

		layer.deleteBlock(x % 32, y % 32);

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
	}
}

customElements.define('entity-elem', Entity);

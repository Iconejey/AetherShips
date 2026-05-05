/**
 * Mulberry32 PRNG
 */
class RNG {
	/**
	 * @param {number} seed
	 */
	constructor(seed) {
		this.seed = seed;
	}

	/**
	 * @param {number} [n]
	 * @returns {number}
	 */
	get(n) {
		let t = n !== undefined ? this.seed + Math.imul(n, 0x6d2b79f5) : (this.seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
}

/**
 * Seeded 2D Simplex Noise generator.
 */
class Noise2D {
	/**
	 * @param {number} seed
	 * @param {number} scaleX
	 * @param {number} [scaleY]
	 */
	constructor(seed, scaleX = 1, scaleY = scaleX) {
		this.scaleX = scaleX;
		this.scaleY = scaleY;
		this.grad_3 = [
			[1, 1, 0],
			[-1, 1, 0],
			[1, -1, 0],
			[-1, -1, 0],
			[1, 0, 1],
			[-1, 0, 1],
			[1, 0, -1],
			[-1, 0, -1],
			[0, 1, 1],
			[0, -1, 1],
			[0, 1, -1],
			[0, -1, -1]
		];

		this.p = new Uint8Array(256);

		// Use the game's RNG to shuffle the permutation table
		const rng = new RNG(seed);
		for (let i = 0; i < 256; i++) {
			this.p[i] = i;
		}
		for (let i = 255; i > 0; i--) {
			const j = Math.floor(rng.get() * (i + 1));
			const temp = this.p[i];
			this.p[i] = this.p[j];
			this.p[j] = temp;
		}

		this.perm = new Uint8Array(512);
		this.perm_mod_12 = new Uint8Array(512);
		for (let i = 0; i < 512; i++) {
			this.perm[i] = this.p[i & 255];
			this.perm_mod_12[i] = this.perm[i] % 12;
		}
	}

	/**
	 * Generates a noise value for the given x, y coordinates.
	 * @param {number} x
	 * @param {number} y
	 * @returns {number} A value between -1 and 1
	 */
	get(x, y) {
		x *= this.scaleX;
		y *= this.scaleY;
		const f_2 = 0.5 * (Math.sqrt(3.0) - 1.0);
		const g_2 = (3.0 - Math.sqrt(3.0)) / 6.0;

		let n_0, n_1, n_2; // Noise contributions from the three corners

		// Skew the input space to determine which simplex cell we're in
		const s = (x + y) * f_2;
		const i = Math.floor(x + s);
		const j = Math.floor(y + s);

		const t = (i + j) * g_2;
		const x_0_orig = i - t; // Unskew the cell origin back to (x,y) space
		const y_0_orig = j - t;
		const x_0 = x - x_0_orig; // The x,y distances from the cell origin
		const y_0 = y - y_0_orig;

		// For the 2D case, the simplex shape is an equilateral triangle.
		// Determine which simplex we are in.
		let i_1, j_1; // Offsets for second (middle) corner of simplex in (i,j) coords
		if (x_0 > y_0) {
			i_1 = 1;
			j_1 = 0;
		} else {
			// lower triangle, XY order: (0,0)->(0,1)->(1,1)
			i_1 = 0;
			j_1 = 1;
		}

		// A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
		// a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
		// c = (3-sqrt(3))/6
		const x_1 = x_0 - i_1 + g_2; // Offsets for middle corner in (x,y) unskewed coords
		const y_1 = y_0 - j_1 + g_2;
		const x_2 = x_0 - 1.0 + 2.0 * g_2; // Offsets for last corner in (x,y) unskewed coords
		const y_2 = y_0 - 1.0 + 2.0 * g_2;

		// Work out the hashed gradient indices of the three simplex corners
		const ii = i & 255;
		const jj = j & 255;
		const gi_0 = this.perm_mod_12[ii + this.perm[jj]];
		const gi_1 = this.perm_mod_12[ii + i_1 + this.perm[jj + j_1]];
		const gi_2 = this.perm_mod_12[ii + 1 + this.perm[jj + 1]];

		// Calculate the contribution from the three corners
		let t_0 = 0.5 - x_0 * x_0 - y_0 * y_0;
		if (t_0 < 0) n_0 = 0.0;
		else {
			t_0 *= t_0;
			n_0 = t_0 * t_0 * (this.grad_3[gi_0][0] * x_0 + this.grad_3[gi_0][1] * y_0);
		}

		let t_1 = 0.5 - x_1 * x_1 - y_1 * y_1;
		if (t_1 < 0) n_1 = 0.0;
		else {
			t_1 *= t_1;
			n_1 = t_1 * t_1 * (this.grad_3[gi_1][0] * x_1 + this.grad_3[gi_1][1] * y_1);
		}

		let t_2 = 0.5 - x_2 * x_2 - y_2 * y_2;
		if (t_2 < 0) n_2 = 0.0;
		else {
			t_2 *= t_2;
			n_2 = t_2 * t_2 * (this.grad_3[gi_2][0] * x_2 + this.grad_3[gi_2][1] * y_2);
		}

		// Add contributions from each corner to get the final noise value.
		// The result is scaled to return values in the interval [-1,1].
		return 70.0 * (n_0 + n_1 + n_2);
	}

	/**
	 * Generates a noise value for the given x, y coordinates mapped to the [0, 1] range.
	 * @param {number} x
	 * @param {number} y
	 * @returns {number} A value between 0 and 1
	 */
	get01(x, y) {
		return (this.get(x, y) + 1) / 2;
	}
}

class Noise3D {
	/**
	 * @param {number} seed
	 * @param {number} scale
	 */
	constructor(seed, scale = 1) {
		this.seed = seed;
		this.scale = scale;
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @returns {number}
	 */
	hash(x, y, z) {
		let value = this.seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
		value = Math.imul(value ^ (value >>> 13), 1274126177);
		value ^= value >>> 16;
		return (value >>> 0) / 4294967295;
	}

	/**
	 * @param {number} t
	 * @returns {number}
	 */
	smooth(t) {
		return t * t * (3 - 2 * t);
	}

	/**
	 * @param {number} a
	 * @param {number} b
	 * @param {number} t
	 * @returns {number}
	 */
	lerp(a, b, t) {
		return a + (b - a) * t;
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @returns {number}
	 */
	get01(x, y, z) {
		x *= this.scale;
		y *= this.scale;
		z *= this.scale;

		const x0 = Math.floor(x);
		const y0 = Math.floor(y);
		const z0 = Math.floor(z);
		const x1 = x0 + 1;
		const y1 = y0 + 1;
		const z1 = z0 + 1;

		const tx = this.smooth(x - x0);
		const ty = this.smooth(y - y0);
		const tz = this.smooth(z - z0);

		const c000 = this.hash(x0, y0, z0);
		const c100 = this.hash(x1, y0, z0);
		const c010 = this.hash(x0, y1, z0);
		const c110 = this.hash(x1, y1, z0);
		const c001 = this.hash(x0, y0, z1);
		const c101 = this.hash(x1, y0, z1);
		const c011 = this.hash(x0, y1, z1);
		const c111 = this.hash(x1, y1, z1);

		const ix00 = this.lerp(c000, c100, tx);
		const ix10 = this.lerp(c010, c110, tx);
		const ix01 = this.lerp(c001, c101, tx);
		const ix11 = this.lerp(c011, c111, tx);

		const iy0 = this.lerp(ix00, ix10, ty);
		const iy1 = this.lerp(ix01, ix11, ty);

		return this.lerp(iy0, iy1, tz);
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @returns {number}
	 */
	get(x, y, z) {
		return this.get01(x, y, z) * 2 - 1;
	}
}

/**
 * 1D noise generated by reading 2D noise in a circle.
 * Assures continuous noise that wraps around seamlessly.
 */
class RadialNoise {
	/**
	 * @param {number} seed
	 * @param {number} sample_radius Radius of the circle to sample from in the 2D noise space.
	 */
	constructor(seed, sample_radius = 1) {
		this.noise2d = new Noise2D(seed);
		this.sample_radius = sample_radius;
	}

	/**
	 * Generates a noise value for the given angle.
	 * @param {number} angle In radians.
	 * @returns {number} A value between -1 and 1
	 */
	get(angle) {
		const nx = Math.cos(angle) * this.sample_radius;
		const ny = Math.sin(angle) * this.sample_radius;
		return this.noise2d.get(nx, ny);
	}

	/**
	 * Generates a noise value for the given angle mapped to the [0, 1] range.
	 * @param {number} angle In radians.
	 * @returns {number} A value between 0 and 1
	 */
	get01(angle) {
		const nx = Math.cos(angle) * this.sample_radius;
		const ny = Math.sin(angle) * this.sample_radius;
		return this.noise2d.get01(nx, ny);
	}

	static shape(seed, size, min_coef, ...coef_radius_pairs) {
		let total_coef = min_coef;

		const noises = coef_radius_pairs.map(([coef, radius]) => {
			total_coef += coef;
			return {
				noise: new RadialNoise(seed + radius, radius),
				coef
			};
		});

		const min_radius = (min_coef / total_coef) * size;

		return (x, y, scale = 1) => {
			const dist = Math.sqrt(x * x + y * y);
			const angle = Math.atan2(y, x);
			let value = min_coef;

			for (const { noise, coef } of noises) {
				value += noise.get01(angle) * coef;
			}

			const max_radius = size * (value / total_coef) * scale;
			return dist / max_radius;
		};
	}
}

class GEN {
	static variantNoise(seed, count, scaleX, scaleY = scaleX) {
		const noises = Array.from({ length: count }, (_, i) => new Noise2D(seed + i, scaleX, scaleY));
		return (x, y) => {
			let best = -1,
				winner = 0;
			for (let i = 0; i < count; i++) {
				const val = noises[i].get01(x, y);
				if (val > best) {
					best = val;
					winner = i;
				}
			}
			return winner;
		};
	}

	static ore(seed, block_name, spread, exp) {
		const noises = [];
		for (const l of [0, 1, 2]) noises.push(new Noise2D(seed + l, 1 / spread));
		return (x, y, l) => (noises[l].get01(x, y) ** exp > 0.5 ? block_name : null);
	}

	static geode(seed, block_name, spread, exp) {
		const noises = [];
		for (const l of [0, 1, 2]) noises.push(new Noise2D(seed + l, 1 / spread));

		return (x, y, l) => {
			const val = noises[l].get01(x, y) ** exp;
			if (val > 0.7) return 'air';
			if (val > 0.6) return block_name;
			return null;
		};
	}

	static ores(seed, biome) {
		const ores = {
			plant: [
				{ name: 'iron_ore', spread: 10, exp: 6 },
				{ name: 'coal', spread: 20, exp: 3 }
			],
			arid: [
				{ name: 'dirt', spread: 20, exp: 2 },
				{ name: 'iron_ore', spread: 10, exp: 8 },
				{ name: 'copper_ore', spread: 15, exp: 4 },
				{ name: 'lead_ore', spread: 10, exp: 8 }
			],
			ice: [
				{ name: 'dirt', spread: 20, exp: 2 },
				{ name: 'raw_crystal', spread: 20, exp: 4, geode: true },
				{ name: 'titanium_ore', spread: 10, exp: 8 }
			],
			tectonic: [
				{ name: 'iron_ore', spread: 10, exp: 8 },
				{ name: 'copper_ore', spread: 15, exp: 4 },
				{ name: 'titanium_ore', spread: 10, exp: 8 },
				{ name: 'uranium_ore', spread: 5, exp: 10 }
			],
			crystal: [
				{ name: 'lead_ore', spread: 10, exp: 8 },
				{ name: 'raw_crystal', spread: 10, exp: 2, geode: true }
			],
			radioactive: [{ name: 'uranium_ore', spread: 10, exp: 10 }]
		};

		let count = 0;
		const ore_gens = [];

		for (const { name, spread, exp, geode } of ores[biome]) {
			const gen = geode ? GEN.geode : GEN.ore;
			ore_gens.push(gen(seed + count++ * 10, name, spread, exp));
		}

		return ore_gens;
	}

	static asteroidShape(seed, size) {
		const radial_noise = RadialNoise.shape(seed, size, 20, [70, 0.5], [10, 1.5]);
		const topography_noise = new Noise2D(seed + 1, 0.02);

		return (x, y, l) => {
			// Outline
			if (radial_noise(x, y) > 1) return 0;

			// Topography
			const topographys_val = Math.min(topography_noise.get01(x, y) * 5 + 0.1, 4);
			return craters_val > l + 1 ? craters_val : 0;
		};
	}

	static asteroid(size, biome) {
		const seed = Math.random() * 1000000;
		const shape = GEN.asteroidShape(seed, size);
		const ore_gens = GEN.ores(seed, biome);

		return (x, y, l) => {
			const terrain = shape(x, y, l);
			if (!terrain) return null;

			// Surface
			if (terrain < l + 2.2) {
				if (biome === 'arid') return 'sand';
				if (biome === 'ice') return 'ice';
			}

			// Ores
			for (const gen of ore_gens) {
				const ore = gen(x, y, l);
				if (ore) return ore === 'air' ? null : ore;
			}

			return 'rock';
		};
	}

	static planetShape(seed, size) {
		const radial_noise = RadialNoise.shape(seed, size, 90, [8, 0.5], [2, 1.5]);
		const topography_noise1 = new Noise2D(seed + 1, 0.005);
		const topography_noise2 = new Noise2D(seed + 2, 0.01);

		return (x, y, l) => {
			// Outline
			if (radial_noise(x, y) > 1) return 0;

			// Topography
			const t1 = topography_noise1.get01(x, y) ** 2 * 4;
			const t2 = topography_noise2.get01(x, y) * 1;
			const topography_val = Math.min(t1 + t2, 4);
			return topography_val > l ? topography_val : 0;
		};
	}

	static planet(seed, biome, radius) {
		const shape = GEN.planetShape(seed, radius);
		const ore_gens = GEN.ores(seed, biome);
		const polar_noise1 = new Noise2D(seed + 99, 0.01);
		const polar_noise2 = new Noise2D(seed + 100, 0.03);
		const rock_variant = GEN.variantNoise(seed + 101, 3, 0.01, 0.01);
		const veg_variant = GEN.variantNoise(seed + 104, 3, 0.01, 0.02);

		return (x, y, l) => {
			const terrain = shape(x, y, l);
			if (!terrain) return null;

			// Surface
			if (l > 1 || terrain < l + 1.1) {
				// Polar ice caps
				const polar_val = (polar_noise1.get01(x, y) + polar_noise2.get01(x, y)) / 2;
				const polar = Math.abs(y) / radius + polar_val * 0.2;
				if (polar > 0.9) return 'ice';

				// Vegetation variant: pick the index with the highest noise value
				const veg_variant_idx = veg_variant(x, y);
				return `vegetation:${veg_variant_idx}`;
			}

			// Dirt (just below surface)
			if (terrain < l + 2.1) return 'dirt';

			// Ores
			for (const gen of ore_gens) {
				const ore = gen(x, y, l);
				if (ore) return ore === 'air' ? null : ore;
			}

			// Rock variant: pick the index with the highest noise value
			const rock_variant_idx = rock_variant(x, y);
			return `rock:${rock_variant_idx}`;
		};
	}
}

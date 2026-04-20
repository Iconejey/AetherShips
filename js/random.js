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
	 */
	constructor(seed) {
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
}

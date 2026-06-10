/**
 * Custom HTMLElement representing the game, which contains entities (ships, asteroids, planets, etc.)
 */
class Game extends HTMLElement {
	static min_zoom = 0.001;
	static map_zoom = 0.5;
	static max_zoom = 20;
	static default_zoom = 8;

	// Asteroid biome ring thresholds
	static ASTEROID_BIOME_INNER_RING_RATIO = 0.2;
	static ASTEROID_BIOME_OUTER_RING_RATIO = 0.55;

	// Asteroid lifecycle tuning
	static ASTEROID_SPAWN_RADIUS_SECTORS = 1;
	static ASTEROID_DESPAWN_RADIUS_SECTORS = 0.5;
	static ASTEROID_IMMEDIATE_DESPAWN_RADIUS_SECTORS = 2;
	static ASTEROID_DESPAWN_DELAY_SECONDS = 300;
	static ASTEROID_TARGET_COUNT = 4;
	static ASTEROID_SPAWN_INTERVAL_SECONDS = 30;

	static kelvinToRGB(kelvin) {
		let temp = kelvin / 100;
		let r, g, b;

		if (temp <= 66) {
			r = 255;
			g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661));
			b = temp <= 19 ? 0 : Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
		} else {
			r = Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
			g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
			b = 255;
		}

		return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
	}

	static generateStars(seed) {
		const stars = [];
		const seen = new Set();
		const rng = new RNG(seed);

		const arms = 3;
		const twist = 0.4; // controls how curled the spiral is
		const center_width = 1.5; // width of the arm at the center
		const width_decay = 0.5; // how fast the width decays towards the edge
		const radius = 16; // controls the maximum radius of the galaxy

		for (let arm = 0; arm < arms; arm++) {
			const angle_offset = ((Math.PI * 2) / arms) * arm;

			// small steps to ensure no gaps
			for (let dist = 0; dist <= radius; dist += 0.2) {
				const angle = angle_offset + dist * twist;
				const cx = Math.cos(angle) * dist;
				const cy = Math.sin(angle) * dist;

				// Width of the arm at this distance (wider at center, thinner at ends)
				const width = center_width * Math.pow(1 - dist / radius, width_decay);

				const min_x = Math.floor(cx - width);
				const max_x = Math.ceil(cx + width);
				const min_y = Math.floor(cy - width);
				const max_y = Math.ceil(cy + width);

				for (let x = min_x; x <= max_x; x++) {
					for (let y = min_y; y <= max_y; y++) {
						const dist_to_arm_center = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
						if (dist_to_arm_center <= width) {
							// Higher probability of stars at the center of the arm, lower near the edge of the arm
							const probability = width === 0 ? 1 : 1 - (dist_to_arm_center / width) * 0.9;

							if (rng.get() <= probability) {
								const key = `${x},${y}`;
								if (!seen.has(key)) {
									seen.add(key);
									const kelvin = 4000 + Math.floor(rng.get() * rng.get() * 20000);
									stars.push({ sx: x - 1, sy: y - 1, color: Game.kelvinToRGB(kelvin) });
								}
							}
						}
					}
				}
			}
		}

		return stars.filter(s => -16 <= s.sx && s.sx <= 15 && -16 <= s.sy && s.sy <= 15);
	}

	static sfx(file_name) {
		window.audio?.sfx(file_name);
	}

	static async createGalaxy(name, seed) {
		const stars = Game.generateStars(seed);

		const data = {
			name,
			seed,
			stars,
			player: {
				position: { x: 0, y: 0, r: 0 },
				driven_entity: null
			}
		};

		await window.saves.createGalaxy(name, data);

		const rng = new RNG(seed);
		const sector_size = 32 * 256;
		const planet_biomes = ['plant', 'arid', 'ice', 'tectonic'];

		for (const star of stars) {
			const num_planets = Math.floor(rng.get() * 3); // 0, 1, or 2
			for (let i = 0; i < num_planets; i++) {
				const sector_center_x = star.sx * sector_size + sector_size / 2;
				const sector_center_y = star.sy * sector_size + sector_size / 2;

				// Scatter planets within the sector using the star's coordinates as the base range
				const offset_x = (rng.get() - 0.5) * sector_size * 0.8;
				const offset_y = (rng.get() - 0.5) * sector_size * 0.8;

				const x = sector_center_x + offset_x;
				const y = sector_center_y + offset_y;

				const biome = planet_biomes[Math.floor(rng.get() * planet_biomes.length)];
				const radius = 100 + Math.floor(rng.get() * 400); // 100 to 500
				const planet_seed = rng.get() * 100000;

				const planet = Entity.createPlanet({ x, y, r: 0 }, biome, radius, planet_seed, false);
				await window.saves.writeEntity(name, planet.serialize(), false);
			}
		}
	}

	/**
	 * Creates a game instance
	 */
	constructor() {
		super();
		window.game = this;
		this.camera = new Camera(0, 0, 0);
		this.animation_frame_id = null;
		this.last_frame_time = null;
		this.fps_counter = null;
		this.fps_timer = 0;
		this.fps_frame_count = 0;
		this.stars = [];
		this.prev_camera_x = 0;
		this.prev_camera_y = 0;
		this.prev_camera_r = 0;
		this.pressed_keys = {};
		this.viewport_center_x = window.innerWidth / 2;
		this.viewport_center_y = window.innerHeight / 2;
		this.has_prev_mouse_position = false;
		this.prev_mouse_x = 0;
		this.prev_mouse_y = 0;
		this.last_space_keydown_at = 0;
		this.space_double_press_window_ms = 300;
		this.start_menu_camera_rotation_offset_radians = -Math.PI / 4;
		this.scale = 1;
		this.camera_align_world = false;

		// Asteroid lifecycle instance state
		this.asteroid_spawn_timer_seconds = 0;
		this.asteroid_far_seconds_by_id = new Map();
		this.planet_cloud_offset_x = 0;
		this.planet_cloud_offset_z = 0;

		// Player instance
		this.player = null;
	}

	/**
	 * Debounced save planner. Schedules a save after a short delay, batching rapid edits.
	 */
	planSave(delay = 5000) {
		if (this.loading) return; // Don't save while loading
		if (document.body.classList.contains('start-menu')) return; // Don't save if we're in the start menu

		clearTimeout(this._save_timeout);
		this._save_timeout = setTimeout(() => this.save(), delay); // Debounce
	}

	/**
	 * Saves the current galaxy state to disk.
	 */
	async save() {
		if (!this.galaxy) throw new Error('No galaxy loaded');

		// Prevent concurrent saves
		if (this.saving) return console.warn('Save already in progress, skipping');
		this.saving = true;

		$('user-terminal').notify('Saving galaxy...');

		// Clean up temp save folder before writing new data
		await window.saves.clean(this.galaxy.name);

		// Save galaxy data
		await window.saves.writeGalaxy({ ...this.galaxy, player: this.player.serialize() });

		// Save each entity
		for (const entity of this.$$('entity-root')) await entity.save(this.galaxy.name);

		// Finalize save by replacing old save with new temp save
		await window.saves.finalize(this.galaxy.name);
		$('user-terminal').notify('Save complete.');
		this.saving = false;
	}

	/**
	 * Called when the element is inserted into the DOM. Initializes the game and starts the game loop.
	 */
	async connectedCallback() {
		await this.loadBlocks();

		this.scale = Game.default_zoom;
		this.style.setProperty('--game-scale', this.scale);
		document.body.classList.toggle('far-zoom', this.scale < 6);

		// Initialize stars first (so they're behind other elements)
		this.initializeStars();

		if (!this.fps_counter) {
			this.fps_counter = document.createElement('div');
			this.fps_counter.className = 'fps_counter';
			this.fps_counter.textContent = '0';
			this.appendChild(this.fps_counter);
		}

		// Add wheel event for scale control
		window.addEventListener(
			'wheel',
			event => {
				if (document.body.classList.contains('start-menu')) return;
				if (this.isUiWheelEvent(event)) return;

				const zoom_delta = event.deltaY * -0.01;

				if (this.mode !== 'navigation') {
					event.preventDefault();
					return this.zoomPanAtCursor(zoom_delta, event.clientX, event.clientY);
				}

				// Navigation mode: always zoom
				this.zoom(zoom_delta);
			},
			{ passive: false }
		);

		// Add mouse move controls for pan mode (active while Space is held)
		window.addEventListener('mousemove', event => {
			if (this.mode === 'navigation' || !this.isSpacePressed()) {
				this.has_prev_mouse_position = false;
				return;
			}

			if (!this.has_prev_mouse_position) {
				this.prev_mouse_x = event.clientX;
				this.prev_mouse_y = event.clientY;
				this.has_prev_mouse_position = true;
				return;
			}

			const delta_x = event.clientX - this.prev_mouse_x;
			const delta_y = event.clientY - this.prev_mouse_y;
			// Apply offset opposite to mouse movement
			this.camera.pan_offset_screen_x -= delta_x;
			this.camera.pan_offset_screen_y -= delta_y;
			this.prev_mouse_x = event.clientX;
			this.prev_mouse_y = event.clientY;
		});

		// Add resize listener to update entity positions and reset stars
		let resize_timeout = null;
		window.addEventListener('resize', () => {
			this.viewport_center_x = window.innerWidth / 2;
			this.viewport_center_y = window.innerHeight / 2;
			this.updateEntityPositions();
			clearTimeout(resize_timeout);
			resize_timeout = setTimeout(() => this.resetStars(), 200);
		});

		// Add keyboard controls for ZQSD movement and A/E strafing
		window.addEventListener('keydown', event => {
			const is_reload_shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r';
			if (is_reload_shortcut) {
				event.preventDefault();
				const should_reload = window.confirm('Reload the page? Unsaved changes may be lost.');
				if (should_reload) window.location.reload();
				return;
			}

			const is_compass_shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
			if (is_compass_shortcut) {
				event.preventDefault();
				this.camera_align_world = !this.camera_align_world;
				this.camera.startTransition();
				return;
			}

			if (event.key === 'Escape' || event.code === 'Escape') {
				// Exit map mode
				if (this.scale < Game.map_zoom) {
					// Smoothly transition scale back to default
					const zoom_transition = () => {
						this.scale += (Game.default_zoom - this.scale) * 0.15;
						this.style.setProperty('--game-scale', this.scale);
						document.body.classList.toggle('map-mode', this.scale < Game.map_zoom);
						document.body.classList.toggle('far-zoom', this.scale < 6);

						if (Math.abs(this.scale - Game.default_zoom) > 0.01) requestAnimationFrame(zoom_transition);
						else {
							this.scale = Game.default_zoom;
							this.style.setProperty('--game-scale', this.scale);
							document.body.classList.toggle('map-mode', false);
							document.body.classList.toggle('far-zoom', this.scale < 6);
						}
					};
					requestAnimationFrame(zoom_transition);
				}

				// Exit management mode
				else if (this.mode === 'management') this.mode = 'navigation';
			}

			this.pressed_keys[event.key] = true;

			if ((event.key === ' ' || event.code === 'Space') && !event.repeat) {
				const now = performance.now();
				const within_double_press_window = now - this.last_space_keydown_at <= this.space_double_press_window_ms;

				if (this.mode !== 'navigation' && within_double_press_window) {
					this.resetPanOffset();
					this.last_space_keydown_at = 0;
				} else {
					this.last_space_keydown_at = now;
				}
			}
		});

		window.addEventListener('keyup', event => {
			this.pressed_keys[event.key] = false;
			if (event.key === ' ' || event.key === 'Space') this.has_prev_mouse_position = false;
		});

		// Compass click toggle
		const compass_el = document.getElementById('compass');
		if (compass_el) {
			compass_el.addEventListener('click', () => {
				this.camera_align_world = !this.camera_align_world;
				this.camera.startTransition();
			});
		}

		this.fps_timer = 0;
		this.fps_frame_count = 0;
		this.startGameLoop();
		await this.startMenu();

		setTimeout(() => this.test?.(), 200);
	}

	async startMenu() {
		try {
			const illustration_ship = await Entity.fromTemplate('escape_pod', true, {
				position: { x: 0, y: 0 }
			});
			this.camera.followed_entity = illustration_ship;
			illustration_ship.classList.add('auto-thrust');
		} catch (err) {
			console.error('Failed to load start menu illustration ship template:', err);
			const illustration_ship = document.createElement('entity-root');
			this.appendChild(illustration_ship);
			illustration_ship.fillRect(1, -8, -16, 16, 32, 'iron_hull_tier_1');
			illustration_ship.render();
			this.camera.followed_entity = illustration_ship;
			illustration_ship.classList.add('auto-thrust');
		}
	}

	async loadGalaxy(name) {
		try {
			$$('entity-root').forEach(e => e.remove());
			this.loading = true;

			// Load galaxy data
			this.galaxy = await window.saves.loadGalaxy(name);

			// Initialize Player
			this.player = new Player(this.galaxy.player.position);
			this.current_sector_x = undefined;
			this.current_sector_y = undefined;

			// Load all entities near player
			await Entity.loadNearby(this.player.position, 1000);

			// Drive entity if player was driving
			const driven_entity_id = this.galaxy.player.driven_entity;
			if (driven_entity_id) {
				const driven_entity = Entity.get(driven_entity_id);
				this.player.drive(driven_entity);
			} else {
				const escape_pod = await Entity.fromTemplate('escape_pod', true, {
					position: this.player.position
				});
				this.player.drive(escape_pod);
			}

			this.resetStars();
			this.loading = false;
			document.body.classList.remove('start-menu');
			$('user-terminal').clear();
			$('user-terminal').mode = 'navigation';
		} catch (err) {
			console.error('Failed to load galaxy:', err);
			$('user-terminal').startMenu(() => $('user-terminal').error(`Failed to load galaxy: ${err.message}`));
		}
	}

	/**
	 * Tests for dev purposes
	 */
	async test() {
		// const saves = await window.saves.listGalaxies();
		// if (saves.length > 0) await this.loadGalaxy(saves[0].name);
		// const driven = game.player.driven_entity;
		// const position = driven?.position || game.player.position;
		// const planet = Entity.createPlanet({ ...position }, 'plant', 200, Math.random() * 100000, true);
		// game.player.drive(planet);
		// driven?.remove();
	}

	/**
	 * Picks an asteroid biome based on distance to galaxy center.
	 * Arid and ice can spawn everywhere; radioactive is inner-ring weighted; crystal is outer-ring weighted.
	 * @param {number} sector_x
	 * @param {number} sector_y
	 * @returns {string}
	 */
	pickAsteroidBiome(sector_x, sector_y) {
		const max_ring_distance = Math.sqrt(16 * 16 + 16 * 16);
		const ring_distance = Math.sqrt(sector_x * sector_x + sector_y * sector_y);
		const ring_ratio = ring_distance / max_ring_distance;

		const biome_pool = ['arid', 'ice'];
		if (ring_ratio <= Game.ASTEROID_BIOME_INNER_RING_RATIO) biome_pool.push('radioactive');
		if (ring_ratio >= Game.ASTEROID_BIOME_OUTER_RING_RATIO) biome_pool.push('crystal');

		const biome_index = Math.floor(Math.random() * biome_pool.length);
		return biome_pool[biome_index];
	}

	/**
	 * Attempts to spawn one asteroid in a random sector inside a 4-sector radius around the player.
	 * Skips sectors that contain stars.
	 * @returns {boolean}
	 */
	spawnAsteroidNearPlayer() {
		const player_position = this.player?.driven_entity?.position || this.player?.position;
		if (!player_position) return false;

		const sector_size = 32 * 256;
		const spawn_radius_world = Game.ASTEROID_SPAWN_RADIUS_SECTORS * sector_size;

		// Pick random angle and distance within radius
		const angle = Math.random() * Math.PI * 2;
		const distance = Math.random() * spawn_radius_world;

		const asteroid_x = player_position.x + Math.cos(angle) * distance;
		const asteroid_y = player_position.y + Math.sin(angle) * distance;
		const asteroid_rotation = Math.random() * Math.PI * 2;

		// Determine sector for biome selection
		const target_sector_x = Math.floor(asteroid_x / sector_size);
		const target_sector_y = Math.floor(asteroid_y / sector_size);

		// Check if in valid galaxy bounds
		if (target_sector_x < -16 || target_sector_x > 15 || target_sector_y < -16 || target_sector_y > 15) return false;

		// Check if sector has a star
		const sector_has_star = this.galaxy.stars?.some(star => star.sx === target_sector_x && star.sy === target_sector_y);
		if (sector_has_star) return false;

		const asteroid_biome = this.pickAsteroidBiome(target_sector_x, target_sector_y);
		const asteroid_size = 24 + Math.floor(Math.random() * 24);

		const asteroid = Entity.createAsteroid({ x: asteroid_x, y: asteroid_y, r: asteroid_rotation }, asteroid_biome, asteroid_size, true);

		this.planSave(1000);
		return true;
	}

	/**
	 * Spawns asteroids around the player and despawns distant ones after a grace delay.
	 * @param {number} delta_seconds
	 */
	updateAsteroidLifecycle(delta_seconds) {
		if (!this.player || document.body.classList.contains('start-menu')) return;

		const player_position = this.player.driven_entity?.position || this.player.position;
		if (!player_position) return;

		const sector_size = 32 * 256;
		const asteroids = Array.from(this.$$('entity-root[type="asteroid"]'));

		this.asteroid_spawn_timer_seconds += delta_seconds;
		if (this.asteroid_spawn_timer_seconds >= Game.ASTEROID_SPAWN_INTERVAL_SECONDS) {
			this.asteroid_spawn_timer_seconds = 0;

			if (asteroids.length < Game.ASTEROID_TARGET_COUNT) {
				const missing_count = Game.ASTEROID_TARGET_COUNT - asteroids.length;
				const spawn_attempts = Math.min(3, missing_count);
				for (let i = 0; i < spawn_attempts; i++) {
					this.spawnAsteroidNearPlayer();
				}
			}
		}

		const asteroid_ids = new Set();
		for (const asteroid of asteroids) {
			if (asteroid === this.player.driven_entity) continue;
			asteroid_ids.add(asteroid.id);

			const dx = asteroid.position.x - player_position.x;
			const dy = asteroid.position.y - player_position.y;
			const distance_sectors = Math.sqrt(dx * dx + dy * dy) / sector_size;

			if (distance_sectors >= Game.ASTEROID_IMMEDIATE_DESPAWN_RADIUS_SECTORS) {
				this.asteroid_far_seconds_by_id.delete(asteroid.id);
				asteroid.remove();
				this.planSave(1000);
				continue;
			}

			if (distance_sectors >= Game.ASTEROID_DESPAWN_RADIUS_SECTORS) {
				const far_seconds = (this.asteroid_far_seconds_by_id.get(asteroid.id) || 0) + delta_seconds;
				if (far_seconds >= Game.ASTEROID_DESPAWN_DELAY_SECONDS) {
					this.asteroid_far_seconds_by_id.delete(asteroid.id);
					asteroid.remove();
					this.planSave(1000);
					continue;
				}

				this.asteroid_far_seconds_by_id.set(asteroid.id, far_seconds);
				continue;
			}

			this.asteroid_far_seconds_by_id.delete(asteroid.id);
		}

		for (const asteroid_id of this.asteroid_far_seconds_by_id.keys()) {
			if (!asteroid_ids.has(asteroid_id)) this.asteroid_far_seconds_by_id.delete(asteroid_id);
		}
	}

	updatePlanetClouds(delta_seconds) {
		if (document.body.classList.contains('map-mode')) return;

		this.planet_cloud_offset_x += delta_seconds * 2;
		this.planet_cloud_offset_z += delta_seconds * 1;

		this.planet_cloud_timer_ms = (this.planet_cloud_timer_ms || 0) + delta_seconds * 1000;
		if (this.planet_cloud_timer_ms < 100) return;
		this.planet_cloud_timer_ms = 0;

		const planets = Array.from(this.$$('entity-root[type="planet"]'));
		for (const planet of planets) {
			if (!planet.radius || !planet.seed) continue;
			planet.ensureCloudCanvas();
			planet.renderClouds(this.planet_cloud_offset_x, this.planet_cloud_offset_z);
		}
	}

	/**
	 * Generates planet chunks that are visible in the current camera view, and unloads
	 * seed-generated chunks that have moved out of range.
	 */
	updatePlanetChunks() {
		if (document.body.classList.contains('map-mode')) return;

		const planets = Array.from(this.$$('entity-root[type="planet"]'));
		if (!planets.length) return;

		const vw = window.innerWidth;
		const vh = window.innerHeight;
		// Half-diagonal of the viewport in world units, plus one chunk of margin
		const view_radius = Math.sqrt((vw / 2) ** 2 + (vh / 2) ** 2) / this.scale + 32;
		const unload_radius = view_radius * 2;

		for (const planet of planets) {
			if (!planet.seed || !planet.biome || !planet.radius) continue;

			// Build/cache the generation function so noise objects aren't recreated every frame
			if (!planet._gen) planet._gen = GEN.planet(planet.seed, planet.biome, planet.radius);
			const gen = planet._gen;

			// Lazily create the atmosphere overlay
			if (!planet._atmosphere) {
				const atmosphere_colors = {
					plant: 'rgba(138, 154, 87, 0.2)',
					arid: 'rgba(220, 150, 50, 0.2)',
					ice: 'rgba(150, 220, 255, 0.2)',
					radioactive: 'rgba(180, 255, 50, 0.2)',
					crystal: 'rgba(180, 100, 255, 0.2)'
				};
				const atmosphere = document.createElement('div');
				atmosphere.className = 'planet-atmosphere';
				atmosphere.style.setProperty('--planet-radius', `${planet.radius}px`);
				atmosphere.style.setProperty('--atmosphere-color', atmosphere_colors[planet.biome] ?? 'rgba(100, 180, 255, 0.2)');
				planet.appendChild(atmosphere);
				planet._atmosphere = atmosphere;
			}

			planet.ensureCloudCanvas();

			if (!planet._generated_chunks) planet._generated_chunks = new Set();

			// Camera center in planet-local block coordinates
			const cam_x = this.camera.x - planet.position.x;
			const cam_y = this.camera.y - planet.position.y;

			const planet_chunk_radius = Math.ceil(planet.radius / 32) + 1;

			const min_cx = Math.max(Math.floor((cam_x - view_radius) / 32), -planet_chunk_radius);
			const max_cx = Math.min(Math.ceil((cam_x + view_radius) / 32), planet_chunk_radius);
			const min_cy = Math.max(Math.floor((cam_y - view_radius) / 32), -planet_chunk_radius);
			const max_cy = Math.min(Math.ceil((cam_y + view_radius) / 32), planet_chunk_radius);

			for (let cy = min_cy; cy <= max_cy; cy++) {
				for (let cx = min_cx; cx <= max_cx; cx++) {
					const chunk_center_x = cx * 32 + 16;
					const chunk_center_y = cy * 32 + 16;

					// Skip chunk entirely outside the planet's radius
					if (Math.sqrt(chunk_center_x ** 2 + chunk_center_y ** 2) > planet.radius + 32) continue;

					// Skip chunk outside the visible area
					const dx = chunk_center_x - cam_x;
					const dy = chunk_center_y - cam_y;
					if (Math.sqrt(dx ** 2 + dy ** 2) > view_radius) continue;

					const key = `${cx},${cy}`;
					if (planet._generated_chunks.has(key)) continue;

					// If already loaded from a save, just mark as known and skip generation
					if (planet.getChunkLayer(0, cx, cy, false)?.layer) {
						planet._generated_chunks.add(key);
						continue;
					}

					planet._generated_chunks.add(key);
					planet.generateChunkFromSeed(cx, cy, gen);
				}
			}

			// Unload seed-generated chunks that are beyond the unload radius
			const layer0 = planet.getEntityLayer(0, false);
			if (!layer0) continue;
			const keys_to_unload = [];
			for (const [key, chunk_layer] of layer0.chunk_layers) {
				if (!chunk_layer.layer?.seed_generated) continue;
				const chunk_center_x = chunk_layer.chunk_x * 32 + 16;
				const chunk_center_y = chunk_layer.chunk_y * 32 + 16;
				const dx = chunk_center_x - cam_x;
				const dy = chunk_center_y - cam_y;
				if (Math.sqrt(dx ** 2 + dy ** 2) > unload_radius) keys_to_unload.push({ key, cx: chunk_layer.chunk_x, cy: chunk_layer.chunk_y });
			}
			for (const { key, cx, cy } of keys_to_unload) {
				for (let l = 0; l < 3; l++) planet.getEntityLayer(l, false)?.removeChunkLayer(cx, cy);
				planet._generated_chunks.delete(key);
			}
		}
	}

	get mode() {
		return $('tool-bar multi-select').value;
	}

	set mode(new_mode) {
		$('tool-bar multi-select').value = new_mode;
	}

	get selected_layer() {
		return +$('side-bar multi-select#edit-layer').value;
	}

	get selected_block() {
		return $('side-bar #block-list .active')?.getAttribute('data-value');
	}

	set selected_block(block_name) {
		const block_button = $(`#block-list button[data-value="${block_name}"]`);
		block_button?.click();
	}

	get selected_paint_color() {
		return $('side-bar #paint-color-picker')?.value;
	}

	set selected_paint_color(new_color) {
		const picker = $('side-bar #paint-color-picker');
		if (picker) picker.value = new_color;
	}

	get selected_tool() {
		return $('side-bar multi-select#edit-tools')?.value;
	}

	set selected_tool(tool_name) {
		const tools = $('side-bar multi-select#edit-tools');
		if (tools) tools.value = tool_name;
	}

	get edit_mode() {
		return $('side-bar multi-select#edit-mode')?.value;
	}

	/**
	 * Updates the FPS counter display
	 * @param {number} delta_seconds - Elapsed time in seconds since last frame
	 */
	updateFpsCounter(delta_seconds) {
		if (!this.fps_counter) return;

		this.fps_timer += delta_seconds;
		this.fps_frame_count++;

		if (this.fps_timer >= 0.25) {
			const fps = Math.round(this.fps_frame_count / this.fps_timer);
			this.fps_counter.textContent = fps;
			this.fps_timer = 0;
			this.fps_frame_count = 0;
		}
	}

	/**
	 * Removes existing stars and re-initializes them for the current viewport size
	 */
	resetStars() {
		const existing_container = this.querySelector('.stars-container');
		if (existing_container) existing_container.remove();
		this.stars = [];
		this.initializeStars();
	}

	/**
	 * Initializes 100 stars with random positions on a circle and various depths
	 */
	initializeStars() {
		const stars_container = document.createElement('div');
		stars_container.className = 'stars-container';
		this.appendChild(stars_container);

		const viewport_diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
		const circle_radius = viewport_diagonal / 2 + 100;

		for (let i = 0; i < 100; i++) {
			const angle = Math.random() * Math.PI * 2;
			const depth = Math.random();
			// Use sqrt for uniform distribution within circle area
			const radius = circle_radius * Math.sqrt(Math.random());

			const star = {
				x: Math.cos(angle) * radius,
				y: Math.sin(angle) * radius,
				depth: depth,
				angle: angle,
				radius: radius,
				element: null
			};

			// Create star element
			const element = document.createElement('div');
			element.className = 'star';
			const opacity = depth;
			element.style.opacity = opacity;
			stars_container.appendChild(element);
			star.element = element;

			this.stars.push(star);
		}

		this.prev_camera_x = this.camera.x;
		this.prev_camera_y = this.camera.y;
		this.prev_camera_r = this.camera.r;
	}

	/**
	 * Updates star positions based on camera movement and handles wrapping
	 */
	updateStars() {
		if (this.stars.length === 0) return;

		const prev_camera_rotation = this.prev_camera_r;
		const delta_x = this.camera.x - this.prev_camera_x;
		const delta_y = this.camera.y - this.prev_camera_y;
		const delta_r = this.camera.r - this.prev_camera_r;

		this.prev_camera_x = this.camera.x;
		this.prev_camera_y = this.camera.y;
		this.prev_camera_r = this.camera.r;

		// Convert camera world movement back into the current screen basis.
		// This keeps parallax aligned with pan-mode panning after rotation.
		const scaled_delta_x = delta_x * this.scale;
		const scaled_delta_y = delta_y * this.scale;
		const cos_r = Math.cos(-prev_camera_rotation);
		const sin_r = Math.sin(-prev_camera_rotation);
		const screen_delta_x = scaled_delta_x * cos_r - scaled_delta_y * sin_r;
		const screen_delta_y = scaled_delta_x * sin_r + scaled_delta_y * cos_r;

		const viewport_diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
		const max_circle_radius = viewport_diagonal / 2;

		for (const star of this.stars) {
			// Move opposite to camera movement (in screen-space), scaled by depth (closer = faster)
			star.x -= screen_delta_x * star.depth * 0.3;
			star.y -= screen_delta_y * star.depth * 0.3;

			// Rotate opposite to camera rotation (not scaled by depth)
			if (delta_r !== 0) {
				const rotation_amount = -delta_r;
				const cos_rot = Math.cos(rotation_amount);
				const sin_rot = Math.sin(rotation_amount);
				const rotated_x = star.x * cos_rot - star.y * sin_rot;
				const rotated_y = star.x * sin_rot + star.y * cos_rot;
				star.x = rotated_x;
				star.y = rotated_y;
			}

			// Check if star is outside circle and wrap it
			const distance = Math.sqrt(star.x ** 2 + star.y ** 2);
			if (distance > max_circle_radius) {
				const angle = Math.atan2(star.y, star.x);
				const opposite_angle = angle + Math.PI * (1 - (Math.random() - 0.5));
				const new_radius = max_circle_radius * 0.8;
				star.x = Math.cos(opposite_angle) * new_radius;
				star.y = Math.sin(opposite_angle) * new_radius;
				star.angle = opposite_angle;
				star.radius = new_radius;
			}

			// Update CSS position for this star
			const screen_x = this.viewport_center_x + star.x;
			const screen_y = this.viewport_center_y + star.y;
			star.element.style.left = `${screen_x}px`;
			star.element.style.top = `${screen_y}px`;
		}
	}

	/**
	 * Handles keyboard input to control the followed entity
	 * @param {number} delta_frames - Elapsed time in frames since last frame
	 */
	handleKeyboardInput(delta_frames) {
		if (!this.camera.followed_entity) return;

		this.camera.followed_entity.active_maneuvers.clear();

		if (this.mode !== 'navigation') return;
		if (document.body.classList.contains('start-menu')) return;

		// Rotation controls
		if (this.pressed_keys['q'] || this.pressed_keys['Q']) {
			this.camera.followed_entity.active_maneuvers.add('turn_left');
		}
		if (this.pressed_keys['d'] || this.pressed_keys['D']) {
			this.camera.followed_entity.active_maneuvers.add('turn_right');
		}

		// Forward/backward movement
		if (this.pressed_keys['z'] || this.pressed_keys['Z']) {
			this.camera.followed_entity.active_maneuvers.add('forward');
		}
		if (this.pressed_keys['s'] || this.pressed_keys['S']) {
			this.camera.followed_entity.active_maneuvers.add('backward');
		}

		// Left/right strafing
		if (this.pressed_keys['a'] || this.pressed_keys['A']) {
			this.camera.followed_entity.active_maneuvers.add('strafe_left');
		}
		if (this.pressed_keys['e'] || this.pressed_keys['E']) {
			this.camera.followed_entity.active_maneuvers.add('strafe_right');
		}

		// Brake
		if (this.pressed_keys['x'] || this.pressed_keys['X']) {
			const ent = this.camera.followed_entity;
			const { vx, vy, vr } = ent.velocity || { vx: 0, vy: 0, vr: 0 };

			if (Math.abs(vr) > 0.001) {
				if (vr > 0) ent.active_maneuvers.add('turn_left');
				else ent.active_maneuvers.add('turn_right');
			}

			const a = ent.position.r;
			const cos_a = Math.cos(a);
			const sin_a = Math.sin(a);

			const vx_local = vx * cos_a + vy * sin_a;
			const vy_local = -vx * sin_a + vy * cos_a;

			if (Math.abs(vx_local) > 0.01) {
				if (vx_local > 0) ent.active_maneuvers.add('strafe_left');
				else ent.active_maneuvers.add('strafe_right');
			}
			if (Math.abs(vy_local) > 0.01) {
				if (vy_local > 0) ent.active_maneuvers.add('forward');
				else ent.active_maneuvers.add('backward');
			}
		}
	}

	/**
	 * Updates entity positions based on velocities and applies friction
	 * @param {number} delta_seconds - Elapsed time in seconds since last frame
	 */
	updateEntities(delta_seconds) {
		const delta_frames = delta_seconds * 60;
		const friction_factor = 0.99 ** delta_frames;

		// Handle keyboard input for followed entity
		this.handleKeyboardInput(delta_frames);

		const auto_thrust_force = 0.02;

		for (const entity of this.children) {
			if (!(entity instanceof Entity)) continue;
			if (entity.type === 'planet') continue;

			if (!entity.active_maneuvers) {
				entity.active_maneuvers = new Set();
			}

			if (entity.classList.contains('auto-thrust')) {
				entity.active_maneuvers.add('forward');
			}

			entity.applyNewtonianPhysics(delta_frames, friction_factor);
		}

		// If the player is driving an entity, update player position to match the entity
		if (this.player?.driven_entity) {
			const driven = this.player.driven_entity;
			this.player.setPosition(driven.position.x, driven.position.y, driven.position.r);
		}

		// Update camera to follow entity if one is being followed
		const followed_entity = this.camera.followed_entity;
		if (followed_entity) {
			const is_start_menu_camera = document.body.classList.contains('start-menu') && followed_entity.classList.contains('auto-thrust');

			if (is_start_menu_camera) {
				const cos_a = Math.cos(followed_entity.position.r);
				const sin_a = Math.sin(followed_entity.position.r);
				const com_world_x = followed_entity.position.x + cos_a * (followed_entity.mass?.cx || 0) - sin_a * (followed_entity.mass?.cy || 0);
				const com_world_y = followed_entity.position.y + sin_a * (followed_entity.mass?.cx || 0) + cos_a * (followed_entity.mass?.cy || 0);

				this.camera.moveTo(com_world_x, com_world_y, followed_entity.position.r + this.start_menu_camera_rotation_offset_radians);
			} else {
				this.camera.update(followed_entity, this.scale, this.mode !== 'navigation', this.camera_align_world, delta_seconds);
			}
		}

		this.updateAsteroidLifecycle(delta_seconds);
		this.updatePlanetLifecycle();
		this.updatePlanetChunks();
		this.updatePlanetClouds(delta_seconds);
	}

	async updatePlanetLifecycle() {
		if (this.is_updating_planets) return;
		if (!this.player || document.body.classList.contains('start-menu')) return;

		const player_position = this.player.driven_entity?.position || this.player.position;
		if (!player_position) return;

		const sector_size = 32 * 256;
		const sx = Math.floor(player_position.x / sector_size);
		const sy = Math.floor(player_position.y / sector_size);

		if (this.current_sector_x === sx && this.current_sector_y === sy) return;

		this.is_updating_planets = true;

		try {
			// Unload planets that are outside the 3x3 sector grid centered on the player
			const active_planets = Array.from(this.$$('entity-root[type="planet"]'));
			for (const planet of active_planets) {
				const psx = Math.floor(planet.position.x / sector_size);
				const psy = Math.floor(planet.position.y / sector_size);

				if (Math.abs(psx - sx) > 1 || Math.abs(psy - sy) > 1) {
					await planet.save();
					planet.remove();
				}
			}

			// Load planets from the 3x3 sectors
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const pos = {
						x: (sx + dx) * sector_size,
						y: (sy + dy) * sector_size
					};

					const serialized_entities = await window.saves.loadEntities(this.galaxy.name, pos);
					for (const seq of serialized_entities) {
						if (seq.type === 'planet' && !Entity.get(seq.id)) {
							await Entity.fromSerialized(seq, true);
						}
					}
				}
			}

			this.current_sector_x = sx;
			this.current_sector_y = sy;
		} catch (err) {
			console.error('Failed to update planet lifecycle sectors:', err);
		} finally {
			this.is_updating_planets = false;
		}
	}

	/**
	 * Starts the game loop using requestAnimationFrame
	 */
	startGameLoop() {
		const tick = now => {
			if (this.last_frame_time === null) {
				this.last_frame_time = now;
			}

			const delta_seconds = Math.min((now - this.last_frame_time) / 1000, 0.1);
			this.last_frame_time = now;

			this.updateEntities(delta_seconds);
			this.updateStars();
			this.updateFpsCounter(delta_seconds);
			this.updateEntityPositions();

			// --- Synchronize view-overlay rendering ---
			document.querySelector('view-overlay')?.draw();

			// Update compass rotation
			const compass_el = document.getElementById('compass');
			if (compass_el && this.camera) {
				compass_el.style.transform = `rotate(${-this.camera.r}rad)`;
			}

			// Update navigation controls visibility
			const nav_controls_el = document.querySelector('navigation-controls');
			if (nav_controls_el) {
				nav_controls_el.style.display = ['navigation', 'management'].includes(this.mode) && !document.body.classList.contains('start-menu') ? 'flex' : 'none';
			}

			this.animation_frame_id = window.requestAnimationFrame(tick);
		};

		if (this.animation_frame_id === null) {
			this.animation_frame_id = window.requestAnimationFrame(tick);
		}
	}

	/**
	 * Stops the game loop
	 */
	stopGameLoop() {
		if (this.animation_frame_id !== null) {
			window.cancelAnimationFrame(this.animation_frame_id);
			this.animation_frame_id = null;
		}
		this.last_frame_time = null;
	}

	/**
	 * Updates the audio muffle based on game state
	 */
	updateAudio() {
		this.audio_muffle = this.audio_muffle ?? 0;
		let target_muffle = 0;

		if (!document.body.classList.contains('start-menu')) {
			let speed_ratio = 0;
			const driven_entity = this.player?.driven_entity;
			if (driven_entity) {
				const vx = driven_entity.velocity.vx;
				const vy = driven_entity.velocity.vy;
				const speed = Math.sqrt(vx * vx + vy * vy);
				const sectors_per_minute = (speed * 60 * 60) / (32 * 256);

				const max_expected_speed = 0.8; // Sectors per minute
				speed_ratio = Math.min(sectors_per_minute / max_expected_speed, 1);
			}

			target_muffle = 100 - speed_ratio * 100;
		}

		// Smoothly interpolate current muffle towards the target to prevent abrupt audio changes
		this.audio_muffle += (target_muffle - this.audio_muffle) * 0.01;

		window.audio?.setMuffle(this.audio_muffle);
	}

	/**
	 * Adjusts the game scale by the given delta
	 * @param {number} delta - The amount to adjust the scale by
	 */
	zoom(delta) {
		const zoom_speed = 0.15;
		const zoom_factor = Math.exp(delta * zoom_speed);
		this.scale = Math.min(Math.max(Game.min_zoom, this.scale * zoom_factor), Game.max_zoom);
		this.style.setProperty('--game-scale', this.scale);
		document.body.classList.toggle('map-mode', this.scale < Game.map_zoom);
		document.body.classList.toggle('far-zoom', this.scale < 6);
	}

	/**
	 * Returns true when a wheel event originates from UI controls.
	 * This lets UI panels use native wheel scrolling without triggering game zoom.
	 * @param {WheelEvent} event - Wheel event to inspect
	 * @returns {boolean}
	 */
	isUiWheelEvent(event) {
		const target_element = event.target;
		if (!(target_element instanceof Element)) return false;
		return Boolean(target_element.closest('.ui'));
	}

	/**
	 * Returns true when the space key is currently pressed
	 * @returns {boolean}
	 */
	isSpacePressed() {
		return Boolean(this.pressed_keys[' '] || this.pressed_keys['Space']);
	}

	/**
	 * Resets pan camera offset and re-centers the followed entity
	 */
	resetPanOffset() {
		this.camera.pan_offset_screen_x = 0;
		this.camera.pan_offset_screen_y = 0;
		this.has_prev_mouse_position = false;

		if (this.camera.followed_entity && this.mode !== 'navigation') {
			this.camera.update(this.camera.followed_entity, this.scale, true, this.camera_align_world);
		}
	}

	/**
	 * Zooms while keeping cursor world focus stable by updating pan screen offset. Zoomin in makes the world appear to move towards the cursor, zooming out makes it move away. It's like using the pointer as the scale transform origin.
	 * @param {number} delta - Wheel-based zoom delta
	 * @param {number} client_x - Mouse x position in viewport
	 * @param {number} client_y - Mouse y position in viewport
	 */
	zoomPanAtCursor(delta, client_x, client_y) {
		// 1. Normalize zoom speed for consistent feel
		const zoom_speed = 0.15;

		// 2. Calculate multiplicative factor using an exponential curve
		// This ensures smooth, reversible zooming regardless of device
		const zoom_factor = Math.exp(delta * zoom_speed);

		const old_scale = this.scale;
		let new_scale = Math.max(Game.min_zoom, Math.min(Game.max_zoom, old_scale * zoom_factor));

		// Calculate the actual ratio used (crucial for precision near scale bounds)
		const ratio = new_scale / old_scale;

		// 3. Relative coordinates from viewport center
		// Note: We invert the vector to match the specific rendering coordinate system
		const rel_x = -(client_x - this.viewport_center_x);
		const rel_y = -(client_y - this.viewport_center_y);

		// 4. Current screen offsets
		const ox = this.camera.pan_offset_screen_x || 0;
		const oy = this.camera.pan_offset_screen_y || 0;

		// 5. Update offset using the pivot transformation formula
		// This anchors the point under the cursor during the scale change
		this.camera.pan_offset_screen_x = rel_x - (rel_x - ox) * ratio;
		this.camera.pan_offset_screen_y = rel_y - (rel_y - oy) * ratio;

		// 6. Apply final scale to the state and CSS variable
		this.scale = new_scale;
		this.style.setProperty('--game-scale', this.scale);
		document.body.classList.toggle('map-mode', this.scale < Game.map_zoom);
		document.body.classList.toggle('far-zoom', this.scale < 6);
	}

	/**
	 * Updates the CSS position and rotation of all entity children based on their world position relative to the camera
	 */
	updateEntityPositions() {
		const viewport_width = window.innerWidth;
		const viewport_height = window.innerHeight;
		const viewport_center_x = viewport_width / 2;
		const viewport_center_y = viewport_height / 2;

		for (const entity of this.children) {
			if (!(entity instanceof Entity)) continue;

			const screen_pos = this.camera.worldToScreen(entity.position.x, entity.position.y, this.scale);
			const entity_rotation_relative_to_camera = entity.position.r - this.camera.r;

			entity.style.left = `${viewport_center_x + screen_pos.x}px`;
			entity.style.top = `${viewport_center_y + screen_pos.y}px`;
			entity.style.setProperty('--entity-rotation', `${entity_rotation_relative_to_camera}rad`);
		}
	}

	async loadBlocks() {
		const data = await fetch('blocks.json').then(r => r.json());

		block_categories = data;
		for (const category in block_categories) {
			for (const block of block_categories[category]) {
				// Normalize colors: if array of arrays, each sub-array is a variant; if flat, wrap in one variant
				const raw_colors = block.colors;
				const is_multi = Array.isArray(raw_colors[0]);
				block.colors = is_multi ? raw_colors[0].map(hexToRgba8888) : raw_colors.map(hexToRgba8888);
				block.category = category;
				blocks_by_type[block.type] = block;
				blocks_by_name[block.name] = block;
				const makeInit = colors => paint_color => {
					// Get default color
					let block_default_color = oneOf(colors);

					// Get default alpha (needed even with paint color)
					const block_default_alpha = block_default_color & 0xff;

					// If paint color is a string, convert to uint32
					if (typeof paint_color === 'string') paint_color = hexToRgba8888(paint_color);

					// If paint color provided, apply default alpha to it
					if (paint_color !== null) paint_color = (paint_color & 0xffffff00) | block_default_alpha;

					// If paint provided and block can be painted, use paint color; otherwise use default color
					const color = paint_color !== null && block.can_be_painted ? paint_color : block_default_color;

					return {
						type: block.type,
						health: block.health,
						is_burning: 0,
						color
					};
				};

				block.init = makeInit(block.colors);

				// Register named variants (e.g. "rock:0", "rock:1") if colors is an array of arrays
				if (is_multi) {
					raw_colors.forEach((variant_hex_colors, i) => {
						const variant_colors = variant_hex_colors.map(hexToRgba8888);
						const variant_entry = Object.assign({}, block, { colors: variant_colors });
						variant_entry.init = makeInit(variant_colors);
						blocks_by_name[`${block.name}:${i}`] = variant_entry;
					});
				}
			}
		}
	}
}

customElements.define('game-root', Game);

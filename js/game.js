/**
 * Custom HTMLElement representing the game, which contains entities (ships, asteroids, planets, etc.)
 */
class Game extends HTMLElement {
	static min_zoom = 0.001;
	static map_zoom = 0.5;
	static max_zoom = 20;

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

		this.scale = 8;
		this.style.setProperty('--game-scale', this.scale);

		// Initialize stars first (so they're behind other elements)
		this.initializeStars();

		// Start background music
		window.audio?.setGalaxyLoaded(false);
		window.audio?.playTrack('passing into shadow.strudel');

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
				if (this.isUiWheelEvent(event)) return;

				const zoom_delta = event.deltaY * -0.01;

				if (this.mode !== 'navigation') {
					event.preventDefault();
					return this.zoomInspectAtCursor(zoom_delta, event.clientX, event.clientY);
				}

				// Navigation mode: always zoom
				this.zoom(zoom_delta);
			},
			{ passive: false }
		);

		// Add mouse move controls for inspect mode (active while Space is held)
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
			this.camera.inspect_offset_screen_x -= delta_x;
			this.camera.inspect_offset_screen_y -= delta_y;
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

			this.pressed_keys[event.key] = true;

			if ((event.key === ' ' || event.code === 'Space') && !event.repeat) {
				const now = performance.now();
				const within_double_press_window = now - this.last_space_keydown_at <= this.space_double_press_window_ms;

				if (this.mode !== 'navigation' && within_double_press_window) {
					this.resetInspectOffset();
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

		this.fps_timer = 0;
		this.fps_frame_count = 0;
		this.startGameLoop();
		await this.startMenu();

		setTimeout(() => this.test(), 1);
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

			// Load all entities near player
			await Entity.loadNearby(this.player.position, 1000);

			// Drive entity if player was driving
			const driven_entity_id = this.galaxy.player.driven_entity;
			if (driven_entity_id) {
				const driven_entity = Entity.get(driven_entity_id);
				this.player.drive(driven_entity);
			}

			this.resetStars();
			this.loading = false;
			document.body.classList.remove('start-menu');
			window.audio?.setGalaxyLoaded(true);
		} catch (err) {
			console.error('Failed to load galaxy:', err);
			$('user-terminal').startMenu(() => $('user-terminal').error(`Failed to load galaxy: ${err.message}`));
		}
	}

	/**
	 * Tests for dev purposes
	 */
	test() {
		// // Test planet
		// const test_planet = document.createElement('entity-root');
		// this.appendChild(test_planet);
		// test_planet.fillEllipse(0, 0, 0, 64, 64, 'rock');
		// test_planet.fillEllipse(1, 0, 0, 48, 48, 'dirt');
		// test_planet.fillEllipse(2, 0, 0, 32, 32, 'vegetation');
		// test_planet.render();
		// // Test ship
		// const test_ship = document.createElement('entity-root');
		// this.appendChild(test_ship);
		// test_ship.fillRect(2, -8, -16, 16, 32, 'iron_hull_tier_1');
		// test_ship.render();
		// // Follow ship with camera
		// this.camera.followed_entity = test_ship;
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
		return $('side-bar #paint-color-picker').value;
	}

	set selected_paint_color(new_color) {
		$('side-bar #paint-color-picker').value = new_color;
	}

	get selected_tool() {
		return $('side-bar multi-select#edit-tools').value;
	}

	set selected_tool(tool_name) {
		$('side-bar multi-select#edit-tools').value = tool_name;
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
		// This keeps parallax aligned with inspect-mode panning after rotation.
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
		if (this.mode !== 'navigation') return;
		if (document.body.classList.contains('start-menu')) return;

		const thrust_force = 0.02;
		const rotation_speed = 0.001;
		const angle = this.camera.followed_entity.position.r;

		// Rotation controls
		if (this.pressed_keys['q'] || this.pressed_keys['Q']) {
			this.camera.followed_entity.velocity.vr -= rotation_speed * delta_frames * 0.5;
		}
		if (this.pressed_keys['d'] || this.pressed_keys['D']) {
			this.camera.followed_entity.velocity.vr += rotation_speed * delta_frames * 0.5;
		}

		// Forward/backward movement
		if (this.pressed_keys['z'] || this.pressed_keys['Z']) {
			this.camera.followed_entity.velocity.vx += Math.sin(angle) * thrust_force * delta_frames;
			this.camera.followed_entity.velocity.vy -= Math.cos(angle) * thrust_force * delta_frames;
		}
		if (this.pressed_keys['s'] || this.pressed_keys['S']) {
			this.camera.followed_entity.velocity.vx -= Math.sin(angle) * thrust_force * delta_frames;
			this.camera.followed_entity.velocity.vy += Math.cos(angle) * thrust_force * delta_frames;
		}

		// Left/right strafing
		if (this.pressed_keys['a'] || this.pressed_keys['A']) {
			this.camera.followed_entity.velocity.vx -= Math.cos(angle) * thrust_force * delta_frames;
			this.camera.followed_entity.velocity.vy -= Math.sin(angle) * thrust_force * delta_frames;
		}
		if (this.pressed_keys['e'] || this.pressed_keys['E']) {
			this.camera.followed_entity.velocity.vx += Math.cos(angle) * thrust_force * delta_frames;
			this.camera.followed_entity.velocity.vy += Math.sin(angle) * thrust_force * delta_frames;
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

			if (entity.classList.contains('auto-thrust')) {
				const angle = entity.position.r;
				entity.velocity.vx += Math.sin(angle) * auto_thrust_force * delta_frames;
				entity.velocity.vy -= Math.cos(angle) * auto_thrust_force * delta_frames;
			}

			entity.position.x += entity.velocity.vx * delta_frames;
			entity.position.y += entity.velocity.vy * delta_frames;
			entity.position.r += entity.velocity.vr * delta_frames;

			entity.velocity.vx *= friction_factor;
			entity.velocity.vy *= friction_factor;
			entity.velocity.vr *= friction_factor;

			if (Math.abs(entity.velocity.vx) < 0.0001) entity.velocity.vx = 0;
			if (Math.abs(entity.velocity.vy) < 0.0001) entity.velocity.vy = 0;
			if (Math.abs(entity.velocity.vr) < 0.0001) entity.velocity.vr = 0;
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
				this.camera.moveTo(followed_entity.position.x, followed_entity.position.y, followed_entity.position.r + this.start_menu_camera_rotation_offset_radians);
			} else {
				this.camera.update(followed_entity, this.scale, this.mode !== 'navigation');
			}
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

			// --- Synchronize edit-preview rendering ---
			const editPreview = document.querySelector('edit-preview');
			if (editPreview && typeof editPreview.draw === 'function') {
				editPreview.draw();
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
	 * Adjusts the game scale by the given delta
	 * @param {number} delta - The amount to adjust the scale by
	 */
	zoom(delta) {
		const zoom_speed = 0.15;
		const zoom_factor = Math.exp(delta * zoom_speed);
		this.scale = Math.min(Math.max(Game.min_zoom, this.scale * zoom_factor), Game.max_zoom);
		this.style.setProperty('--game-scale', this.scale);
		document.body.classList.toggle('map-mode', this.scale < Game.map_zoom);
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
	 * Resets inspect camera offset and re-centers the followed entity
	 */
	resetInspectOffset() {
		this.camera.inspect_offset_screen_x = 0;
		this.camera.inspect_offset_screen_y = 0;
		this.has_prev_mouse_position = false;

		if (this.camera.followed_entity && this.mode !== 'navigation') {
			this.camera.update(this.camera.followed_entity, this.scale, true);
		}
	}

	/**
	 * Zooms while keeping cursor world focus stable by updating inspect screen offset. Zoomin in makes the world appear to move towards the cursor, zooming out makes it move away. It's like using the pointer as the scale transform origin.
	 * @param {number} delta - Wheel-based zoom delta
	 * @param {number} client_x - Mouse x position in viewport
	 * @param {number} client_y - Mouse y position in viewport
	 */
	zoomInspectAtCursor(delta, client_x, client_y) {
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
		const ox = this.camera.inspect_offset_screen_x || 0;
		const oy = this.camera.inspect_offset_screen_y || 0;

		// 5. Update offset using the pivot transformation formula
		// This anchors the point under the cursor during the scale change
		this.camera.inspect_offset_screen_x = rel_x - (rel_x - ox) * ratio;
		this.camera.inspect_offset_screen_y = rel_y - (rel_y - oy) * ratio;

		// 6. Apply final scale to the state and CSS variable
		this.scale = new_scale;
		this.style.setProperty('--game-scale', this.scale);
		document.body.classList.toggle('map-mode', this.scale < Game.map_zoom);
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
				block.colors = block.colors.map(hexToRgba8888);
				block.category = category;
				blocks_by_type[block.type] = block;
				blocks_by_name[block.name] = block;
				block.init = paint_color => {
					// Get default color
					let block_default_color = oneOf(block.colors);

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
			}
		}
	}
}

customElements.define('game-root', Game);

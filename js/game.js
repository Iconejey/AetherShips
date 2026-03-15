/**
 * Custom HTMLElement representing the game, which contains entities (ships, asteroids, planets, etc.)
 */
class Game extends HTMLElement {
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
		this.scale = 1;
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
		return $('side-bar multi-select#block-list').value;
	}

	get selected_tool() {
		return $('side-bar multi-select#edit-tools').value;
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

		for (const entity of this.children) {
			if (!(entity instanceof Entity)) continue;

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

		// Update camera to follow entity if one is being followed
		if (this.camera.followed_entity) {
			this.camera.update(this.camera.followed_entity, this.scale, this.mode !== 'navigation');
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
		this.scale = Math.min(Math.max(1, this.scale + delta), 20);
		this.style.setProperty('--game-scale', this.scale);
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
	 * Zooms while keeping cursor world focus stable by updating inspect screen offset
	 * @param {number} delta - Wheel-based zoom delta
	 * @param {number} client_x - Mouse x position in viewport
	 * @param {number} client_y - Mouse y position in viewport
	 */
	zoomInspectAtCursor(delta, client_x, client_y) {
		const relative_mouse_x = client_x - this.viewport_center_x;
		const relative_mouse_y = client_y - this.viewport_center_y;
		const old_scale = this.scale;

		this.zoom(delta);
		const new_scale = this.scale;

		if (new_scale === old_scale || !this.camera.followed_entity) return;

		const followed_entity = this.camera.followed_entity;

		// Zoom in: anchor at mouse cursor (move toward mouse)
		// Zoom out: anchor at opposite side (move away from mouse)

		// Scale movement factor by actual scale change for responsiveness
		const scale_change = Math.abs(new_scale - old_scale);
		const zoom_movement_factor = Math.min(0.15 * (scale_change / Math.abs(delta)), 1);

		// For zoom in, use mouse position; for zoom out, use opposite direction
		const anchor_x = delta > 0 ? relative_mouse_x : -relative_mouse_x;
		const anchor_y = delta > 0 ? relative_mouse_y : -relative_mouse_y;

		const anchor_world_pos = this.camera.screenToWorld(anchor_x, anchor_y, old_scale);
		const world_offset_x = anchor_world_pos.x - followed_entity.position.x;
		const world_offset_y = anchor_world_pos.y - followed_entity.position.y;
		const cos_r = Math.cos(-followed_entity.position.r);
		const sin_r = Math.sin(-followed_entity.position.r);

		const target_offset_x = (world_offset_x * cos_r - world_offset_y * sin_r) * new_scale;
		const target_offset_y = (world_offset_x * sin_r + world_offset_y * cos_r) * new_scale;

		// Lerp toward target offset
		this.camera.inspect_offset_screen_x += (target_offset_x - this.camera.inspect_offset_screen_x) * zoom_movement_factor;
		this.camera.inspect_offset_screen_y += (target_offset_y - this.camera.inspect_offset_screen_y) * zoom_movement_factor;

		this.camera.update(followed_entity, new_scale, true);
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

	/**
	 * Called when the element is inserted into the DOM. Initializes the game and starts the game loop.
	 */
	connectedCallback() {
		this.scale = 12;
		this.style.setProperty('--game-scale', this.scale);

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

		// Add resize listener to update entity positions
		window.addEventListener('resize', () => {
			this.viewport_center_x = window.innerWidth / 2;
			this.viewport_center_y = window.innerHeight / 2;
			this.updateEntityPositions();
		});

		// Add keyboard controls for ZQSD movement and A/E strafing
		window.addEventListener('keydown', event => {
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

		setTimeout(() => this.test(), 1);
	}

	/**
	 * Called when the element is removed from the DOM. Stops the game loop.
	 */
	disconnectedCallback() {
		this.stopGameLoop();
	}

	/**
	 * Tests for dev purposes
	 */
	test() {
		// Test planet
		const test_planet = document.createElement('entity-root');
		this.appendChild(test_planet);

		test_planet.fillEllipse(0, 0, 0, 64, 64, 'stone');
		test_planet.fillEllipse(1, 0, 0, 48, 48, 'dirt');
		test_planet.fillEllipse(2, 0, 0, 32, 32, 'grass');
		test_planet.render();

		// Test ship
		const test_ship = document.createElement('entity-root');
		this.appendChild(test_ship);

		test_ship.fillRect(2, -8, -16, 16, 32, 'fuselage');
		test_ship.render();

		// Follow ship with camera
		this.camera.followed_entity = test_ship;
	}
}

customElements.define('game-root', Game);

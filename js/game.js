/**
 * Represents the game camera with world position and rotation
 */
class Camera {
	/**
	 * Creates a camera instance
	 * @param {number} [x=0] - Initial world x coordinate
	 * @param {number} [y=0] - Initial world y coordinate
	 * @param {number} [r=0] - Initial camera rotation in radians
	 */
	constructor(x = 0, y = 0, r = 0) {
		this.x = x;
		this.y = y;
		this.r = r;
		this.followed_entity = null;
	}

	/**
	 * Converts world coordinates to screen coordinates relative to viewport center
	 * @param {number} world_x - World x coordinate
	 * @param {number} world_y - World y coordinate
	 * @param {number} scale - Rendering scale factor
	 * @returns {Object} Screen position {x, y}
	 */
	worldToScreen(world_x, world_y, scale) {
		const relative_x = (world_x - this.x) * scale;
		const relative_y = (world_y - this.y) * scale;

		// Apply camera rotation
		const cos_r = Math.cos(this.r);
		const sin_r = Math.sin(this.r);
		const rotated_x = relative_x * cos_r - relative_y * sin_r;
		const rotated_y = relative_x * sin_r + relative_y * cos_r;

		return {
			x: rotated_x,
			y: rotated_y
		};
	}

	/**
	 * Converts screen coordinates (relative to viewport center) to world coordinates
	 * @param {number} screen_x - Screen x coordinate (relative to viewport center)
	 * @param {number} screen_y - Screen y coordinate (relative to viewport center)
	 * @param {number} scale - Rendering scale factor
	 * @returns {Object} World position {x, y}
	 */
	screenToWorld(screen_x, screen_y, scale) {
		// Reverse camera rotation
		const cos_r = Math.cos(-this.r);
		const sin_r = Math.sin(-this.r);
		const unrotated_x = screen_x * cos_r - screen_y * sin_r;
		const unrotated_y = screen_x * sin_r + screen_y * cos_r;

		return {
			x: this.x + unrotated_x / scale,
			y: this.y + unrotated_y / scale
		};
	}

	/**
	 * Moves the camera to a specific world position
	 * @param {number} x - World x coordinate
	 * @param {number} y - World y coordinate
	 * @param {number} r - Camera rotation in radians
	 */
	moveTo(x, y, r = this.r) {
		this.x = x;
		this.y = y;
		this.r = r;
	}

	/**
	 * Offsets the camera position by the given delta
	 * @param {number} dx - Delta x
	 * @param {number} dy - Delta y
	 * @param {number} dr - Delta rotation in radians
	 */
	offset(dx, dy, dr = 0) {
		this.x += dx;
		this.y += dy;
		this.r += dr;
	}

	/**
	 * Updates camera position and rotation to focus on an entity
	 * @param {Entity} entity - The entity to focus on
	 */
	focusOn(entity) {
		this.moveTo(entity.position.x, entity.position.y, entity.position.r);
	}
}

/**
 * Custom HTMLElement representing the game, which contains entities (ships, asteroids, planets, etc.)
 */
class Game extends HTMLElement {
	/**
	 * Creates a game instance
	 */
	constructor() {
		super();
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
			this.fps_counter.textContent = `FPS: ${fps}`;
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

		const delta_x = this.camera.x - this.prev_camera_x;
		const delta_y = this.camera.y - this.prev_camera_y;
		const delta_r = this.camera.r - this.prev_camera_r;

		this.prev_camera_x = this.camera.x;
		this.prev_camera_y = this.camera.y;
		this.prev_camera_r = this.camera.r;

		// Transform world-space camera movement to screen-space using camera rotation
		// This ensures visual movement direction stays consistent relative to screen
		const cos_r = Math.cos(-this.prev_camera_r);
		const sin_r = Math.sin(-this.prev_camera_r);
		const screen_delta_x = delta_x * cos_r - delta_y * sin_r;
		const screen_delta_y = delta_x * sin_r + delta_y * cos_r;

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

		const thrust_force = 0.02;
		const rotation_speed = 0.001;

		// Rotation controls
		if (this.pressed_keys['q'] || this.pressed_keys['Q']) {
			this.camera.followed_entity.velocity.vr -= rotation_speed * delta_frames * 0.5;
		}
		if (this.pressed_keys['d'] || this.pressed_keys['D']) {
			this.camera.followed_entity.velocity.vr += rotation_speed * delta_frames * 0.5;
		}

		// Forward/backward movement
		if (this.pressed_keys['z'] || this.pressed_keys['Z']) {
			const angle = this.camera.followed_entity.position.r;
			this.camera.followed_entity.velocity.vx += Math.sin(angle) * thrust_force * delta_frames;
			this.camera.followed_entity.velocity.vy -= Math.cos(angle) * thrust_force * delta_frames;
		}
		if (this.pressed_keys['s'] || this.pressed_keys['S']) {
			const angle = this.camera.followed_entity.position.r;
			this.camera.followed_entity.velocity.vx -= Math.sin(angle) * thrust_force * delta_frames;
			this.camera.followed_entity.velocity.vy += Math.cos(angle) * thrust_force * delta_frames;
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
			this.camera.focusOn(this.camera.followed_entity);
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
	 * Sets the game scale (zoom level, clamped between 1 and 20)
	 * @param {number} value - The scale value to set
	 */
	set scale(value) {
		this.free_scale = Math.min(Math.max(1, value), 20);
		this.style.setProperty('--game-scale', this.scale);
	}

	/**
	 * Gets the current game scale (zoom level)
	 * @returns {number} The current scale, rounded to integer
	 */
	get scale() {
		return Math.round(this.free_scale);
	}

	/**
	 * Adjusts the game scale by the given delta
	 * @param {number} delta - The amount to adjust the scale by
	 */
	zoom(delta) {
		this.scale = this.free_scale + delta;
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
		this.scale = 5;

		// Initialize stars first (so they're behind other elements)
		this.initializeStars();

		if (!this.fps_counter) {
			this.fps_counter = document.createElement('div');
			this.fps_counter.className = 'fps_counter';
			this.fps_counter.textContent = 'FPS: 0';
			this.appendChild(this.fps_counter);
		}

		// Add wheel event for scale control
		window.addEventListener('wheel', event => {
			this.zoom(event.deltaY * -0.02);
		});

		// Add resize listener to update entity positions
		window.addEventListener('resize', () => {
			this.viewport_center_x = window.innerWidth / 2;
			this.viewport_center_y = window.innerHeight / 2;
			this.updateEntityPositions();
		});

		// Add keyboard controls for ZQSD movement
		window.addEventListener('keydown', event => {
			this.pressed_keys[event.key] = true;
		});

		window.addEventListener('keyup', event => {
			this.pressed_keys[event.key] = false;
		});

		// Let's add a test entity to the game
		const test_entity = document.createElement('entity-root');
		this.appendChild(test_entity);

		test_entity.fillEllipse(0, 0, 0, 64, 64, 'stone');
		test_entity.fillEllipse(1, 0, 0, 64, 64, 'dirt');
		test_entity.fillEllipse(2, 0, 0, 64, 64, 'grass');
		test_entity.fillEllipse(2, 0, 0, 16, 16, 'lamp');

		test_entity.render();

		// Follow entity with camera
		this.camera.followed_entity = test_entity;

		// Update positions after initial setup
		this.updateEntityPositions();
		this.fps_timer = 0;
		this.fps_frame_count = 0;
		this.startGameLoop();
	}

	/**
	 * Called when the element is removed from the DOM. Stops the game loop.
	 */
	disconnectedCallback() {
		this.stopGameLoop();
	}
}

customElements.define('game-root', Game);

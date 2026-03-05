/**
 * Represents the game camera with world position and rotation
 */
class Camera {
	constructor(x = 0, y = 0, r = 0) {
		this.x = x;
		this.y = y;
		this.r = r;
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
	constructor() {
		super();
		this.camera = new Camera(0, 0, 0);
		this.animation_frame_id = null;
		this.last_frame_time = null;
		this.fps_counter = null;
		this.fps_timer = 0;
		this.fps_frame_count = 0;
		this.followed_entity = null;
	}

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

	updateEntities(delta_seconds) {
		const delta_frames = delta_seconds * 60;
		const friction_factor = 0.99 ** delta_frames;

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
		if (this.followed_entity) {
			this.camera.focusOn(this.followed_entity);
		}
	}

	startGameLoop() {
		const tick = now => {
			if (this.last_frame_time === null) {
				this.last_frame_time = now;
			}

			const delta_seconds = Math.min((now - this.last_frame_time) / 1000, 0.1);
			this.last_frame_time = now;

			this.updateEntities(delta_seconds);
			this.updateFpsCounter(delta_seconds);
			this.updateEntityPositions();

			this.animation_frame_id = window.requestAnimationFrame(tick);
		};

		if (this.animation_frame_id === null) {
			this.animation_frame_id = window.requestAnimationFrame(tick);
		}
	}

	stopGameLoop() {
		if (this.animation_frame_id !== null) {
			window.cancelAnimationFrame(this.animation_frame_id);
			this.animation_frame_id = null;
		}
		this.last_frame_time = null;
	}

	set scale(value) {
		this.free_scale = Math.min(Math.max(1, value), 20);
		this.style.setProperty('--game-scale', this.scale);
		this.updateEntityPositions();
	}

	get scale() {
		return Math.round(this.free_scale);
	}

	zoom(delta) {
		this.scale = this.free_scale + delta;
	}

	/**
	 * Moves the camera to a specific world position
	 * @param {number} x - World x coordinate
	 * @param {number} y - World y coordinate
	 * @param {number} r - Camera rotation in radians
	 */
	moveCameraTo(x, y, r = this.camera.r) {
		this.camera.moveTo(x, y, r);
		this.updateEntityPositions();
	}

	/**
	 * Offsets the camera position by the given delta
	 * @param {number} dx - Delta x
	 * @param {number} dy - Delta y
	 * @param {number} dr - Delta rotation in radians
	 */
	offsetCamera(dx, dy, dr = 0) {
		this.camera.offset(dx, dy, dr);
		this.updateEntityPositions();
	}

	/**
	 * Makes the camera continuously follow an entity
	 * @param {Entity} entity - The entity to follow
	 */
	cameraFollowEntity(entity) {
		this.followed_entity = entity;
	}

	/**
	 * Stops the camera from following an entity
	 */
	stopFollowingEntity() {
		this.followed_entity = null;
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

	connectedCallback() {
		this.scale = 5;

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
			this.updateEntityPositions();
		});

		// Let's add a test entity to the game
		const test_entity = document.createElement('entity-root');
		this.appendChild(test_entity);

		test_entity.fillEllipse(0, 0, 0, 128, 128, 'stone');
		test_entity.fillEllipse(2, 0, 0, 64, 64, 'grass');
		test_entity.fillEllipse(1, 0, 0, 96, 96, 'dirt');
		test_entity.fillEllipse(2, 0, 0, 16, 16, 'lamp');

		test_entity.render();

		// Follow entity with camera
		this.cameraFollowEntity(test_entity);

		setInterval(() => {
			test_entity.velocity.vx += (Math.random() - 0.5) * 0.5;
			test_entity.velocity.vy += (Math.random() - 0.5) * 0.5;
			test_entity.velocity.vr += (Math.random() - 0.5) * 0.01;
		}, 1000);

		// Update positions after initial setup
		this.updateEntityPositions();
		this.fps_timer = 0;
		this.fps_frame_count = 0;
		this.startGameLoop();
	}

	disconnectedCallback() {
		this.stopGameLoop();
	}
}

customElements.define('game-root', Game);

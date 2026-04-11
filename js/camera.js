/**
 * Represents the game camera with world position and rotation
 */
class Camera {
	get followed_entity() {
		return $('entity-root.followed');
	}

	set followed_entity(new_followed_entity) {
		this.followed_entity?.classList.remove('followed');
		new_followed_entity.classList.add('followed');
	}

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
		this.inspect_offset_screen_x = 0;
		this.inspect_offset_screen_y = 0;
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

		// Apply inverse camera rotation (world rotates opposite to camera)
		const cos_r = Math.cos(-this.r);
		const sin_r = Math.sin(-this.r);
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
		// Reverse worldToScreen by applying camera rotation
		const cos_r = Math.cos(this.r);
		const sin_r = Math.sin(this.r);
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
	 * Updates camera position based on mode and entity focus
	 * @param {Entity} entity - The entity to focus on
	 * @param {'navigation'|'inspect'} mode - Active game mode
	 */
	update(entity, scale = 1, free = false, align_world = false) {
		if (!entity) return;

		const target_r = align_world ? 0 : entity.position.r;

		if (free) {
			// Convert inspect screen offset back into world-space using camera rotation.
			const cos_r = Math.cos(target_r);
			const sin_r = Math.sin(target_r);
			const world_offset_x = (this.inspect_offset_screen_x * cos_r - this.inspect_offset_screen_y * sin_r) / scale;
			const world_offset_y = (this.inspect_offset_screen_x * sin_r + this.inspect_offset_screen_y * cos_r) / scale;

			this.moveTo(entity.position.x + world_offset_x, entity.position.y + world_offset_y, target_r);
		}

		// Center camera on entity
		else this.moveTo(entity.position.x, entity.position.y, target_r);
	}
}

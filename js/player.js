class Player {
	constructor(position) {
		this.position = { ...position };
		this.driven_entity = null;
	}

	setPosition(x, y, r) {
		this.position.x = x;
		this.position.y = y;
		this.position.r = r;
	}

	drive(entity) {
		this.driven_entity = entity;
		game.camera.followed_entity = entity;
	}

	serialize() {
		return {
			position: { ...this.position },
			driven_entity: this.driven_entity?.id || null
		};
	}
}

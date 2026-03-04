/**
 * Custom HTMLElement representing the game, which contains entities (ships, asteroids, planets, etc.)
 */
class Game extends HTMLElement {
	constructor() {
		super();
	}

	set scale(value) {
		this.free_scale = Math.min(Math.max(1, value), 20);
		this.style.setProperty('--game-scale', this.scale);
	}

	get scale() {
		return Math.round(this.free_scale);
	}

	zoom(delta) {
		this.scale = this.free_scale + delta;
	}

	connectedCallback() {
		this.scale = 5;

		// Add wheel event for scale control
		window.addEventListener('wheel', event => {
			this.zoom(event.deltaY * -0.02);
		});

		// Let's add a test entity to the game
		const test_entity = document.createElement('entity-elem');
		this.appendChild(test_entity);

		test_entity.fillEllipse(0, 0, 0, 128, 128, 'stone');
		test_entity.fillEllipse(1, 0, 0, 96, 96, 'dirt');
		test_entity.fillEllipse(2, 0, 0, 64, 64, 'grass');
		test_entity.fillEllipse(2, 0, 0, 16, 16, 'lamp');

		test_entity.render();
	}
}

customElements.define('game-elem', Game);

/**
 * Custom HTMLElement representing the game, which contains entities (ships, asteroids, planets, etc.)
 */
class Game extends HTMLElement {
	static get observedAttributes() {
		return ['scale'];
	}

	constructor() {
		super();
	}

	attributeChangedCallback(name, old_value, new_value) {
		if (name === 'scale' && old_value !== new_value) this.updateScaleVariable();
	}

	updateScaleVariable() {
		const scale_value = Number.parseFloat(this.getAttribute('scale'));
		const safe_scale_value = Number.isFinite(scale_value) && scale_value > 0 ? scale_value : 1;
		this.style.setProperty('--game-scale', safe_scale_value.toString());
	}

	connectedCallback() {
		this.updateScaleVariable();

		// Let's add a test entity to the game
		const test_entity = document.createElement('entity-elem');
		this.appendChild(test_entity);

		for (let i = 0; i < 256; i++) {
			const x = Math.floor(Math.random() * 32);
			const y = Math.floor(Math.random() * 32);
			test_entity.setByName(0, x, y, 'dirt');
		}

		for (let i = 0; i < 8; i++) {
			const x = Math.floor(Math.random() * 32);
			const y = Math.floor(Math.random() * 32);
			test_entity.setByName(0, x, y, 'lamp');
		}

		test_entity.render();
	}
}

customElements.define('game-elem', Game);

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

		const radius = 60;

		for (let i = 0; i < 8000; i++) {
			const angle = Math.random() * Math.PI * 2;
			const r = Math.sqrt(Math.random()) * radius;
			const x = Math.floor(Math.cos(angle) * r);
			const y = Math.floor(Math.sin(angle) * r);
			test_entity.setByName(1, x, y, 'dirt');
		}

		for (let i = 0; i < 8000; i++) {
			const angle = Math.random() * Math.PI * 2;
			const r = Math.sqrt(Math.random()) * radius;
			const x = Math.floor(Math.cos(angle) * r);
			const y = Math.floor(Math.sin(angle) * r);
			test_entity.setByName(0, x, y, 'dirt');
		}

		for (let i = 0; i < 512; i++) {
			const angle = Math.random() * Math.PI * 2;
			const r = Math.sqrt(Math.random()) * radius;
			const x = Math.floor(Math.cos(angle) * r);
			const y = Math.floor(Math.sin(angle) * r);
			test_entity.setByName(0, x, y, 'lamp');
		}

		for (let i = 0; i < 512; i++) {
			const angle = Math.random() * Math.PI * 2;
			const r = Math.sqrt(Math.random()) * radius;
			const x = Math.floor(Math.cos(angle) * r);
			const y = Math.floor(Math.sin(angle) * r);
			test_entity.setByName(1, x, y, 'lamp');
		}

		test_entity.render();
	}
}

customElements.define('game-elem', Game);

class UserTerminal extends HTMLElement {
	async connectedCallback() {
		this.innerHTML = html`
			<div class="line">U.R.A. OS version <span id="version"></span></div>
			<div class="line">Sector [<span id="sector"></span>] position (<span id="coords"></span>)</div>
		`;

		const pkg = await fetch('package.json').then(r => r.json());
		this.$('#version').textContent = pkg.version;

		setInterval(() => {
			const followed = window.game?.camera?.followed_entity;
			if (!followed) return;

			const global_x = followed.position.x / 32;
			const global_y = followed.position.y / 32;

			const chunk_x = Math.floor(global_x % 256);
			const chunk_y = Math.floor(global_y % 256);
			this.$('#coords').textContent = `${chunk_x}, ${chunk_y}`;

			const sector_x = Math.floor(global_x / 256);
			const sector_y = Math.floor(global_y / 256);
			this.$('#sector').textContent = `${sector_x}, ${sector_y}`;
		}, 250);
	}
}

customElements.define('user-terminal', UserTerminal);

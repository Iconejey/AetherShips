class NavigationControls extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`
			<div class="tools-layer">
				<icon-toggle class="stabilisation-toggle" on-icon="tools_level" off-icon="tools_level" title="Stabilisation"></icon-toggle>
				<img id="compass" src="img/compass.svg" title="Toggle camera alignment" />
			</div>
			<utility-sliders></utility-sliders>
		`;
	}
}

customElements.define('navigation-controls', NavigationControls);

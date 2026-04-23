class NavigationControls extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`
			<img id="compass" src="img/compass.svg" title="Toggle camera alignment" />
			<utility-sliders></utility-sliders>
		`;
	}
}

customElements.define('navigation-controls', NavigationControls);

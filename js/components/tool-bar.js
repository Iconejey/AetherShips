class ToolBar extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`
			<div class="group ui">
				<button id="set-mode-navigation" title="Switch to navigation mode">navigation</button>
				<button id="set-mode-inspect" title="Switch to inspect mode">gesture_select</button>
				<button id="set-mode-edit" title="Switch to edit mode">edit</button>
			</div>
		`;

		this.$$('button').forEach(button => {
			button.onclick = () => {
				game.mode = button.id.replace('set-mode-', '');
			};
		});
	}
}

customElements.define('tool-bar', ToolBar);

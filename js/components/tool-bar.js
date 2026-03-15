class ToolBar extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`
			<div class="group ui">
				<button class="round" id="set-mode-navigation" title="Switch to navigation mode">navigation</button>
				<button class="round" id="set-mode-inspect" title="Switch to inspect mode">gesture_select</button>
				<button class="round active" id="set-mode-edit" title="Switch to edit mode">edit</button>
			</div>
		`;

		this.$$('button').forEach(button => {
			button.onclick = () => {
				this.$$('button.active').forEach(btn => btn.classList.remove('active'));
				button.classList.add('active');
				const mode = button.id.replace('set-mode-', '');
				const sidebar = document.querySelector('side-bar');
				sidebar.classList.remove('open');

				// Reset camera offset when switching to navigation
				if (mode === 'navigation') {
					game.camera.inspect_offset_screen_x = 0;
					game.camera.inspect_offset_screen_y = 0;
					game.has_prev_mouse_position = false;
				}

				// Open sidebar with edit tools when switching to edit mode
				if (mode === 'edit') sidebar.showEditTools();
			};
		});
	}
}

customElements.define('tool-bar', ToolBar);

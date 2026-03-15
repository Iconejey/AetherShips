class ToolBar extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`<multi-select class="group ui" type="round"></multi-select>`;

		const multi_select = this.$('multi-select');

		multi_select.add('navigation', 'navigation', 'Switch to navigation mode', 'Ctrl+N');
		multi_select.add('inspect', 'gesture_select', 'Switch to inspect mode', 'Ctrl+I');
		multi_select.add('edit', 'edit', 'Switch to edit mode', 'Ctrl+E');

		multi_select.onchange = value => {
			const sidebar = $('side-bar');
			sidebar.classList.remove('open');
			document.body.classList.remove('edit-layer-0', 'edit-layer-1', 'edit-layer-2');

			// Reset camera offset when switching to navigation
			if (window.game && value === 'navigation') {
				game.camera.inspect_offset_screen_x = 0;
				game.camera.inspect_offset_screen_y = 0;
				game.has_prev_mouse_position = false;
			}

			// Open sidebar with edit tools when switching to edit mode
			if (value === 'edit') sidebar.showEditTools();
		};

		window.addEventListener('keydown', e => this.handleShortcut(e));

		multi_select.value = 'navigation';
	}

	handleShortcut(event) {
		if (event.metaKey || event.altKey) return;

		const mode = this.$('multi-select').getValueForEvent(event);
		if (!mode) return;

		event.preventDefault();
		this.$('multi-select').value = mode;
	}
}

customElements.define('tool-bar', ToolBar);

class ToolBar extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`<multi-select class="group ui" type="round"></multi-select>`;

		const multi_select = this.$('multi-select');

		multi_select.add('navigation', 'navigation', 'Switch to navigation mode', 'Ctrl+N');
		multi_select.add('management', 'handyman', 'Switch to management mode', 'Ctrl+M');
		multi_select.add('edit', 'edit', 'Switch to edit mode', 'Ctrl+E');

		multi_select.onchange = value => {
			const sidebar = $('side-bar');
			sidebar.classList.remove('open');

			if (value !== 'edit' && value !== 'management') {
				document.body.classList.remove('edit-layer-0', 'edit-layer-1', 'edit-layer-2');
			}

			// Reset camera offset when switching to navigation
			if (window.game && value === 'navigation') {
				window.game.resetPanOffset();
			}

			// Open sidebar with appropriate tools
			if (value === 'edit' || value === 'management') sidebar.showTools(value);
		};

		window.addEventListener('keydown', e => this.handleShortcut(e));

		multi_select.value = 'navigation';
	}

	handleShortcut(event) {
		if (document.body.classList.contains('start-menu')) return;
		if (event.metaKey || event.altKey) return;

		const mode = this.$('multi-select').getValueForEvent(event);
		if (!mode) return;

		event.preventDefault();
		this.$('multi-select').value = mode;
	}
}

customElements.define('tool-bar', ToolBar);

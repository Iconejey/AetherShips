class UserTerminal extends HTMLElement {
	async connectedCallback() {
		const pkg = await fetch('package.json').then(r => r.json());
		this.version = pkg.version;
		this.mode = 'start_menu';
		this.tick_interval_id = window.setInterval(() => {
			if (this.current_mode !== 'start_menu' && game?.mode !== this.current_mode) this.mode = game?.mode;
			this.tick?.();
		}, 250);
	}

	/**
	 * Display a temporary notification line in the terminal.
	 * @param {string} content - The notification message.
	 * @param {number} duration - Duration in ms before the notification disappears (default: 2000ms)
	 */
	notify(content, duration = 2000) {
		const line = this.line(content);
		line.classList.add('notify');
		setTimeout(() => line?.remove(), duration);
		return line;
	}

	attachKeyboardNavigation() {
		const buttons = this.$$('button');
		buttons.forEach(button => {
			button.addEventListener('keydown', e => {
				if (!button.classList.contains('selected')) return;

				let nextButton = null;

				if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
					e.preventDefault();
					nextButton = button.nextElementSibling;
					while (nextButton && (nextButton.disabled || nextButton.tagName !== 'BUTTON')) {
						nextButton = nextButton.nextElementSibling;
					}
				} else if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
					e.preventDefault();
					nextButton = button.previousElementSibling;
					while (nextButton && (nextButton.disabled || nextButton.tagName !== 'BUTTON')) {
						nextButton = nextButton.previousElementSibling;
					}
				} else if (e.key === 'Enter') {
					e.preventDefault();
					button.click();
					return;
				}

				if (nextButton && nextButton.tagName === 'BUTTON') {
					button.classList.remove('selected');
					nextButton.classList.add('selected');
					nextButton.focus();
				}
			});
		});
	}

	clear() {
		this.innerHTML = '';
	}

	async banner() {
		const banner = document.createElement('pre');
		banner.id = 'banner';
		banner.textContent = await window.figlet('AetherShips', { font: 'ANSI Shadow' });
		this.appendChild(banner);
		return banner;
	}

	line(content = '') {
		const div = document.createElement('div');
		div.className = 'line';
		div.innerHTML = content;
		this.appendChild(div);
		return div;
	}

	error(content) {
		const line = this.line(content);
		line.classList.add('error');
		return line;
	}

	success(content) {
		const line = this.line(content);
		line.classList.add('success');
		return line;
	}

	input(label, required = true, type = 'text') {
		return new Promise(resolve => {
			const line = this.line();
			line.innerHTML = html`${label} : <input type="${type}" maxlength="32" ${required ? 'required' : ''} />`;
			const input = line.querySelector('input');
			if (type === 'text') {
				input.setAttribute('pattern', '[^<>:"/\\|?*]+$');
				input.setAttribute('title', 'No special characters: <>:"/\\|?*');
			}
			input.focus();
			input.onkeydown = e => {
				if (e.key === 'Enter') {
					const value = input.value.trim();

					if (required && !value) {
						input.setCustomValidity('This field is required');
						input.reportValidity();
						return;
					}

					if (type === 'text') {
						const invalid = /[<>:"/\\|?*]/g;
						if (value && invalid.test(value)) {
							input.setCustomValidity('Invalid name: no special characters <>:"/\\|?*');
							input.reportValidity();
							return;
						}
					}

					input.disabled = true;

					if (!value && !required) {
						resolve(null);
						return;
					}

					resolve(type === 'number' ? Number(value) : value);
				}
			};
		});
	}

	button(label, info, onClick, onDelete) {
		const btn = document.createElement('button');
		btn.className = 'line';
		btn.textContent = label;
		if (info) btn.setAttribute('data-info', ` - ${info}`);

		btn.onclick = e => {
			this.$$('button').forEach(btn => (btn.disabled = true));
			btn.classList.add('selected');
			onClick?.();
		};

		btn.addEventListener('keydown', e => {
			if ((e.key === 'Delete' || e.key === 'Backspace') && btn.classList.contains('selected')) onDelete?.();
		});

		this.appendChild(btn);
		return btn;
	}

	set mode(mode) {
		this.current_mode = mode;
		if (mode === 'start_menu') return this.startMenu();
		if (mode === 'navigation') return this.navigation();
		if (mode === 'edit') return this.edit();
	}

	async startMenu(message_callback) {
		// Remove focus handlers in case we are returning from another menu to prevent duplicates
		this._removeStartMenuFocusHandler?.();

		// Clear terminal
		this.clear();

		// Add banner
		await this.banner();
		this.line('The void is yours, the rest is ours.');
		this.line();

		// Show message if provided
		if (message_callback) await message_callback?.();
		this.line();

		// Get saves list
		const saves = await window.saves.listGalaxies();

		// Add save buttons with creation date
		for (const { name, created } of saves) {
			const date = new Date(created);
			const yyyy = date.getFullYear();
			const mm = String(date.getMonth() + 1).padStart(2, '0');
			const dd = String(date.getDate()).padStart(2, '0');
			const date_str = `${yyyy}.${mm}.${dd}`;

			const start = () => {
				window.game.loadGalaxy(name);
				this.clear();
				this.mode = 'navigation';
			};

			this.button(name, date_str, start, () => this.deleteGalaxy(name));
		}

		// Add new game button
		this.button('Create New Galaxy', '', () => this.createNewGalaxy());

		// Select first button (save or new)
		const first_btn = this.$('button');
		first_btn?.classList.add('selected');
		first_btn?.focus();
		this.attachKeyboardNavigation();

		// Prevent focus loss on mousedown, restore on mouseup
		const preventBlurHandler = e => {
			const tag = e.target.tagName;
			if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;
			e.preventDefault();
		};

		const restoreFocusHandler = e => {
			const tag = e.target.tagName;
			if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;
			// Try to focus input or selected button, if any
			const input = this.$('input:not([disabled])');
			const selected = this.$('button.selected:not([disabled])');
			(input || selected)?.focus();
		};

		window.addEventListener('mousedown', preventBlurHandler, true);
		window.addEventListener('mouseup', restoreFocusHandler, false);

		// Remove handlers when leaving start menu
		this._removeStartMenuFocusHandler = () => {
			window.removeEventListener('mousedown', preventBlurHandler, true);
			window.removeEventListener('mouseup', restoreFocusHandler, false);
		};

		this.tick = null;
	}

	async deleteGalaxy(name) {
		if (confirm(`Delete Galaxy "${name}" ? This cannot be undone.`)) {
			try {
				await window.saves.deleteGalaxy(name);
				this.startMenu(() => this.success(`Galaxy "${name}" deleted.`));
			} catch (err) {
				this.error(`Failed to delete save: ${err.message}`);
			}
		}
	}

	async createNewGalaxy() {
		this.line();
		this.line('Enter the name of this Galaxy...');
		const name = await this.input('Galaxy name');
		try {
			await window.saves.createGalaxy(name);
			this.startMenu(() => this.success(`Galaxy "${name}" created !`));
		} catch (err) {
			this.startMenu(() => this.error(`Failed to create Galaxy: ${err.message}`));
		}
	}

	navigation() {
		this.clear();
		this.line(`U.R.A. OS version ${this.version} - Day 1`);
		const position_line = this.line();

		this.tick = () => {
			const followed = window.game?.camera?.followed_entity;
			if (!followed) return;

			const { sector, chunk } = Entity.globalPosition(followed.position);
			if (position_line) position_line.textContent = `Sector [${sector.sx}, ${sector.sy}] position (${chunk.cx}, ${chunk.cy})`;
		};
	}

	edit() {
		this.clear();
		this.line(`U.R.A. OS version ${this.version} - Day 1`);
		const block_type_line = this.line('Block : -');

		this.tick = () => {
			const followed_entity = game?.camera?.followed_entity;
			const view_overlay = $('view-overlay');
			if (!followed_entity || !view_overlay) {
				block_type_line.textContent = 'Block : -';
				return;
			}

			const hovered_block = view_overlay.screenToBlock(view_overlay.mouse_x, view_overlay.mouse_y);
			if (!hovered_block) {
				block_type_line.textContent = 'Block : -';
				return;
			}

			const block_info = followed_entity.getBlockInfo(game.selected_layer, hovered_block.bx, hovered_block.by);
			const block_name = block_info.is_empty ? 'empty' : block_info.name;
			block_type_line.textContent = `Block : ${block_name} (${hovered_block.bx}, ${hovered_block.by})`;
		};
	}
}

customElements.define('user-terminal', UserTerminal);

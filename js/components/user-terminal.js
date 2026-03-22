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

	input(label) {
		return new Promise(resolve => {
			const line = this.line();
			line.innerHTML = html`${label} : <input type="text" maxlength="32" />`;
			const input = line.querySelector('input');
			input.setAttribute('pattern', '[^<>:"/\\|?*]+$');
			input.setAttribute('title', 'No special characters: <>:"/\\|?*');
			input.focus();
			input.onkeydown = e => {
				if (e.key === 'Enter') {
					const value = input.value.trim();
					const invalid = /[<>:"/\\|?*]/g;
					if (!value || invalid.test(value)) {
						input.setCustomValidity('Invalid name: no special characters <>:"/\\|?*');
						input.reportValidity();
						return;
					}
					input.disabled = true;
					resolve(value);
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
		const saves = await window.saves.list();

		// Add save buttons with creation date
		for (const { name, created } of saves) {
			const date = new Date(created);
			const yyyy = date.getFullYear();
			const mm = String(date.getMonth() + 1).padStart(2, '0');
			const dd = String(date.getDate()).padStart(2, '0');
			const date_str = `${yyyy}.${mm}.${dd}`;

			this.button(
				name,
				date_str,
				() => this.loadGalaxy(name),
				() => this.deleteGalaxy(name)
			);
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
				await window.saves.delete(name);
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
			await window.saves.create(name);
			this.startMenu(() => this.success(`Galaxy "${name}" created !`));
		} catch (err) {
			this.startMenu(() => this.error(`Failed to create Galaxy: ${err.message}`));
		}
	}

	async loadGalaxy(name) {
		this.line();
		this.line(`Loading galaxy: ${name}...`);
		try {
			const data = await window.saves.load(name);
			// You may want to reset the game state here
			// For now, just show a success message and log the data
			this.success(`Galaxy "${name}" loaded!`);
			console.log('Loaded galaxy data:', data);
			// TODO: Actually initialize the game state with loaded data
		} catch (err) {
			this.error(`Failed to load galaxy: ${err.message}`);
		}
	}

	navigation() {
		this.line(`U.R.A. OS version ${this.version} - Day 1`);
		this.line(html`Sector [<span id="sector"></span>] position (<span id="coords"></span>)`);

		this.tick = () => {
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
		};
	}

	edit() {
		this.line(`U.R.A. OS version ${this.version} - Day 1`);
		this.line(html`Type : <span id="type">-</span>`);

		this.tick = () => {
			if (game?.mode !== this.current_mode) return (this.mode = game?.mode ?? 'navigation');

			const followed_entity = game?.camera?.followed_entity;
			const edit_preview = $('edit-preview');
			if (!followed_entity || !edit_preview) {
				this.$('#type').textContent = '-';
				return;
			}

			const hovered_block = edit_preview.screenToBlock(edit_preview.mouse_x, edit_preview.mouse_y);
			if (!hovered_block) {
				this.$('#type').textContent = '-';
				return;
			}

			const block_info = followed_entity.getBlockInfo(game.selected_layer, hovered_block.bx, hovered_block.by);
			this.$('#type').textContent = block_info.is_empty ? 'empty' : (blocks_by_type[block_info.type]?.name ?? `${block_info.type}`);
		};
	}
}

customElements.define('user-terminal', UserTerminal);

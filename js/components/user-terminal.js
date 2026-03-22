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

	set mode(mode) {
		this.current_mode = mode;

		if (mode === 'start_menu') return this.startMenu();
		if (mode === 'navigation') return this.navigation();
		if (mode === 'edit') return this.edit();
	}

	async startMenu() {
		// Get saves list
		const saves = await window.saves.list();

		this.innerHTML = html`
			<pre id="banner"></pre>
			<div class="line">The void is yours, the rest is ours.</div>
			<div class="line"></div>
			<div class="line"></div>
		`;

		// Add save buttons with creation date
		for (const { name, created } of saves) {
			const date = new Date(created);
			const yyyy = date.getFullYear();
			const mm = String(date.getMonth() + 1).padStart(2, '0');
			const dd = String(date.getDate()).padStart(2, '0');
			const dateStr = `${yyyy}.${mm}.${dd}`;
			this.innerHTML += html`<button class="line save-btn" data-save="${name}" data-info=" - ${dateStr}">${name}</button>`;
		}

		// Add new game button
		this.innerHTML += html`<button id="new-game" class="line">Start New Galaxy</button>`;

		// Render banner
		window.figlet('AetherShips', { font: 'ANSI Shadow' }).then(text => {
			this.$('#banner').textContent = text;
		});

		// Select first button (save or new)
		const first_btn = this.$('button');
		first_btn?.classList.add('selected');
		first_btn?.focus();
		this.attachKeyboardNavigation();

		// Save button click handler (implement loading logic as needed)
		this.$$('.save-btn').forEach(btn => {
			btn.onclick = () => {
				// TODO: Implement save loading logic here
				this.innerHTML += html`<div class="line">Loading galaxy: ${btn.dataset.save}</div>`;
			};

			// Allow save deletion on 'Delete' or 'Backspace' key
			btn.addEventListener('keydown', async e => {
				if ((e.key === 'Delete' || e.key === 'Backspace') && btn.classList.contains('selected')) {
					const save_name = btn.dataset.save;
					if (confirm(`Delete Galaxy "${save_name}" ? This cannot be undone.`)) {
						try {
							await window.saves.delete(save_name);
							this.startMenu(); // Refresh the menu to update the saves list
						} catch (err) {
							this.innerHTML += html`<div class="line" style="color:red">${err}</div>`;
						}
					}
				}
			});
		});

		// New game button click handler
		this.$('#new-game').onclick = e => {
			this.$$('button').forEach(btn => (btn.disabled = true));

			this.innerHTML += html`
				<div class="line"></div>
				<div class="line">Enter the name of this Galaxy...</div>
				<div class="line">Name : <input id="name-input" /></div>
			`;

			const name_input = this.$('#name-input');
			name_input.setAttribute('maxlength', '32');
			name_input.setAttribute('pattern', '[^<>:"/\\|?*]+$');
			name_input.setAttribute('title', 'No special characters: <>:"/\|?*');
			name_input.focus();
			name_input.onkeydown = async e => {
				if (e.key === 'Enter') {
					const name = name_input.value.trim();
					const invalid = /[<>:"/\\|?*]/g;
					if (!name || invalid.test(name)) {
						name_input.setCustomValidity('Invalid name: no special characters <>:"/\\|?*');
						name_input.reportValidity();
						return;
					}
					name_input.disabled = true;
					try {
						await window.saves.create(name);
						this.startMenu(); // Refresh the menu to show the new save
					} catch (err) {
						name_input.disabled = false;
						this.innerHTML += html`<div class="line" style="color:red">${err}</div>`;
					}
				}
			};
		};

		this.tick = null;
	}

	navigation() {
		this.innerHTML = html`
			<div class="line">U.R.A. OS version ${this.version} - Day 1</div>
			<div class="line">Sector [<span id="sector"></span>] position (<span id="coords"></span>)</div>
		`;

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
		this.innerHTML = html`
			<div class="line">U.R.A. OS version ${this.version} - Day 1</div>
			<div class="line">Type : <span id="type"></span></div>
		`;

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

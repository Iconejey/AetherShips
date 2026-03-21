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

	set mode(mode) {
		this.current_mode = mode;

		if (mode === 'start_menu') {
			this.innerHTML = html`
				<pre id="banner"></pre>
				<div class="line">The void is yours, the rest is ours.</div>
				<div class="line"></div>
				<div class="line"></div>
				<button class="line" data-info=" - 2026.03.21">My game</button>
				<button class="line">Start New Game</button>
			`;

			window.figlet('AetherShips', { font: 'ANSI Shadow' }).then(text => {
				this.$('#banner').textContent = text;
			});

			this.$('button').focus();

			this.tick = null;
		}

		if (mode === 'navigation') {
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

		if (mode === 'edit') {
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
}

customElements.define('user-terminal', UserTerminal);

class SideBar extends HTMLElement {
	connectedCallback() {
		this.classList.add('ui');
		window.addEventListener('keydown', e => this.handleShortcut(e));
	}

	handleShortcut(event) {
		if (game.mode !== 'edit') return;
		if (event.metaKey) return;

		const target = event.target;
		const is_editable_target = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

		if (is_editable_target) return;

		const edit_layer_select = this.$('#edit-layer');
		const layer_value = edit_layer_select?.getValueForEvent(event);
		if (layer_value) {
			event.preventDefault();
			edit_layer_select.value = layer_value;
			return;
		}

		const edit_tools_select = this.$('#edit-tools');
		const tool_value = edit_tools_select?.getValueForEvent(event);
		if (tool_value) {
			event.preventDefault();
			edit_tools_select.value = tool_value;
			return;
		}

		const edit_mode_select = this.$('#edit-mode');
		const mode_value = edit_mode_select?.getValueForEvent(event);
		if (mode_value) {
			event.preventDefault();
			edit_mode_select.value = mode_value;
		}
	}

	showEditTools() {
		this.innerHTML = html`
			<multi-select class="round-button-group" id="edit-layer" type="round"></multi-select>
			<multi-select id="block-list" type="text left"></multi-select>
			<div id="paint-panel" class="paint-panel">
				<div class="paint-controls">
					<input id="paint-color-picker" type="color" value="#ffffff" title="Pick color" />
					<button id="add-paint-color" class="round" title="Add picked color">add</button>
				</div>
				<multi-select id="paint-colors" type="round"></multi-select>
			</div>
			<multi-select class="round-button-group reverse" id="edit-tools" type="round"></multi-select>
			<multi-select class="round-button-group" id="edit-mode" type="round"></multi-select>
		`;

		// Layers
		const edit_layer_select = this.$('#edit-layer');

		edit_layer_select.onchange = () => {
			// Update body class to reflect selected layer
			document.body.classList.remove('edit-layer-0', 'edit-layer-1', 'edit-layer-2');
			document.body.classList.add(`edit-layer-${edit_layer_select.value}`);
		};

		edit_layer_select.add('0', 'filter_1', 'Edit layer 1', '1');
		edit_layer_select.add('1', 'filter_2', 'Edit layer 2', '2');
		edit_layer_select.add('2', 'filter_3', 'Edit layer 3', '3');
		edit_layer_select.value = '1';

		// Blocks
		const block_list_select = this.$('#block-list');
		for (const block_name in blocks) {
			const label = block_name[0].toUpperCase() + block_name.slice(1);
			block_list_select.add(block_name, label, `Select ${label} block`);
		}
		block_list_select.value = 'dirt';

		// Paint palette
		const add_paint_color_button = this.$('#add-paint-color');
		add_paint_color_button.textContent = 'palette';
		add_paint_color_button.classList.add('material-symbols-outlined');
		add_paint_color_button.addEventListener('click', () => {
			const color_hex = this.$('#paint-color-picker')?.value;
			if (!color_hex) return;
			this.addPaintColor(color_hex, true);
		});

		this.addPaintColor('#ffffff', true);

		// Tools
		const edit_tools_select = this.$('#edit-tools');
		edit_tools_select.add('ellipse', 'radio_button_unchecked', 'Select ellipse tool', 'C');
		edit_tools_select.add('rectangle', 'crop_square', 'Select rectangle tool', 'R');
		edit_tools_select.add('line', 'diagonal_line', 'Select line tool', 'L');
		edit_tools_select.add('pen', 'draw', 'Select pen tool', 'P');
		edit_tools_select.value = 'pen';

		// Modes
		const edit_mode_select = this.$('#edit-mode');
		edit_mode_select.onchange = value => this.setEditModeUi(value);
		edit_mode_select.add('place', 'add_box', 'Select placing mode', 'Alt+A');
		edit_mode_select.add('erase', 'ink_eraser', 'Select erase mode', 'Alt+E');
		edit_mode_select.add('paint', 'format_paint', 'Select paint mode', 'Alt+P');
		edit_mode_select.value = 'place';
		this.setEditModeUi('place');

		// Open sidebar
		this.classList.add('open');
	}

	setEditModeUi(edit_mode) {
		const block_list = this.$('#block-list');
		const paint_panel = this.$('#paint-panel');
		const paint_mode_active = edit_mode === 'paint';
		block_list?.classList.toggle('hidden', paint_mode_active);
		paint_panel?.classList.toggle('active', paint_mode_active);
	}

	addPaintColor(color_hex, select = true) {
		if (!color_hex) return;
		const normalized_hex = color_hex.toLowerCase();
		const paint_colors = this.$('#paint-colors');
		if (!paint_colors) return;

		const existing_button = paint_colors.$(`[data-value="${normalized_hex}"]`);
		if (!existing_button) {
			paint_colors.add(normalized_hex, '', `Use ${normalized_hex}`);
			const new_button = paint_colors.$(`[data-value="${normalized_hex}"]`);
			if (new_button) {
				new_button.classList.add('paint-color-button');
				new_button.style.background = normalized_hex;
				new_button.style.borderColor = '#ffffff44';
			}
		}

		if (select) paint_colors.value = normalized_hex;
		const color_picker = this.$('#paint-color-picker');
		if (color_picker) color_picker.value = normalized_hex;
	}

	getSelectedPaintColor() {
		return this.$('#paint-colors')?.value || null;
	}
}

customElements.define('side-bar', SideBar);

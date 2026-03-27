class SideBar extends HTMLElement {
	connectedCallback() {
		this.classList.add('ui');
		window.addEventListener('keydown', e => this.handleShortcut(e));
	}

	handleShortcut(event) {
		if (game.mode !== 'edit') return;

		const is_find_shortcut = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f';
		if (is_find_shortcut) {
			event.preventDefault();
			this.focusBlockSearch();
			return;
		}

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

	updateCategoryPrimary() {
		const block_list = this.$('#block-list');
		if (!block_list) return;
		// Remove .primary from all categories
		block_list.$$('details.primary').forEach(d => d.classList.remove('primary'));
		// Find the <details> containing the .active button
		const active_button = block_list.$('button.active');
		if (active_button) {
			const details = active_button.closest('details');
			if (details) details.classList.add('primary');
		}
	}

	showEditTools() {
		this.innerHTML = html`
			<multi-select class="round-button-group" id="edit-layer" type="round"></multi-select>
			<div id="block-search-wrapper">
				<input id="block-search" type="search" placeholder="Search blocks" aria-label="Search blocks" />
			</div>
			<div id="block-list"></div>
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
		const block_list = this.$('#block-list');
		for (const category in block_categories) {
			const details = document.createElement('details');

			const summary = document.createElement('summary');
			const category_label = category.replace(/_/g, ' ');
			summary.textContent = category_label[0].toUpperCase() + category_label.slice(1);
			details.appendChild(summary);

			const cat_select = document.createElement('multi-select');
			cat_select.setAttribute('type', 'text left');
			cat_select.onchange = () => {
				block_list.$$('multi-select').forEach(ms => {
					if (ms !== cat_select) ms.$$('.active').forEach(b => b.classList.remove('active'));
				});
				this.updateCategoryPrimary();
			};

			for (const block of block_categories[category]) {
				const block_label = block.name.replace(/_/g, ' ');
				const formatted_label = block_label[0].toUpperCase() + block_label.slice(1);
				cat_select.add(block.name, formatted_label, `Select ${formatted_label} block`);
				const block_button = cat_select.lastElementChild;
				if (block_button instanceof HTMLButtonElement) {
					block_button.setAttribute('data-search', `${formatted_label} ${block.name}`.toLowerCase());
				}
			}

			details.appendChild(cat_select);
			block_list.appendChild(details);
		}

		// Select first block by default
		const first_button = block_list.$('button');
		if (first_button) first_button.classList.add('active');

		// Highlight the initial category
		this.updateCategoryPrimary();

		const block_search = this.$('#block-search');
		block_search?.addEventListener('input', () => this.filterBlockList(block_search.value));

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

	focusBlockSearch(select_text = true) {
		const block_search = this.$('#block-search');
		if (!block_search) return;
		block_search.focus();
		if (select_text) block_search.select();
	}

	filterBlockList(search_term) {
		const normalized_search = search_term.trim().toLowerCase();
		const block_list = this.$('#block-list');
		if (!block_list) return;

		for (const category_details of block_list.$$('details')) {
			let has_visible_button = false;

			for (const button of category_details.$$('multi-select button')) {
				const search_text = button.getAttribute('data-search') || button.textContent?.toLowerCase() || '';
				const is_match = !normalized_search || search_text.includes(normalized_search);
				button.classList.toggle('hidden', !is_match);
				has_visible_button ||= is_match;
			}

			category_details.classList.toggle('hidden', !has_visible_button);
			if (normalized_search && has_visible_button) category_details.open = true;
		}

		this.ensureVisibleBlockSelection();
	}

	ensureVisibleBlockSelection() {
		const block_list = this.$('#block-list');
		if (!block_list) return;

		const active_button = block_list.$('button.active');
		const has_visible_active_button = active_button && !active_button.classList.contains('hidden') && !active_button.closest('details')?.classList.contains('hidden');
		if (has_visible_active_button) return;

		const first_visible_button = block_list.$('details:not(.hidden) multi-select button:not(.hidden)');
		if (!first_visible_button) return;

		const multi_select = first_visible_button.closest('multi-select');
		multi_select?.setActiveButton(first_visible_button);
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

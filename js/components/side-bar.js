class SideBar extends HTMLElement {
	connectedCallback() {
		this.classList.add('ui');
	}

	showEditTools() {
		this.innerHTML = html`
			<multi-select class="round-button-group" id="edit-layer" type="round"></multi-select>
			<multi-select id="block-list" type="text left"></multi-select>
			<multi-select class="round-button-group" id="edit-tools" type="round"></multi-select>
		`;

		// Layers
		const edit_layer_select = this.$('#edit-layer');

		edit_layer_select.onchange = () => {
			// Update body class to reflect selected layer
			document.body.classList.remove('edit-layer-0', 'edit-layer-1', 'edit-layer-2');
			document.body.classList.add(`edit-layer-${edit_layer_select.value}`);
		};

		edit_layer_select.add('0', 'filter_1', 'Edit layer 1');
		edit_layer_select.add('1', 'filter_2', 'Edit layer 2');
		edit_layer_select.add('2', 'filter_3', 'Edit layer 3');
		edit_layer_select.value = '1';

		// Blocks
		const block_list_select = this.$('#block-list');
		for (const block_name in blocks) {
			const label = block_name[0].toUpperCase() + block_name.slice(1);
			block_list_select.add(block_name, label, `Select ${label} block`);
		}
		block_list_select.value = 'dirt';

		// Tools
		const edit_tools_select = this.$('#edit-tools');
		edit_tools_select.add('pen', 'draw', 'Select pen tool');
		edit_tools_select.add('line', 'diagonal_line', 'Select line tool');
		edit_tools_select.add('rectangle', 'crop_square', 'Select rectangle tool');
		edit_tools_select.add('ellipse', 'radio_button_unchecked', 'Select ellipse tool');
		edit_tools_select.add('erase', 'ink_eraser', 'Select erase tool');
		edit_tools_select.add('paint', 'format_paint', 'Select paint tool');
		edit_tools_select.value = 'pen';

		// Open sidebar
		this.classList.add('open');
	}
}

customElements.define('side-bar', SideBar);

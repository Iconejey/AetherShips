class SideBar extends HTMLElement {
	connectedCallback() {
		this.classList.add('ui');
	}

	showEditTools() {
		this.innerHTML = html`
			<div id="block-list"></div>
			<div id="edit-tools">
				<button class="round" id="pen-tool" title="Select pen tool">draw</button>
				<button class="round" id="line-tool" title="Select line tool">diagonal_line</button>
				<button class="round" id="rectangle-tool" title="Select rectangle tool">crop_square</button>
				<button class="round" id="ellipse-tool" title="Select ellipse tool">radio_button_unchecked</button>
				<button class="round" id="erase-tool" title="Select erase tool">ink_eraser</button>
				<button class="round" id="paint-tool" title="Select paint tool">format_paint</button>
			</div>
		`;

		for (const block_name in blocks) {
			const block_button = document.createElement('button');
			block_button.classList.add('text', 'left');
			block_button.textContent = block_name[0].toUpperCase() + block_name.slice(1);

			block_button.onclick = () => {
				console.log(`Selected block: ${block_name}`);
			};

			this.$('#block-list').appendChild(block_button);
		}

		this.classList.add('open');
	}
}

customElements.define('side-bar', SideBar);

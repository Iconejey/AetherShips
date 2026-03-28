class ColorPicker extends HTMLElement {
	static isValidHexColor(value) {
		return /^#([0-9A-Fa-f]{3}){1,2}$/.test(value);
	}

	get value() {
		return this.$('input[type="color"]').value;
	}

	set value(new_value) {
		const is_valid = ColorPicker.isValidHexColor(new_value);
		this.classList.toggle('invalid', !is_valid);
		this.$('input[type="text"]').value = new_value;
		if (is_valid) this.$('input[type="color"]').value = new_value;
	}

	connectedCallback() {
		this.innerHTML = html`
			<input type="color" title="Pick color" />
			<input type="text" title="Hex color code" />
		`;

		this.$('input[type="color"]').addEventListener('input', event => {
			this.value = event.target.value;
		});

		this.$('input[type="text"]').addEventListener('input', event => {
			this.value = event.target.value;
		});

		this.value = '#ffffff'; // Default color
	}
}

customElements.define('color-picker', ColorPicker);

class MultiSelect extends HTMLElement {
	get value() {
		return this.$('.active')?.getAttribute('data-value');
	}

	set value(new_value) {
		const button = this.$(`[data-value="${new_value}"]`);
		if (button) this.setActiveButton(button);
	}

	get type() {
		return this.getAttribute('type') || 'text';
	}

	connectedCallback() {
		this.addEventListener('click', event => {
			if (event.target.tagName === 'BUTTON') this.setActiveButton(event.target);
		});
	}

	setActiveButton(button) {
		this.$$('.active').forEach(button => button.classList.remove('active'));
		button.classList.toggle('active');
		this.onchange?.(this.value);
	}

	add(value, label, title = 'Select') {
		const button = document.createElement('button');
		button.setAttribute('data-value', value);
		button.textContent = label;
		button.title = title;
		button.classList.add(...this.type.split(' '));
		this.appendChild(button);
	}
}

customElements.define('multi-select', MultiSelect);

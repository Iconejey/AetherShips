class IconToggle extends HTMLElement {
	get button() {
		return this.$('button');
	}

	get on_icon() {
		return this.getAttribute('on-icon') || '';
	}

	get off_icon() {
		return this.getAttribute('off-icon') || '';
	}

	set value(new_value) {
		this.button.innerText = new_value ? this.on_icon : this.off_icon;
		this.onchange?.(new_value);
	}

	get value() {
		return this.button.innerText === this.on_icon;
	}

	connectedCallback() {
		this.innerHTML = html`<button class="round"></button>`;
		this.button.addEventListener('click', e => (this.value = !this.value));
		this.value = true;
	}
}

customElements.define('icon-toggle', IconToggle);

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
			event.target.blur();
		});
	}

	setActiveButton(button) {
		this.$$('.active').forEach(button => button.classList.remove('active'));
		button.classList.toggle('active');
		this.onchange?.(this.value);
	}

	getValueForEvent(event) {
		for (const button of this.$$('button[data-shortcut]')) {
			const shortcut = button.getAttribute('data-shortcut');
			if (!this.shortcutMatches(event, shortcut)) continue;
			return button.getAttribute('data-value');
		}
	}

	shortcutMatches(event, shortcut) {
		const parsed_shortcut = this.parseShortcut(shortcut);
		if (!parsed_shortcut) return false;

		if (event.ctrlKey !== parsed_shortcut.ctrl_key) return false;
		if (event.shiftKey !== parsed_shortcut.shift_key) return false;
		if (event.altKey !== parsed_shortcut.alt_key) return false;
		if (event.metaKey !== parsed_shortcut.meta_key) return false;

		if (parsed_shortcut.code) {
			return event.code === parsed_shortcut.code || event.code === parsed_shortcut.numpad_code;
		}

		return event.key.toLowerCase() === parsed_shortcut.key;
	}

	parseShortcut(shortcut) {
		if (!shortcut) return null;

		const parsed_shortcut = {
			ctrl_key: false,
			shift_key: false,
			alt_key: false,
			meta_key: false,
			key: null,
			code: null,
			numpad_code: null
		};

		const shortcut_tokens = shortcut
			.toLowerCase()
			.split('+')
			.map(token => token.trim())
			.filter(Boolean);

		for (const token of shortcut_tokens) {
			if (token === 'ctrl' || token === 'control') {
				parsed_shortcut.ctrl_key = true;
				continue;
			}

			if (token === 'shift') {
				parsed_shortcut.shift_key = true;
				continue;
			}

			if (token === 'alt') {
				parsed_shortcut.alt_key = true;
				continue;
			}

			if (token === 'meta' || token === 'cmd' || token === 'command') {
				parsed_shortcut.meta_key = true;
				continue;
			}

			if (/^[0-9]$/.test(token)) {
				parsed_shortcut.key = token;
				parsed_shortcut.code = `Digit${token}`;
				parsed_shortcut.numpad_code = `Numpad${token}`;
				continue;
			}

			parsed_shortcut.key = token;
		}

		return parsed_shortcut.key || parsed_shortcut.code ? parsed_shortcut : null;
	}

	add(value, label, title = 'Select', shortcut = '') {
		const button = document.createElement('button');
		button.setAttribute('data-value', value);
		button.textContent = label;
		const display_title = shortcut ? `${title} (${shortcut})` : title;
		button.title = display_title;
		if (shortcut) button.setAttribute('data-shortcut', shortcut);
		button.classList.add(...this.type.split(' '));
		this.appendChild(button);
	}
}

customElements.define('multi-select', MultiSelect);

/**
 * A simple tagged template function to create HTML strings. It concatenates the string literals and interpolated values into a single string.
 */
const html = (strings, ...values) => strings.reduce((result, string, i) => result + string + (values[i] || ''), '');

// Add $ property to HTMLElement prototype
Object.defineProperty(HTMLElement.prototype, '$', {
	get() {
		return this.querySelector.bind(this);
	}
});

// Add $$ property to HTMLElement prototype
Object.defineProperty(HTMLElement.prototype, '$$', {
	get() {
		return this.querySelectorAll.bind(this);
	}
});

---
name: Component creation
description: This custom agent creates a new component based on the provided tag and optional description.
---

Use the provided tag and optional description to create a new component js and css file. Example with tag `my-elem` and no description:

1. Create a file named `my-elem.js` in the components directory with the following content:

```js
class MyElem extends HTMLElement {
	onconnectedCallback() {
		this.innerHTML = html``;
	}
}

customElements.define('my-elem', MyElem);
```

2. Create a file named `my-elem.css` in the styles directory with the following content:

```css
my-elem {
	display: block;
}
```

3. Add new files in index.html.

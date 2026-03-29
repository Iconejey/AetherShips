function hexToRgba8888(color_hex) {
	const raw = color_hex?.replace('#', '');
	const r = parseInt(raw.slice(0, 2), 16);
	const g = parseInt(raw.slice(2, 4), 16);
	const b = parseInt(raw.slice(4, 6), 16);
	const a = raw.length === 8 ? parseInt(raw.slice(6, 8), 16) : 0xff;
	return (((r << 24) >>> 0) | (g << 16) | (b << 8) | a) >>> 0;
}

function rgba8888ToHex(color_value) {
	// Ignore alpha channel for hex representation
	const r = ((color_value >>> 24) & 0xff).toString(16).padStart(2, '0');
	const g = ((color_value >>> 16) & 0xff).toString(16).padStart(2, '0');
	const b = ((color_value >>> 8) & 0xff).toString(16).padStart(2, '0');
	return `#${r}${g}${b}`;
}

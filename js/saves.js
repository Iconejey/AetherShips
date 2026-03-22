// Loads a galaxy save by name and returns the parsed data
window.saves.load = async function (name) {
	const { ipcRenderer } = require('electron');
	return ipcRenderer.invoke('galaxy-save-load', name);
};

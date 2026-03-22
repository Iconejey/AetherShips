const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const figlet = require('figlet');

figlet.defaults({ fontPath: path.join(__dirname, 'node_modules', 'figlet', 'fonts') });

contextBridge.exposeInMainWorld('figlet', (text, options) => {
	return new Promise((resolve, reject) => {
		figlet(text, options, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

contextBridge.exposeInMainWorld('saves', {
	create: name => ipcRenderer.invoke('galaxy-save-create', name),
	/**
	 * Returns [{ name, created }] for each save
	 */
	list: () => ipcRenderer.invoke('galaxy-save-list'),
	delete: name => ipcRenderer.invoke('galaxy-save-delete', name),
	load: name => ipcRenderer.invoke('galaxy-save-load', name)
});

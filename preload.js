const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const figlet = require('figlet');

figlet.defaults({ fontPath: path.join(__dirname, 'node_modules', 'figlet', 'fonts') });

contextBridge.exposeInMainWorld('saves', {
	listGalaxies: () => ipcRenderer.invoke('save-list-galaxies'),
	createGalaxy: name => ipcRenderer.invoke('save-create-galaxy', name),
	deleteGalaxy: name => ipcRenderer.invoke('save-delete-galaxy', name),
	writeGalaxy: (name, galaxy) => ipcRenderer.invoke('save-write-galaxy', name, galaxy),
	loadGalaxy: name => ipcRenderer.invoke('save-load-galaxy', name),
	writeEntity: (name, entity) => ipcRenderer.invoke('save-write-entity', name, entity),
	loadEntity: (name, entity) => ipcRenderer.invoke('save-load-entity', name, entity)
});

contextBridge.exposeInMainWorld('figlet', (text, options) => {
	return new Promise((resolve, reject) => {
		figlet(text, options, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

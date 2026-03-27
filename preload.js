const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const figlet = require('figlet');

figlet.defaults({ fontPath: path.join(__dirname, 'node_modules', 'figlet', 'fonts') });

contextBridge.exposeInMainWorld('saves', {
	listGalaxies: () => ipcRenderer.invoke('save-list-galaxies'),
	createGalaxy: galaxy_name => ipcRenderer.invoke('save-create-galaxy', galaxy_name),
	deleteGalaxy: galaxy_name => ipcRenderer.invoke('save-delete-galaxy', galaxy_name),
	writeGalaxy: galaxy => ipcRenderer.invoke('save-write-galaxy', galaxy),
	loadGalaxy: galaxy_name => ipcRenderer.invoke('save-load-galaxy', galaxy_name),
	writeEntity: (galaxy_name, serialized_entity) => ipcRenderer.invoke('save-write-entity', galaxy_name, serialized_entity),
	loadEntities: (galaxy_name, position) => ipcRenderer.invoke('save-load-entities', galaxy_name, position),
	writeLayerChunk: (galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type, uint32_array) =>
		ipcRenderer.invoke('save-write-layer-chunk', galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type, Buffer.from(uint32_array)),
	loadLayerChunk: (galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type) => ipcRenderer.invoke('save-load-layer-chunk', galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type),
	listChunks: (galaxy_name, serialized_entity, layer_index) => ipcRenderer.invoke('save-list-chunks', galaxy_name, serialized_entity, layer_index),
	clean: galaxy_name => ipcRenderer.invoke('save-clean', galaxy_name),
	finalize: galaxy_name => ipcRenderer.invoke('save-finalize', galaxy_name)
});

contextBridge.exposeInMainWorld('figlet', (text, options) => {
	return new Promise((resolve, reject) => {
		figlet(text, options, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

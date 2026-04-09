const { contextBridge, ipcRenderer: ipc } = require('electron');
const fs = require('fs');
const path = require('path');
const figlet = require('figlet');

figlet.defaults({ fontPath: path.join(__dirname, 'node_modules', 'figlet', 'fonts') });

contextBridge.exposeInMainWorld('saves', {
	listGalaxies: () => ipc.invoke('save-list-galaxies'),
	createGalaxy: galaxy_name => ipc.invoke('save-create-galaxy', galaxy_name),
	deleteGalaxy: galaxy_name => ipc.invoke('save-delete-galaxy', galaxy_name),
	writeGalaxy: galaxy => ipc.invoke('save-write-galaxy', galaxy),
	loadGalaxy: galaxy_name => ipc.invoke('save-load-galaxy', galaxy_name),
	writeEntity: (galaxy_name, serialized_entity) => ipc.invoke('save-write-entity', galaxy_name, serialized_entity),
	loadEntities: (galaxy_name, position) => ipc.invoke('save-load-entities', galaxy_name, position),

	writeLayerChunk: (galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type, uint32_array) => {
		const buffer = Buffer.from(uint32_array.buffer, uint32_array.byteOffset, uint32_array.byteLength);
		return ipc.invoke('save-write-layer-chunk', galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type, buffer);
	},

	loadLayerChunk: async (galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type) => {
		const data = await ipc.invoke('save-load-layer-chunk', galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type);
		return new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4);
	},

	listChunks: (galaxy_name, serialized_entity, layer_index) => ipc.invoke('save-list-chunks', galaxy_name, serialized_entity, layer_index),
	clean: galaxy_name => ipc.invoke('save-clean', galaxy_name),
	finalize: galaxy_name => ipc.invoke('save-finalize', galaxy_name)
});

contextBridge.exposeInMainWorld('templates', {
	loadEntity: template_name => ipc.invoke('template-load-entity', template_name),
	listChunks: (template_name, layer_index) => ipc.invoke('template-list-chunks', template_name, layer_index),

	loadLayerChunk: async (template_name, layer_index, chunk_x, chunk_y, type) => {
		const data = await ipc.invoke('template-load-layer-chunk', template_name, layer_index, chunk_x, chunk_y, type);
		return new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4);
	}
});

contextBridge.exposeInMainWorld('figlet', (text, options) => {
	return new Promise((resolve, reject) => {
		figlet(text, options, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
});

contextBridge.exposeInMainWorld('audio', {
	playTrack: track_name => ipc.send('audio-play', track_name),
	stopTrack: () => ipc.send('audio-stop'),
	setGalaxyLoaded: val => ipc.send('audio-set-galaxy-loaded', val)
});

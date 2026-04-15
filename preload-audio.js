const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('audioController', {
	notifyReady: () => ipcRenderer.send('audio-ready'),
	onSetMusicTracks: callback => ipcRenderer.on('set-music-tracks', (e, tracks) => callback(tracks)),
	onSetMuffle: callback => ipcRenderer.on('set-muffle', (e, muffle_level) => callback(muffle_level)),
	onPlaySfx: callback => ipcRenderer.on('play-sfx', (e, sfx_path) => callback(sfx_path))
});

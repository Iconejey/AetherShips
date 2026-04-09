const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

contextBridge.exposeInMainWorld('audioController', {
	notifyReady: () => ipcRenderer.send('audio-ready'),
	onPlayTrack: callback => ipcRenderer.on('play-track', (e, trackName) => callback(trackName)),
	onStopTrack: callback => ipcRenderer.on('stop-track', () => callback()),
	getTrackSource: trackName => {
		const trackPath = path.join(__dirname, 'js', 'strudel', `${trackName}.js`);
		if (fs.existsSync(trackPath)) {
			return fs.readFileSync(trackPath, 'utf8');
		}
		return null;
	}
});

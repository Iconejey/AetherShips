const { app, BrowserWindow } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('force-color-profile', 'srgb');

function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: false,
			preload: path.join(__dirname, 'preload.js')
		}
	});

	win.loadFile('index.html');
}

app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

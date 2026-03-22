const { ipcMain } = require('electron');
const fs = require('fs');
ipcMain.handle('galaxy-save-create', async (event, name) => {
	const invalid = /[<>:"/\\|?*]/g;
	if (!name || invalid.test(name)) throw new Error('Invalid name');

	const userData = app.getPath('userData');
	const savesDir = path.join(userData, 'saves');
	const savePath = path.join(savesDir, name);
	try {
		if (!fs.existsSync(savesDir)) fs.mkdirSync(savesDir);
		if (fs.existsSync(savePath)) throw new Error('Save already exists');

		fs.mkdirSync(savePath);
		const data = { player: { position: { x: 0, y: 0 } } };
		fs.writeFileSync(path.join(savePath, 'galaxy.json'), JSON.stringify(data, null, 2));
		return true;
	} catch (err) {
		throw new Error(err.message);
	}
});
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

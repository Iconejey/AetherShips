const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Load a save's galaxy.json
ipcMain.handle('galaxy-save-load', async (event, name) => {
	const invalid = /[<>:"/\\|?*]/g;
	if (!name || invalid.test(name)) throw new Error('Invalid name');

	const user_data = app.getPath('userData');
	const saves_dir = path.join(user_data, 'saves');
	const save_path = path.join(saves_dir, name, 'galaxy.json');
	try {
		if (!fs.existsSync(save_path)) throw new Error('Save does not exist');
		const data = fs.readFileSync(save_path, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		throw new Error(err.message);
	}
});
ipcMain.handle('galaxy-save-create', async (event, name) => {
	const invalid = /[<>:"/\\|?*]/g;
	if (!name || invalid.test(name)) throw new Error('Invalid name');

	const user_data = app.getPath('userData');
	const saves_dir = path.join(user_data, 'saves');
	const save_path = path.join(saves_dir, name);
	try {
		if (!fs.existsSync(saves_dir)) fs.mkdirSync(saves_dir);
		if (fs.existsSync(save_path)) throw new Error('Save already exists');

		fs.mkdirSync(save_path);

		const data = { player: { position: { x: 0, y: 0 } } };

		fs.writeFileSync(path.join(save_path, 'galaxy.json'), JSON.stringify(data, null, 2));
		return true;
	} catch (err) {
		throw new Error(err.message);
	}
});

// List save folders
ipcMain.handle('galaxy-save-list', async () => {
	const user_data = app.getPath('userData');
	const saves_dir = path.join(user_data, 'saves');
	try {
		if (!fs.existsSync(saves_dir)) return [];
		return fs
			.readdirSync(saves_dir)
			.filter(name => {
				const savePath = path.join(saves_dir, name);
				return fs.statSync(savePath).isDirectory();
			})
			.map(name => {
				const savePath = path.join(saves_dir, name);
				const stats = fs.statSync(savePath);
				// Use birthtime for creation date (ctime fallback for Linux)
				const created = stats.birthtime || stats.ctime;
				return { name, created };
			});
	} catch (err) {
		throw new Error(err.message);
	}
});

// Delete a save folder and its contents
ipcMain.handle('galaxy-save-delete', async (event, name) => {
	const invalid = /[<>:"/\\|?*]/g;
	if (!name || invalid.test(name)) throw new Error('Invalid name');

	const user_data = app.getPath('userData');
	const saves_dir = path.join(user_data, 'saves');
	const save_path = path.join(saves_dir, name);
	try {
		if (!fs.existsSync(save_path)) throw new Error('Save does not exist');

		// Recursively delete the save directory
		fs.rmSync(save_path, { recursive: true, force: true });
		return true;
	} catch (err) {
		throw new Error(err.message);
	}
});

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

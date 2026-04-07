const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function isValidName(name) {
	return !!name && !/[<>:"/\\|?*\x00-\x1F]/.test(name) && name.length <= 255;
}

function getSavePaths(temp, galaxy_name, entity, layer_index, chunk_x, chunk_y, data_type) {
	const paths = {};

	// Saves dir
	const user_data = app.getPath('userData');
	paths.saves_dir = path.join(user_data, 'saves');

	// If galaxy name provided, add save and galaxy data paths
	if (!galaxy_name) return paths;
	paths.save_path = path.join(paths.saves_dir, galaxy_name + (temp ? ' temp' : ''));
	paths.galaxy_data_path = path.join(paths.save_path, 'galaxy.json');

	// If entity provided, add sector and entity paths
	if (!entity) return paths;
	const { x, y } = entity.position;

	const sx = Math.floor(x / (32 * 256));
	const sy = Math.floor(y / (32 * 256));
	paths.sector_path = path.join(paths.save_path, `sector_${sx}_${sy}`);
	paths.entity_path = path.join(paths.sector_path, `entity_${entity.id}`);
	paths.entity_data_path = path.join(paths.entity_path, 'entity.json');

	// If layer index provided, add layer path
	if (layer_index === undefined) return paths;
	paths.layer_path = path.join(paths.entity_path, `layer_${layer_index}`);

	// If chunk coords, and data type, add .dat path
	if (chunk_x === undefined || chunk_y === undefined || !data_type) return paths;
	const file_name = `${data_type}_${chunk_x}_${chunk_y}.dat`;
	paths.dat_path = path.join(paths.layer_path, file_name);

	return paths;
}

function getTemplatePaths(template_name, layer_index, chunk_x, chunk_y, data_type) {
	const paths = {};
	paths.templates_dir = path.join(__dirname, 'templates');

	if (!template_name) return paths;
	if (!isValidName(template_name)) throw new Error('Invalid template name');

	paths.template_path = path.join(paths.templates_dir, template_name);
	paths.entity_data_path = path.join(paths.template_path, 'entity.json');

	if (layer_index === undefined) return paths;
	paths.layer_path = path.join(paths.template_path, `layer_${layer_index}`);

	if (chunk_x === undefined || chunk_y === undefined || !data_type) return paths;
	const file_name = `${data_type}_${chunk_x}_${chunk_y}.dat`;
	paths.dat_path = path.join(paths.layer_path, file_name);

	return paths;
}

ipcMain.handle('template-load-entity', async (event, template_name) => {
	const { entity_data_path } = getTemplatePaths(template_name);

	try {
		if (!fs.existsSync(entity_data_path)) throw new Error('Template entity data not found');
		const data = fs.readFileSync(entity_data_path, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		throw new Error(err.message);
	}
});

ipcMain.handle('template-load-layer-chunk', async (event, template_name, layer_index, chunk_x, chunk_y, type) => {
	const { dat_path } = getTemplatePaths(template_name, layer_index, chunk_x, chunk_y, type);
	if (!fs.existsSync(dat_path)) throw new Error('Template chunk data does not exist');
	return fs.readFileSync(dat_path);
});

ipcMain.handle('template-list-chunks', async (event, template_name, layer_index) => {
	const { layer_path } = getTemplatePaths(template_name, layer_index);
	if (!fs.existsSync(layer_path)) return [];

	const files = fs.readdirSync(layer_path);
	return files
		.filter(file => file.startsWith('states_'))
		.map(file => {
			const [, cx, cy] = file.match(/states_(\-?\d+)_(\-?\d+)\.dat/).map(Number);
			return { cx, cy };
		});
});

// List save folders
ipcMain.handle('save-list-galaxies', async () => {
	const { saves_dir } = getSavePaths(false);

	try {
		const list = [];
		if (!fs.existsSync(saves_dir)) return list;

		for (const name of fs.readdirSync(saves_dir)) {
			const save_path = path.join(saves_dir, name);
			const stats = fs.statSync(save_path);
			if (stats.isDirectory()) {
				// Use birthtime for creation date (ctime fallback for Linux)
				const created = stats.birthtime || stats.ctime;
				list.push({ name, created });
			}
		}

		return list;
	} catch (err) {
		throw new Error(err.message);
	}
});

// Create new Galaxy
ipcMain.handle('save-create-galaxy', async (event, name) => {
	if (!isValidName(name)) throw new Error('Invalid galaxy name');

	// Get paths for the new galaxy
	const { saves_dir, save_path, galaxy_data_path } = getSavePaths(false, name);

	try {
		// Ensure saves directory exists
		if (!fs.existsSync(saves_dir)) fs.mkdirSync(saves_dir);

		// Check if save already exists
		if (fs.existsSync(save_path)) throw new Error('Galaxy already exists');

		// Create save directory
		fs.mkdirSync(save_path);

		// Initialize galaxy data
		const data = {
			name,
			seed: Math.floor(Math.random() * 1e9),
			player: {
				position: { x: 0, y: 0, r: 0 },
				driven_entity: null
			}
		};

		fs.writeFileSync(galaxy_data_path, JSON.stringify(data, null, 2));
		return true;
	} catch (err) {
		throw new Error(err.message);
	}
});

// Delete a save folder and its contents
ipcMain.handle('save-delete-galaxy', async (event, name) => {
	// Get path for the save to delete
	const { save_path } = getSavePaths(false, name);

	try {
		if (!fs.existsSync(save_path)) throw new Error('Galaxy does not exist');

		// Recursively delete the save directory
		fs.rmSync(save_path, { recursive: true, force: true });
		return true;
	} catch (err) {
		throw new Error(err.message);
	}
});

// Write galaxy.json
ipcMain.handle('save-write-galaxy', async (event, galaxy) => {
	const { galaxy_data_path } = getSavePaths(true, galaxy.name);

	try {
		const dir = path.dirname(galaxy_data_path);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(galaxy_data_path, JSON.stringify(galaxy, null, 2));
		return true;
	} catch (err) {
		throw new Error(err.message);
	}
});

// Load galaxy.json
ipcMain.handle('save-load-galaxy', async (event, name) => {
	const { galaxy_data_path } = getSavePaths(false, name);

	try {
		if (!fs.existsSync(galaxy_data_path)) {
			fs.rmSync(path.dirname(galaxy_data_path), { recursive: true, force: true });
			throw new Error('Galaxy data not found, save folder deleted to prevent future issues');
		}

		const data = fs.readFileSync(galaxy_data_path, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		throw new Error(err.message);
	}
});

// Write entity.json
ipcMain.handle('save-write-entity', async (event, name, serialized_entity) => {
	const { entity_data_path } = getSavePaths(true, name, serialized_entity);

	try {
		// Ensure parent directory exists
		const parentDir = path.dirname(entity_data_path);
		if (!fs.existsSync(parentDir)) {
			fs.mkdirSync(parentDir, { recursive: true });
		}
		fs.writeFileSync(entity_data_path, JSON.stringify(serialized_entity, null, 2));
		return true;
	} catch (err) {
		throw new Error(err.message);
	}
});

// Returns the list of serialized entities in the sector of the given position
ipcMain.handle('save-load-entities', async (event, galaxy_name, position) => {
	const { sector_path } = getSavePaths(false, galaxy_name, { position });
	const list = [];
	if (!fs.existsSync(sector_path)) return list;

	for (const folder_name of fs.readdirSync(sector_path)) {
		if (folder_name.startsWith('entity_')) {
			const entity_data_path = path.join(sector_path, folder_name, 'entity.json');
			const data = fs.readFileSync(entity_data_path, 'utf-8');
			list.push(JSON.parse(data));
		}
	}

	return list;
});

// Write layer chunk binary data (states/colors)
ipcMain.handle('save-write-layer-chunk', async (event, galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type, buffer) => {
	const { dat_path, layer_path } = getSavePaths(true, galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type);
	if (!fs.existsSync(layer_path)) fs.mkdirSync(layer_path, { recursive: true });
	fs.writeFileSync(dat_path, buffer);
	return true;
});

// Load layer chunk binary data
ipcMain.handle('save-load-layer-chunk', async (event, galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type) => {
	const { dat_path } = getSavePaths(false, galaxy_name, serialized_entity, layer_index, chunk_x, chunk_y, type);
	if (!fs.existsSync(dat_path)) throw new Error('Chunk data does not exist');
	return fs.readFileSync(dat_path);
});

// List chunks in entity layer
ipcMain.handle('save-list-chunks', async (event, galaxy_name, serialized_entity, layer_index) => {
	const { layer_path } = getSavePaths(false, galaxy_name, serialized_entity, layer_index);
	if (!fs.existsSync(layer_path)) return [];

	const files = fs.readdirSync(layer_path);
	return files
		.filter(file => file.startsWith('states_'))
		.map(file => {
			const [, cx, cy] = file.match(/states_(\-?\d+)_(\-?\d+)\.dat/).map(Number);
			return { cx, cy };
		});
});

// Remove temporary save folder on game save start (in case of crash during save)
ipcMain.handle('save-clean', async (event, galaxy_name) => {
	const temp_path = getSavePaths(true, galaxy_name).save_path;
	if (fs.existsSync(temp_path)) fs.rmSync(temp_path, { recursive: true, force: true });
	return true;
});

// Finalize save: delete old save folder and rename temp to real
ipcMain.handle('save-finalize', async (event, galaxy_name) => {
	const temp_path = getSavePaths(true, galaxy_name).save_path;
	const final_path = getSavePaths(false, galaxy_name).save_path;

	// If temp folder doesn't exist, something went wrong during save
	if (!fs.existsSync(temp_path)) throw new Error('Temporary save folder does not exist');

	// Remove old save folder if it exists, with robust retry logic for ENOTEMPTY
	if (fs.existsSync(final_path)) {
		const maxRetries = 5;
		const delay = ms => new Promise(res => setTimeout(res, ms));
		let lastErr = null;
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				fs.rmSync(final_path, { recursive: true, force: true });
				lastErr = null;
				break;
			} catch (err) {
				lastErr = err;
				if (err.code === 'ENOTEMPTY' || err.code === 'EPERM' || err.code === 'EBUSY') {
					// Wait and retry
					Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 + attempt * 100); // 100ms, 200ms, ...
					continue;
				} else {
					throw err;
				}
			}
		}
		if (lastErr) throw lastErr;
	}

	// Rename temp folder to real save folder
	fs.renameSync(temp_path, final_path);

	return true;
});

app.commandLine.appendSwitch('force-color-profile', 'srgb');

function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen: true,
		autoHideMenuBar: true,
		menuBarVisibility: 'hidden',
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

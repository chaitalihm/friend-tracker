const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Everything lives inside the OS-standard per-user app folder.
// Nothing is ever sent anywhere. No network, no accounts.
const userDir = () => app.getPath('userData');
const dataFile = () => path.join(userDir(), 'friends.json');
const photosDir = () => path.join(userDir(), 'photos');

const DEFAULT_DATA = {
  friends: [],
  settings: {
    fadeMaxDays: 90,      // a friend is fully faded once it's been this long
    birthdayLeadDays: 7,  // show the cake flag when a birthday is within this many days
    planLeadDays: 3,      // show the plan flag when a planned hangout is within this many days
    nudgeAfterDays: 30,   // the most-overdue friend gets circled once past this
    textOverdueDays: 30,  // remind to text if it's been longer than this
    callOverdueDays: 45,  // remind to call if it's been longer than this
    fadeMode: 'smooth'    // 'smooth' or 'stepped'
  }
};

function ensureDirs() {
  if (!fs.existsSync(userDir())) fs.mkdirSync(userDir(), { recursive: true });
  if (!fs.existsSync(photosDir())) fs.mkdirSync(photosDir(), { recursive: true });
}

function loadData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile(), 'utf-8'));
    parsed.settings = Object.assign({}, DEFAULT_DATA.settings, parsed.settings || {});
    parsed.friends = Array.isArray(parsed.friends) ? parsed.friends : [];
    return parsed;
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData(data) {
  ensureDirs();
  fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp'
};

ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_e, data) => saveData(data));

// Photos are returned as data URLs so the renderer never needs filesystem access.
ipcMain.handle('photo:read', (_e, filename) => {
  try {
    const buf = fs.readFileSync(path.join(photosDir(), filename));
    const mime = MIME[path.extname(filename).toLowerCase()] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    return null;
  }
});

// Copy a chosen image into the app's own photos folder and return its new filename.
ipcMain.handle('photo:import', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Choose a photo',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
  });
  if (res.canceled || !res.filePaths.length) return null;
  ensureDirs();
  const src = res.filePaths[0];
  const ext = path.extname(src).toLowerCase() || '.png';
  const filename = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  fs.copyFileSync(src, path.join(photosDir(), filename));
  return filename;
});

// Copy a file that was dropped onto the board (renderer hands us the path).
ipcMain.handle('photo:importPath', (_e, src) => {
  try {
    ensureDirs();
    const ext = path.extname(src).toLowerCase() || '.png';
    const filename = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.copyFileSync(src, path.join(photosDir(), filename));
    return filename;
  } catch (e) {
    return null;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: 'Keep in Touch',
    backgroundColor: '#EDEAE3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

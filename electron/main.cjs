// Rockmundo - Electron main process (Phase 1)
// Loads the built Vite app from ../dist via file:// in production.
// In dev (ELECTRON_START_URL set), loads from the Vite dev server.

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const isDev = !!process.env.ELECTRON_START_URL;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0b1220', // matches fm-bg dark blue
    title: 'Rockmundo',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Hide the default OS menu chrome on Windows/Linux; macOS keeps app menu.
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in the user's default browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

// Harden: block in-app navigation to unknown origins.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('file://') ||
      (isDev && url.startsWith(process.env.ELECTRON_START_URL || ''));
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});

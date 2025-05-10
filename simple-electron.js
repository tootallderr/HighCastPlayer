const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

// Global window references
let mainWindow;

// Create the main window
function createMainWindow() {
  log.info('Creating main window');
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'IPTV Player',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
  });

  // Load the index.html file
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'ui/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    log.info('Main window ready to show');
    mainWindow.show();
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Window closed event
  mainWindow.on('closed', () => {
    log.info('Main window closed');
    mainWindow = null;
  });
  
  log.info('Main window created successfully');
}

// App ready event
app.whenReady().then(() => {
  log.info('App ready');
  createMainWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Activate event (macOS)
app.on('activate', () => {
  log.info('App activated');
  if (mainWindow === null) {
    createMainWindow();
  }
});

// Log any uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

// Log any unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason);
});

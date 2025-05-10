const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL('data:text/html,<h1>Test Window</h1><p>If you see this, Electron is working!</p>');
  
  win.webContents.openDevTools();
  
  win.on('closed', () => {
    console.log('Window closed');
  });
}

app.whenReady().then(() => {
  console.log('App is ready, creating window');
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('App starting...');

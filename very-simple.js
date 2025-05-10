const { app, BrowserWindow } = require('electron');

let mainWindow;

function createWindow() {
  console.log('Creating window');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('data:text/html,<html><body><h1>If you see this, Electron is working!</h1></body></html>');
  
  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });
  
  console.log('Window created');
}

app.on('ready', () => {
  console.log('App ready');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  app.quit();
});

console.log('App script loaded');

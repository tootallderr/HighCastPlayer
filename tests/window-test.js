const { app, BrowserWindow } = require('electron');

console.log('Starting window test...');

app.whenReady().then(() => {
  console.log('App is ready, creating test window...');
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.loadURL('data:text/html,<h1>Test Window</h1>');
  
  win.on('ready-to-show', () => {
    console.log('Window is ready to show');
    win.show();
    console.log('Window should be visible now');
  });
  
  win.on('closed', () => {
    console.log('Window was closed');
  });
});

app.on('window-all-closed', () => {
  console.log('All windows closed, quitting app');
  app.quit();
});

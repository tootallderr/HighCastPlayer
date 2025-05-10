/**
 * IPTV Player Main Process
 * 
 * This is the entry point for the Electron application.
 */

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Setup global error handler first thing
const errorHandler = require('./error-handler');
errorHandler.setupGlobalErrorHandlers();

// Initialize critical directories before requiring other modules
function ensureAppDirectories() {
  const userData = app.getPath('userData');
  
  // Essential directories
  const dirs = [
    path.join(userData, 'data'),
    path.join(userData, 'data/playlists'),
    path.join(userData, 'data/recordings'),
    path.join(userData, 'logs'),
    path.join(userData, 'cache')
  ];
    // Create each directory if it doesn't exist
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } catch (err) {
        // Use our error handler
        const error = new Error(`Failed to create directory ${dir}: ${err.message}`);
        errorHandler.logError(error, 'DIRECTORY_CREATION');
      }
    }
  });
  
  // Create empty settings and sources files if they don't exist
  const settingsPath = path.join(userData, 'data', 'settings.json');
  const sourcesPath = path.join(userData, 'data', 'sources.json');
    if (!fs.existsSync(settingsPath)) {
    try {
      fs.writeFileSync(settingsPath, '{}', 'utf8');
      console.log('Created empty settings file');
    } catch (err) {
      // Use error handler for settings file creation errors
      const error = new Error(`Failed to create settings file: ${err.message}`);
      errorHandler.logError(error, 'SETTINGS_FILE_CREATION');
    }
  }
    if (!fs.existsSync(sourcesPath)) {
    try {
      fs.writeFileSync(sourcesPath, '{"remote":[],"local":[]}', 'utf8');
      console.log('Created empty sources file');
    } catch (err) {
      // Use error handler for sources file creation errors
      const error = new Error(`Failed to create sources file: ${err.message}`);
      errorHandler.logError(error, 'SOURCES_FILE_CREATION');
    }
  }
}

// Make sure directories exist before requiring modules that might need them
// Must be called after app is ready
function initAppDirectories() {
  try {
    ensureAppDirectories();
    
    // Initialize merged playlist file early
    const userData = app.getPath('userData');
    const mergedPlaylistPath = path.join(userData, 'data', 'merged-playlist.m3u8');
      if (!fs.existsSync(mergedPlaylistPath)) {
      try {
        fs.writeFileSync(mergedPlaylistPath, '#EXTM3U\n# Empty playlist file\n', 'utf8');
        console.log('Created empty merged playlist file');
      } catch (err) {
        // Use error handler for merged playlist file creation errors
        const error = new Error(`Failed to create merged playlist file: ${err.message}`);
        errorHandler.logError(error, 'PLAYLIST_FILE_CREATION');
      }
    }  } catch (err) {
    // Log error with error handler
    errorHandler.logError(err, 'APP_DIRECTORY_INITIALIZATION');
    
    // Show error dialog to user
    dialog.showErrorBox(
      'Initialization Error', 
      `Failed to initialize application directories: ${err.message}\n\nThe application may not work correctly.`
    );
  }
}

// Import path manager first to ensure it's initialized early
const pathManager = require('./path-manager');

// Now require other modules after our directory initialization function is defined
const dependencyCheck = require('./dependency-check-improved');
const platform = require('./platform');
const playerEngine = require('./player-engine');
const playlistManager = require('./playlist-manager');
const captionManager = require('./caption-manager');
// Use improved casting manager with better error handling
// Use the fixed casting manager which has better error handling
const castingManager = require('./casting-manager-fixed');
const recommendationEngine = require('./recommendation-engine-improved');
const recordingScheduler = require('./recording-scheduler');
const epgManager = require('./epg-manager');
const config = require('./config-manager');
const updater = require('./updater');
const autoStart = require('./auto-start');

// Keep a global reference of the window objects
let mainWindow;
let splashWindow;
let scheduleWindow;
let settingsWindow;

// Set environment
const isDev = process.argv.includes('--dev');
if (isDev) {
  process.env.NODE_ENV = 'development';
} else {
  process.env.NODE_ENV = 'production';
}

// Debug flags
const DEBUG_SPLASH = process.argv.includes('--debug-splash');

/**
 * Create the splash screen window
 */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../ui/splash.html'),
    protocol: 'file:',
    slashes: true
  }));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

/**
 * Create the schedule recording window
 */
function createScheduleWindow() {
  scheduleWindow = new BrowserWindow({
    width: 650,
    height: 700,
    title: 'Schedule Recording',
    parent: mainWindow,
    modal: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  scheduleWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../ui/schedule-recording.html'),
    protocol: 'file',
    slashes: true
  }));

  scheduleWindow.on('closed', () => {
    scheduleWindow = null;
  });
}

/**
 * Create the settings window
 */
function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 400,
    title: 'Settings',
    parent: mainWindow,
    modal: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: !isDev,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../ui/settings.html'),
    protocol: 'file',
    slashes: true
  }));

  if (isDev) {
    settingsWindow.webContents.openDevTools();
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Create the main application window
 */
function createMainWindow() {  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'IPTV Player',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: true, // Show immediately
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: !isDev,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../ui/index.html'),
    protocol: 'file',
    slashes: true
  }));
  
  // Set the main window in the updater for notifications
  updater.setMainWindow(mainWindow);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.once('ready-to-show', () => {
    console.log('Main window ready to show');
    if (splashWindow) {
      console.log('Closing splash window');
      splashWindow.close();
    }
    mainWindow.show();
  });

  // Set up application menu
  const menu = Menu.buildFromTemplate(getMenuTemplate());
  Menu.setApplicationMenu(menu);
}

/**
 * Get the application menu template
 */
function getMenuTemplate() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Playlist Source',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-add-playlist-dialog');
            }
          }
        },
        {
          label: 'Update Playlists',
          click: async () => {
            try {
              // Show notification in main window
              if (mainWindow) {
                mainWindow.webContents.send('status-message', { 
                  text: 'Updating playlists...',
                  type: 'info'
                });
              }
              
              // Trigger playlist update
              const result = await playlistManager.updateAllPlaylists();
              
              // Notify all windows
              BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('playlists-updated', result);
              });
              
              // Show result notification
              if (mainWindow) {
                mainWindow.webContents.send('status-message', { 
                  text: result.success 
                    ? `Successfully updated playlists with ${result.channels} channels` 
                    : `Playlist update failed: ${result.error}`,
                  type: result.success ? 'success' : 'error'
                });
              }
            } catch (error) {
              console.error('Error updating playlists:', error);
              if (mainWindow) {
                mainWindow.webContents.send('status-message', { 
                  text: `Error updating playlists: ${error.message}`,
                  type: 'error'
                });
              }
            }
          }
        },
        {
          label: 'Settings',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-settings');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          role: 'quit'
        }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => {
            mainWindow.webContents.send('player-toggle-play');
          }
        },
        {
          label: 'Stop',
          accelerator: 'Escape',
          click: () => {
            mainWindow.webContents.send('player-stop');
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            mainWindow.webContents.send('player-toggle-fullscreen');
          }
        }
      ]
    },
    {
      label: 'Recording',
      submenu: [
        {
          label: 'Start Recording',
          click: () => {
            mainWindow.webContents.send('start-recording');
          }
        },
        {
          label: 'Stop Recording',
          click: () => {
            mainWindow.webContents.send('stop-recording');
          }
        },
        { type: 'separator' },
        {
          label: 'Schedule Recording',
          click: () => {
            mainWindow.webContents.send('schedule-recording');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: 'About IPTV Player',
              message: 'IPTV Player v1.0.0',
              detail: 'A cross-platform, local-only IPTV player with DVR features.'
            });
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    // Add macOS-specific menu
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  return template;
}

/**
 * Check dependencies and initialize application
 */
async function initializeApp() {
  try {
    // Check dependencies
    const dependencyResult = dependencyCheck.checkAllDependencies();
    
    if (!dependencyResult.success) {
      const missingDeps = dependencyResult.missingCritical || [];
      const missingText = missingDeps.length > 0 
        ? `Missing critical dependencies: ${missingDeps.join(', ')}\n\n`
        : 'Critical dependency issues found.\n\n';
        
      const message = `${missingText}Please run the setup script for your platform:
      - Windows: setup.bat (Run as Administrator)
      - macOS/Linux: ./setup.sh
      
      See docs/0-prerequisites.md for manual installation instructions.`;
      
      dialog.showErrorBox('Dependency Check Failed', message);
      
      if (!isDev) {
        app.quit();
        return;
      } else {
        console.warn('Running in development mode with missing dependencies. Some features may not work.');
      }
    }
    
    // Check for optional dependencies and show warning if any are missing
    if (dependencyResult.hasOptionalIssues) {
      const optionalIssues = dependencyResult.optionalIssues;
      const missingOptional = [];
      
      if (optionalIssues.python) missingOptional.push('Python');
      if (optionalIssues.dotnet) missingOptional.push('.NET Runtime');
      if (optionalIssues.scheduler) missingOptional.push(platform.isWindows ? 'Task Scheduler' : 'Cron');
      
      console.warn(`Optional dependencies missing: ${missingOptional.join(', ')}. Some features may be limited.`);
    }
    
    // Initialize player engine
    await playerEngine.initialize();
    
    // Initialize recording scheduler
    await recordingScheduler.initialize();
      // Update playlists
    await playlistManager.updateAllPlaylists();
    
    // Schedule regular playlist updates
    playlistManager.scheduleUpdates(config.get('playlistUpdateInterval', 60));
    
    // Initialize EPG (Electronic Program Guide)
    try {
      await epgManager.initialize();
      console.log('EPG service initialized');
        // Check for updates if needed
      if (epgManager.shouldUpdateEpg()) {
        console.log('EPG data needs updating, starting update...');
        epgManager.updateAllSources()
          .then(result => console.log('EPG update completed:', result))
          .catch(err => {
            // Use error handler for EPG update errors
            errorHandler.logError(err, 'EPG_UPDATE');
          });
      }
    } catch (epgError) {
      // Use error handler for EPG initialization errors
      errorHandler.logError(epgError, 'EPG_INITIALIZATION');
      // Non-critical error, continue app startup
    }// Create the main window once initialization is complete
    console.log('Creating main window after initialization');    try {
      createMainWindow();
      console.log('Main window created');
    } catch (windowError) {
      // Use error handler for window creation errors
      errorHandler.logError(windowError, 'WINDOW_CREATION');
      dialog.showErrorBox('Window Creation Error', `Failed to create application window: ${windowError.message}`);
    }  } catch (error) {
    // Use error handler for initialization errors
    errorHandler.logError(error, 'APP_INITIALIZATION');
    
    // Make sure we display any errors even if dialog fails
    try {
      dialog.showErrorBox(
        'Initialization Failed', 
        `Failed to initialize application: ${error.message}`
      );
    } catch (dialogError) {
      // Use error handler for dialog errors
      errorHandler.logError(dialogError, 'ERROR_DIALOG');
      // Use a simpler approach as a fallback
      const errorWindow = new BrowserWindow({
        width: 500,
        height: 300,
        show: true      });
      errorWindow.loadURL(`data:text/html,<h2>Error</h2><p>${error.message}</p>`);
    }
      if (!isDev) {
      app.quit();
    }
  }
}

// Application event handlers
app.on('ready', () => {
  // Initialize directories before anything else
  initAppDirectories();
  
  createSplashWindow();
  
  // Set a safety timeout to close splash if main window doesn't load
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      console.log('Safety timeout: Closing splash window');
      splashWindow.close();
    }
  }, 15000); // 15 second timeout
  
  initializeApp();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up resources before quitting
app.on('will-quit', async (event) => {
  // Stop all scheduled recordings and clean up resources
  await recordingScheduler.shutdown();
  
  // Stop any active playback
  await playerEngine.stopPlayback();
  
  // Stop any active recording
  if (playerEngine.isRecording) {
    await playerEngine.stopRecording();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// IPC events for communication between renderer and main process

// Settings events
ipcMain.on('show-settings', () => {
  if (settingsWindow) {
    settingsWindow.focus();
  } else {
    createSettingsWindow();
  }
});

ipcMain.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipcMain.on('get-settings', (event) => {
  try {
    const settings = config.getAll();
    event.reply('settings-loaded', settings);
  } catch (error) {
    event.reply('error', { component: 'settings', message: error.message });
  }
});

ipcMain.on('save-settings', (event, settings) => {
  try {
    const result = config.setAll(settings);
    event.reply('settings-saved', { success: result });
    
    // Update any services that depend on settings
    if (settings.playlists && settings.playlists.updateInterval) {
      playlistManager.scheduleUpdates(settings.playlists.updateInterval);
    }
  } catch (error) {
    event.reply('error', { component: 'settings', message: error.message });
  }
});

ipcMain.on('reset-settings', (event) => {
  try {
    const result = config.reset();
    event.reply('settings-reset', { success: result });
  } catch (error) {
    event.reply('error', { component: 'settings', message: error.message });
  }
});

// File browsing events
ipcMain.on('browse-playlist-file', (event) => {
  try {
    const result = dialog.showOpenDialogSync(settingsWindow, {
      title: 'Select Playlist File',
      filters: [
        { name: 'Playlists', extensions: ['m3u', 'm3u8'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result && result.length > 0) {
      event.reply('playlist-file-selected', { success: true, filePath: result[0] });
    } else {
      event.reply('playlist-file-selected', { success: false });
    }
  } catch (error) {
    event.reply('error', { component: 'file-dialog', message: error.message });
  }
});

ipcMain.on('browse-folder', (event) => {
  try {
    const result = dialog.showOpenDialogSync(settingsWindow, {
      title: 'Select Folder',
      properties: ['openDirectory']
    });
    
    if (result && result.length > 0) {
      event.reply('folder-selected', { success: true, folderPath: result[0] });
    } else {
      event.reply('folder-selected', { success: false });
    }
  } catch (error) {
    event.reply('error', { component: 'file-dialog', message: error.message });
  }
});

// Playlist management events
ipcMain.on('get-playlist-sources', (event) => {
  try {
    const sources = playlistManager.getSources();
    event.reply('playlist-sources-loaded', sources);
  } catch (error) {
    event.reply('error', { component: 'playlist', message: error.message });
  }
});

// Channel navigator events
ipcMain.on('load-channels', async (event) => {
  try {
    console.log('[IPC load-channels] Received request. Initializing player engine if needed.');
    
    // Ensure player engine is initialized
    if (!playerEngine.initialized) {
      console.log('[IPC load-channels] Player engine not initialized, initializing now.');
      await playerEngine.initialize();
    }
    
    console.log('[IPC load-channels] Calling playerEngine.getChannels().');
    const channels = await playerEngine.getChannels();
    
    if (!channels || !Array.isArray(channels)) {
      console.warn('[IPC load-channels] getChannels returned invalid data:', channels);
      event.reply('channels-loaded', []);
      console.log('[IPC load-channels] Replied with empty channels array due to invalid data.');
      return;
    }
    
    console.log(`[IPC load-channels] playerEngine.getChannels() returned ${channels.length} channels.`);
    
    // Send the channels back to the renderer
    event.reply('channels-loaded', channels);
    console.log('[IPC load-channels] Replied with channels-loaded.');
    
    // If we received no channels, try to update playlists in the background
    if (channels.length === 0) {
      console.log('[IPC load-channels] No channels found, triggering background playlist update.');
      try {
        playlistManager.updateAllPlaylists().then(result => {
          console.log(`[IPC] Background playlist update complete: ${result.success ? 'Success' : 'Failed'}`);
          
          if (result.success && result.channels > 0) {
            // Notify renderer that channels are available
            mainWindow.webContents.send('playlists-updated', { 
              success: true, 
              channels: result.channels 
            });
          }
        }).catch(err => {
          console.error('[IPC] Background playlist update error:', err);
        });
      } catch (updateError) {
        console.error('[IPC] Error starting background playlist update:', updateError);
      }
    }
  } catch (error) {
    console.error(`[IPC load-channels] Error: ${error.message}`, error);
    event.reply('error', { component: 'ipc-load-channels', message: error.message });
    console.log('[IPC load-channels] Replied with error.');
    
    // Return empty array as fallback
    event.reply('channels-loaded', []);
  }
});

// Player events
ipcMain.on('play-channel', async (event, channelId) => {
  try {
    const result = await playerEngine.playChannel(channelId);
    event.reply('channel-playing', result);
  } catch (error) {
    event.reply('error', { component: 'player', message: error.message });
  }
});

// Recording events
ipcMain.on('start-channel-recording', async (event, channelId) => {
  try {
    const result = await playerEngine.startRecording(channelId);
    event.reply('recording-started', result);
  } catch (error) {
    event.reply('error', { component: 'recording', message: error.message });
  }
});

ipcMain.on('stop-recording', async (event) => {
  try {
    await playerEngine.stopRecording();
    event.reply('recording-stopped');
  } catch (error) {
    event.reply('error', { component: 'recording', message: error.message });
  }
});

// EPG events
ipcMain.on('get-epg-config', async (event) => {
  try {
    const config = epgManager.loadConfig();
    event.reply('epg-config', config);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('add-epg-source', async (event, { url, name }) => {
  try {
    const result = epgManager.addSource(url, name);
    event.reply('epg-source-added', result);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('remove-epg-source', async (event, url) => {
  try {
    const result = epgManager.removeSource(url);
    event.reply('epg-source-removed', result);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('update-epg', async (event) => {
  try {
    const result = await epgManager.updateAllSources();
    event.reply('epg-updated', result);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('get-channel-programs', async (event, { channelId, count }) => {
  try {
    const programs = epgManager.getChannelPrograms(channelId, count);
    event.reply('channel-programs', programs);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('get-current-program', async (event, channelId) => {
  try {
    const program = epgManager.getCurrentProgram(channelId);
    event.reply('current-program', program);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('search-programs', async (event, { query, options }) => {
  try {
    const results = epgManager.searchPrograms(query, options);
    event.reply('program-search-results', results);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

// Scheduled recording events
// Handle request to open recording scheduler window
ipcMain.on('schedule-recording', () => {
  if (scheduleWindow) {
    scheduleWindow.focus();
  } else {
    createScheduleWindow();
  }
});

// Handle scheduled recording request from UI
ipcMain.on('schedule-recording-request', async (event, data) => {
  try {
    // Ensure scheduler is initialized before scheduling a recording
    if (!recordingScheduler.isInitialized) {
      await recordingScheduler.initialize();
    }
    
    // Data should contain channelId, startTime (ISO string), durationMinutes, and optional title
    const startTime = new Date(data.startTime);
    const result = await recordingScheduler.scheduleRecording(
      data.channelId,
      startTime,
      data.durationMinutes,
      data.title
    );
    event.reply('recording-scheduled', result);
  } catch (error) {
    event.reply('error', { component: 'scheduler', message: error.message });
  }
});

ipcMain.on('cancel-scheduled-recording', async (event, recordingId) => {
  try {
    // Ensure scheduler is initialized before cancelling a recording
    if (!recordingScheduler.isInitialized) {
      await recordingScheduler.initialize();
    }
    
    const result = recordingScheduler.cancelRecording(recordingId);
    event.reply('recording-cancelled', { success: result });
  } catch (error) {
    event.reply('error', { component: 'scheduler', message: error.message });
  }
});

ipcMain.on('get-scheduled-recordings', async (event) => {
  try {
    // Ensure scheduler is initialized before accessing recordings
    if (!recordingScheduler.isInitialized) {
      await recordingScheduler.initialize();
    }
    const recordings = recordingScheduler.getAllScheduledRecordings();
    event.reply('scheduled-recordings', recordings);
  } catch (error) {
    event.reply('error', { component: 'scheduler', message: error.message });
  }
});

// Playlist management events
ipcMain.on('add-playlist-source', async (event, source) => {
  try {
    const playlistValidator = require('./playlist-validator');
    const { logSourceChange } = require('./settings-logger');
    let validationResult;
    
    // Validate the playlist source
    if (source.type === 'remote') {
      validationResult = await playlistValidator.validatePlaylistUrl(source.url);
      if (!validationResult.valid) {
        logSourceChange(`Validation failed for remote playlist ${source.url}: ${validationResult.error}`, 'error');
        event.reply('playlist-source-added', { success: false, error: validationResult.error });
        return;
      }
      logSourceChange(`Validated remote playlist ${source.url}: ${validationResult.channelCount} channels found`, 'info');
    } else {
      validationResult = await playlistValidator.validatePlaylistFile(source.path);
      if (!validationResult.valid) {
        logSourceChange(`Validation failed for local playlist ${source.path}: ${validationResult.error}`, 'error');
        event.reply('playlist-source-added', { success: false, error: validationResult.error });
        return;
      }
      logSourceChange(`Validated local playlist ${source.path}: ${validationResult.channelCount} channels found`, 'info');
    }

    // If validation passed, add the source
    let result;
    if (source.type === 'remote') {
      result = await playlistManager.addRemoteSource(source.url, source.name);
    } else {
      result = await playlistManager.addLocalSource(source.path, source.name);
    }
    
    if (result.success) {
      logSourceChange(`Added new ${source.type} playlist source: ${source.name}`, 'info');
      await playlistManager.updateAllPlaylists();
      event.reply('playlist-source-added', { 
        success: true, 
        channelCount: validationResult.channelCount 
      });
    } else {
      logSourceChange(`Failed to add ${source.type} playlist source: ${result.error}`, 'error');
      event.reply('playlist-source-added', { success: false, error: result.error });
    }
  } catch (error) {
    logSourceChange(`Error adding playlist source: ${error.message}`, 'error');
    event.reply('error', { component: 'playlist', message: error.message });
  }
});

ipcMain.on('remove-playlist-source', async (event, source) => {
  try {
    const { logSourceChange } = require('./settings-logger');
    const result = await playlistManager.removeSource(source.type, source.index);
    
    if (result.success) {
      logSourceChange(`Removed ${source.type} playlist source at index ${source.index}`, 'info');
      await playlistManager.updateAllPlaylists();
      event.reply('playlist-source-removed', { success: true });
    } else {
      logSourceChange(`Failed to remove playlist source: ${result.error}`, 'error');
      event.reply('playlist-source-removed', { success: false, error: result.error });
    }
  } catch (error) {
    logSourceChange(`Error removing playlist source: ${error.message}`, 'error');
    event.reply('error', { component: 'playlist', message: error.message });
  }
});

ipcMain.on('toggle-playlist-source', async (event, data) => {
  try {
    const { logSourceChange } = require('./settings-logger');
    const sources = playlistManager.getSources();
    
    // Update the enabled status in the sources
    if (data.type === 'remote' && sources.remote[data.index]) {
      sources.remote[data.index].enabled = data.enabled;
    } else if (data.type === 'local' && sources.local[data.index]) {
      sources.local[data.index].enabled = data.enabled;
    } else {
      event.reply('playlist-source-toggled', { success: false, error: 'Source not found' });
      return;
    }
    
    // Save the updated sources
    const result = playlistManager.saveSources(sources);
    
    if (result) {
      const sourceName = data.type === 'remote' ? sources.remote[data.index].name : sources.local[data.index].name;
      logSourceChange(`${data.enabled ? 'Enabled' : 'Disabled'} ${data.type} playlist source: ${sourceName}`, 'info');
      
      // Update playlists if necessary
      if (data.enabled) {
        await playlistManager.updateAllPlaylists();
      }
      
      event.reply('playlist-source-toggled', { success: true });
    } else {
      logSourceChange('Failed to save playlist source state change', 'error');
      event.reply('playlist-source-toggled', { success: false, error: 'Failed to save changes' });
    }
  } catch (error) {
    logSourceChange(`Error toggling playlist source: ${error.message}`, 'error');
    event.reply('error', { component: 'playlist', message: error.message });
  }
});

ipcMain.on('update-playlists', async (event) => {
  console.log('[IPC update-playlists] Received request to update playlists');
  
  try {
    const result = await playlistManager.updateAllPlaylists();
    console.log(`[IPC update-playlists] Update result: ${JSON.stringify(result)}`);
    
    // Broadcast to all windows
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('playlists-updated', result);
    });
    
    // Reply to the specific sender
    event.reply('playlists-updated', result);
  } catch (error) {
    console.error(`[IPC update-playlists] Error: ${error.message}`, error);
    event.reply('error', { component: 'playlist-update', message: error.message });
  }
});

// Time-shifting events
ipcMain.on('pause-playback', (event) => {
  try {
    const result = playerEngine.pausePlayback();
    event.reply('playback-paused', result);
  } catch (error) {
    event.reply('error', { component: 'player', message: error.message });
  }
});

ipcMain.on('resume-playback', (event) => {
  try {
    const result = playerEngine.resumePlayback();
    event.reply('playback-resumed', result);
  } catch (error) {
    event.reply('error', { component: 'player', message: error.message });
  }
});

ipcMain.on('seek-playback', (event, seconds) => {
  try {
    const result = playerEngine.seekBuffer(seconds);
    event.reply('playback-seeked', result);
  } catch (error) {
    event.reply('error', { component: 'player', message: error.message });
  }
});

// Caption events
ipcMain.on('load-captions', async (event, { channelId, streamUrl }) => {
  try {
    const captionsInfo = await captionManager.fetchCaptions(streamUrl, channelId);
    if (captionsInfo) {
      const captions = await captionManager.loadCaptions(captionsInfo);
      event.reply('captions-loaded', { success: true, captions });
    } else {
      event.reply('captions-loaded', { success: false, error: 'No captions available' });
    }
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
  }
});

ipcMain.on('toggle-captions', (event) => {
  try {
    const settings = captionManager.settings;
    settings.enabled = !settings.enabled;
    const result = captionManager.updateSettings(settings);
    event.reply('captions-toggled', { enabled: settings.enabled, success: result });
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
  }
});

// Handler for getting caption settings
ipcMain.on('get-caption-settings', (event) => {
  try {
    const settings = captionManager.settings;
    event.reply('caption-settings', settings);
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
  }
});

// Handler for updating caption settings
ipcMain.on('update-caption-settings', (event, newSettings) => {
  try {
    const result = captionManager.updateSettings(newSettings);
    event.reply('caption-settings-updated', { success: result, settings: captionManager.settings });
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
  }
});

// Handler for enhancing caption with AI
ipcMain.on('enhance-caption', async (event, { text, mode }) => {
  try {
    const enhancedText = await captionManager.enhanceCaptionWithAI(text, mode);
    event.reply('caption-enhanced', { success: true, text: enhancedText });
  } catch (error) {
    event.reply('caption-enhanced', { success: false, error: error.message, text });
  }
});

// Casting events
ipcMain.on('get-casting-devices', async (event) => {
  try {
    const devices = castingManager.getDevices();
    event.reply('casting-devices', devices);
  } catch (error) {
    event.reply('error', { component: 'casting', message: error.message });
  }
});

ipcMain.on('refresh-casting-devices', async (event) => {
  try {
    const deviceCount = await castingManager.refreshDevices();
    const devices = castingManager.getDevices();
    event.reply('casting-devices-refreshed', { success: true, count: deviceCount, devices });
  } catch (error) {
    event.reply('error', { component: 'casting', message: error.message });
  }
});

ipcMain.on('cast-media', async (event, { deviceId, media }) => {
  try {
    const result = await castingManager.castMedia(deviceId, media);
    event.reply('media-cast', { success: true, ...result });
  } catch (error) {
    event.reply('error', { component: 'casting', message: error.message });
    event.reply('media-cast', { success: false, error: error.message });
  }
});

ipcMain.on('stop-casting', async (event) => {
  try {
    const result = await castingManager.stopCasting();
    event.reply('casting-stopped', result);
  } catch (error) {
    event.reply('error', { component: 'casting', message: error.message });
    event.reply('casting-stopped', { success: false, error: error.message });
  }
});

ipcMain.on('control-casting', async (event, { action, options }) => {
  try {
    const result = await castingManager.controlPlayback(action, options);
    event.reply('casting-controlled', { success: true, ...result });
  } catch (error) {
    event.reply('error', { component: 'casting', message: error.message });
    event.reply('casting-controlled', { success: false, error: error.message });
  }
});

ipcMain.on('get-casting-status', (event) => {
  try {
    const status = castingManager.getStatus();
    event.reply('casting-status', status);
  } catch (error) {
    event.reply('error', { component: 'casting', message: error.message });
    event.reply('casting-status', { success: false, error: error.message });
  }
});

// Recommendation events
ipcMain.on('get-recommendations', async (event, { currentChannelId }) => {
  try {
    // Get all channels from the player engine
    const allChannels = await playerEngine.getChannels();
    
    // Get recommendations
    const recommendations = recommendationEngine.getRecommendations(allChannels, currentChannelId);
    event.reply('recommendations', recommendations);
  } catch (error) {
    event.reply('error', { component: 'recommendations', message: error.message });
    event.reply('recommendations', []);
  }
});

ipcMain.on('get-viewing-history', (event, { limit }) => {
  try {
    const history = recommendationEngine.getViewingHistory(limit);
    event.reply('viewing-history', history);
  } catch (error) {
    event.reply('error', { component: 'recommendations', message: error.message });
    event.reply('viewing-history', []);
  }
});

ipcMain.on('get-top-watched-channels', (event, { limit }) => {
  try {
    const topChannels = recommendationEngine.getTopWatchedChannels(limit);
    event.reply('top-watched-channels', topChannels);
  } catch (error) {
    event.reply('error', { component: 'recommendations', message: error.message });
    event.reply('top-watched-channels', []);
  }
});

ipcMain.on('clear-viewing-history', async (event) => {
  try {
    const result = await recommendationEngine.clearHistory();
    event.reply('viewing-history-cleared', { success: result });
  } catch (error) {
    event.reply('error', { component: 'recommendations', message: error.message });
    event.reply('viewing-history-cleared', { success: false, error: error.message });
  }
});


// Add a check for updates IPC handler that doesn't require the renderer to know about the updater module
ipcMain.on('check-for-updates-manual', (event) => {
  try {
    event.reply('checking-for-updates');
    // The updater module has its own IPC handler that will be triggered
    // we just need to forward this command
    ipcMain.emit('check-for-updates');
  } catch (error) {
    event.reply('error', { component: 'updater', message: error.message });
  }
});

// Version info handler
ipcMain.on('get-version-info', (event) => {
  event.returnValue = {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  };
});

// Caption events
ipcMain.on('get-captions', async (event) => {
  try {
    const captions = await captionManager.getAllCaptions();
    event.reply('captions-loaded', captions);
  } catch (error) {
    event.reply('error', { component: 'caption', message: error.message });
  }
});

ipcMain.on('add-caption', async (event, { url, language }) => {
  try {
    const result = await captionManager.addCaption(url, language);
    event.reply('caption-added', result);
  } catch (error) {
    event.reply('error', { component: 'caption', message: error.message });
  }
});

ipcMain.on('remove-caption', async (event, id) => {
  try {
    const result = await captionManager.removeCaption(id);
    event.reply('caption-removed', result);
  } catch (error) {
    event.reply('error', { component: 'caption', message: error.message });
  }
});

ipcMain.on('update-caption', async (event, { id, url, language }) => {
  try {
    const result = await captionManager.updateCaption(id, url, language);
    event.reply('caption-updated', result);
  } catch (error) {
    event.reply('error', { component: 'caption', message: error.message });
  }
});

ipcMain.on('get-active-captions', (event) => {
  try {
    const activeCaptions = captionManager.getActiveCaptions();
    event.reply('active-captions', activeCaptions);
  } catch (error) {
    event.reply('error', { component: 'caption', message: error.message });
  }
});

ipcMain.on('set-active-captions', (event, captionIds) => {
  try {
    captionManager.setActiveCaptions(captionIds);
    event.reply('active-captions-set');
  } catch (error) {
    event.reply('error', { component: 'caption', message: error.message });
  }
});

// Modernization Settings events
ipcMain.on('get-modernization-settings', (event) => {
  try {
    // Get settings from config manager
    const allSettings = config.getAll();
    const modernizationSettings = allSettings.modernization || {};
    
    event.reply('modernization-settings', modernizationSettings);
  } catch (error) {
    log.error('Error getting modernization settings:', error);
    event.reply('error', { component: 'settings', message: error.message });
  }
});

ipcMain.on('save-modernization-settings', (event, settings) => {
  try {
    // Save settings to config manager
    const allSettings = config.getAll();
    allSettings.modernization = settings;
    config.setAll(allSettings);
    
    // Apply settings to components
    if (settings.casting) {
      castingManager.updateSettings(settings.casting);
    }
    
    if (settings.recommendations) {
      recommendationEngine.updateSettings(settings.recommendations);
    }
    
    event.reply('modernization-settings-saved', { success: true });
  } catch (error) {
    log.error('Error saving modernization settings:', error);
    event.reply('error', { component: 'settings', message: error.message });
    event.reply('modernization-settings-saved', { success: false, error: error.message });
  }
});

ipcMain.on('test-casting', async (event) => {
  try {
    // Attempt to discover devices
    const deviceCount = await castingManager.refreshDevices();
    
    if (deviceCount > 0) {
      event.reply('casting-test-result', { 
        success: true, 
        message: `Found ${deviceCount} casting device(s)` 
      });
    } else {
      event.reply('casting-test-result', { 
        success: false, 
        error: 'No casting devices found on network' 
      });
    }
  } catch (error) {
    log.error('Error testing casting:', error);
    event.reply('error', { component: 'casting', message: error.message });
    event.reply('casting-test-result', { success: false, error: error.message });
  }
});

ipcMain.on('clear-casting-cache', (event) => {
  try {
    castingManager.clearDeviceCache();
    event.reply('casting-cache-cleared', { success: true });
  } catch (error) {
    log.error('Error clearing casting cache:', error);
    event.reply('error', { component: 'casting', message: error.message });
    event.reply('casting-cache-cleared', { success: false, error: error.message });
  }
});

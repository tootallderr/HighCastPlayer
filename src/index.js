/**
 * IPTV Player Main Process
 * 
 * This is the entry point for the Electron application.
 */

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const dependencyCheck = require('./dependency-check');
const platform = require('./platform');
const playlistManager = require('./playlist-manager');
const playerEngine = require('./player-engine');
const recordingScheduler = require('./recording-scheduler');
const epgManager = require('./epg-manager');
const captionManager = require('./caption-manager');
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
    protocol: 'file:',
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
    protocol: 'file:',
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
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'IPTV Player',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: !isDev,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../ui/index.html'),
    protocol: 'file:',
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
    if (splashWindow) {
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
            mainWindow.webContents.send('show-add-playlist-dialog');
          }
        },
        {
          label: 'Settings',
          click: () => {
            mainWindow.webContents.send('show-settings');
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
      dialog.showErrorBox(
        'Dependency Check Failed',
        `Missing required dependencies: ${dependencyResult.criticalIssues} critical issues found.
        Please check the log file for more details.`
      );
      if (!isDev) {
        app.quit();
        return;
      }
    }    // Initialize player engine
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
          .catch(err => console.error('EPG update error:', err));
      }
    } catch (epgError) {
      console.error('EPG initialization error:', epgError);
      // Non-critical error, continue app startup
    }
    
    // Create the main window once initialization is complete
    createMainWindow();
  } catch (error) {
    console.error('Initialization error:', error);
    dialog.showErrorBox(
      'Initialization Failed', 
      `Failed to initialize application: ${error.message}`
    );
    
    if (!isDev) {
      app.quit();
    }
  }
}

// Application event handlers
app.on('ready', () => {
  createSplashWindow();
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
    const channels = await playerEngine.getChannels();
    event.reply('channels-loaded', channels);
  } catch (error) {
    event.reply('error', { component: 'channel-navigator', message: error.message });
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
    const result = recordingScheduler.cancelRecording(recordingId);
    event.reply('recording-cancelled', { success: result });
  } catch (error) {
    event.reply('error', { component: 'scheduler', message: error.message });
  }
});

ipcMain.on('get-scheduled-recordings', (event) => {
  try {
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
  try {
    const { logSourceChange } = require('./settings-logger');
    logSourceChange('Manual playlist update triggered', 'info');
    
    const result = await playlistManager.updateAllPlaylists();
    
    if (result.success) {
      logSourceChange(`Successfully updated playlists: ${result.playlistCount} playlists, ${result.channels} channels`, 'info');
      event.reply('playlists-updated', { success: true });
    } else {
      logSourceChange(`Failed to update playlists: ${result.error}`, 'error');
      event.reply('playlists-updated', { success: false, error: result.error });
    }
  } catch (error) {
    logSourceChange(`Error updating playlists: ${error.message}`, 'error');
    event.reply('error', { component: 'playlist', message: error.message });
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
    event.reply('captions-toggled', { enabled: settings.enabled, ...result });
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
  }
});

ipcMain.on('get-caption-settings', (event) => {
  try {
    const settings = captionManager.settings;
    event.reply('caption-settings', settings);
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
  }
});

ipcMain.on('update-caption-settings', (event, settings) => {
  try {
    const result = captionManager.updateSettings(settings);
    event.reply('caption-settings-updated', result);
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
  }
});

ipcMain.on('enhance-caption', async (event, { text, mode }) => {
  try {
    const enhancedText = await captionManager.enhanceCaptionWithAI(text, mode);
    event.reply('caption-enhanced', { success: true, text: enhancedText });
  } catch (error) {
    event.reply('error', { component: 'captions', message: error.message });
    // Return the original text as a fallback
    event.reply('caption-enhanced', { success: false, text });
  }
});

// Playback info event - for metadata overlay
ipcMain.on('get-playback-info', async (event) => {
  try {
    const info = playerEngine.getPlaybackInfo();
    event.reply('playback-info', info);
  } catch (error) {
    event.reply('error', { component: 'player', message: error.message });
  }
});

// EPG management events
ipcMain.on('get-epg-config', (event) => {
  try {
    const epgConfig = epgManager.loadConfig();
    event.reply('epg-config', epgConfig);
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('add-epg-source', async (event, source) => {
  try {
    const { logSettingsChange } = require('./settings-logger');
    
    // Validate source URL
    let isValid;
    try {
      new URL(source.url);
      isValid = true;
    } catch (e) {
      isValid = false;
    }
    
    if (!isValid) {
      logSettingsChange(`Invalid EPG source URL: ${source.url}`, 'error');
      event.reply('epg-source-added', { success: false, error: 'Invalid URL format' });
      return;
    }
    
    // Add the source
    const result = epgManager.addSource(source.url, source.name);
    
    if (result) {
      logSettingsChange(`Added new EPG source: ${source.name} (${source.url})`, 'info');
      
      // Update EPG data
      try {
        await epgManager.updateAllSources();
        logSettingsChange(`Updated EPG data from ${source.name}`, 'info');
      } catch (updateError) {
        logSettingsChange(`Added EPG source but failed to update: ${updateError.message}`, 'warn');
      }
      
      event.reply('epg-source-added', { success: true });
    } else {
      logSettingsChange(`Failed to add EPG source: ${source.name} (${source.url})`, 'error');
      event.reply('epg-source-added', { success: false, error: 'Failed to add source, maybe it already exists?' });
    }
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('remove-epg-source', (event, url) => {
  try {
    const { logSettingsChange } = require('./settings-logger');
    const result = epgManager.removeSource(url);
    
    if (result) {
      logSettingsChange(`Removed EPG source: ${url}`, 'info');
      event.reply('epg-source-removed', { success: true });
    } else {
      logSettingsChange(`Failed to remove EPG source: ${url}`, 'error');
      event.reply('epg-source-removed', { success: false, error: 'Source not found' });
    }
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('update-epg', async (event) => {
  try {
    const { logSettingsChange } = require('./settings-logger');
    logSettingsChange('Manual EPG update triggered', 'info');
    
    const result = await epgManager.updateAllSources();
    
    if (result) {
      logSettingsChange('Successfully updated EPG data', 'info');
      event.reply('epg-updated', { success: true });
    } else {
      logSettingsChange('Failed to update EPG data', 'error');
      event.reply('epg-updated', { success: false, error: 'Update failed' });
    }
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

ipcMain.on('toggle-epg-source', (event, data) => {
  try {
    const { logSettingsChange } = require('./settings-logger');
    const epgConfig = epgManager.loadConfig();
    
    // Find the source
    const sourceIndex = epgConfig.sources.findIndex(s => s.url === data.url);
    if (sourceIndex === -1) {
      logSettingsChange(`Failed to toggle EPG source: ${data.url} not found`, 'error');
      event.reply('epg-source-toggled', { success: false, error: 'Source not found' });
      return;
    }
    
    // Update enabled status
    epgConfig.sources[sourceIndex].enabled = data.enabled;
    
    // Save config
    const result = epgManager.saveConfig(epgConfig);
    
    if (result) {
      logSettingsChange(`${data.enabled ? 'Enabled' : 'Disabled'} EPG source: ${epgConfig.sources[sourceIndex].name || epgConfig.sources[sourceIndex].url}`, 'info');
      
      // Update EPG data if necessary
      if (data.enabled) {
        epgManager.updateAllSources().catch(err => {
          logSettingsChange(`Error updating EPG after enabling source: ${err.message}`, 'error');
        });
      }
      
      event.reply('epg-source-toggled', { success: true });
    } else {
      logSettingsChange('Failed to save EPG source state change', 'error');
      event.reply('epg-source-toggled', { success: false, error: 'Failed to save changes' });
    }
  } catch (error) {
    event.reply('error', { component: 'epg', message: error.message });
  }
});

// Auto-start handlers
ipcMain.on('get-auto-start-status', (event) => {
  try {
    const status = autoStart.isAutoStartEnabled();
    event.reply('auto-start-status', { enabled: status });
  } catch (error) {
    event.reply('error', { component: 'auto-start', message: error.message });
  }
});

ipcMain.on('toggle-auto-start', (event, enable) => {
  try {
    const result = autoStart.configureAutoStart(enable);
    event.reply('auto-start-toggled', { 
      success: result, 
      enabled: enable 
    });
    
    if (result) {
      logSettingsChange(`${enable ? 'Enabled' : 'Disabled'} auto-start at login`, 'info');
    } else {
      logSettingsChange(`Failed to ${enable ? 'enable' : 'disable'} auto-start at login`, 'error');
    }
  } catch (error) {
    event.reply('error', { component: 'auto-start', message: error.message });
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

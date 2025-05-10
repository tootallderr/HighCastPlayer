/**
 * Auto-Update Manager
 * 
 * This module handles automatic updates for the IPTV Player.
 * It checks for new versions and manages the download and installation process.
 */

const { app, dialog, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'info';
autoUpdater.logger = log;

// Server URL will be configured in electron-builder.json through the publish configuration
// If you need to override it in code, you can do so in the setupAutoUpdater method

class Updater {
  constructor() {
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.mainWindow = null;
    this.setupAutoUpdater();
    
    // Check at startup after a delay (allow app to fully launch first)
    setTimeout(() => {
      if (!isDev) {
        this.checkForUpdates();
      }
    }, 10000); // 10 second delay
    
    // Schedule periodic checks
    setInterval(() => {
      if (!isDev) {
        this.checkForUpdates(true); // silent check
      }
    }, 1000 * 60 * 60); // Check every hour
  }
  
  /**
   * Set the main application window
   * @param {BrowserWindow} window - Main application window
   */
  setMainWindow(window) {
    this.mainWindow = window;
  }
  
  /**
   * Setup event handlers for the auto updater
   */  setupAutoUpdater() {
    // Configure electron-updater
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
      // Set custom URL (optional - by default it will use the URL from electron-builder.json)
    const SERVER_URL = process.env.UPDATE_SERVER_URL || 'https://update.iptvplayer.example.com';
    if (SERVER_URL !== 'https://update.iptvplayer.example.com') {
      const options = {
        provider: 'generic',
        url: SERVER_URL
      };
      autoUpdater.setFeedURL(options);
    }
    
    // Handle update availability
    autoUpdater.on('update-available', () => {
      log.info('Update available');
      this.updateAvailable = true;
      this.notifyUpdateAvailable();
    });
    
    // Handle no updates available
    autoUpdater.on('update-not-available', () => {
      log.info('No updates available');
      this.updateAvailable = false;
    });
    
    // Handle update download completion
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      log.info('Update downloaded', { releaseName });
      this.updateDownloaded = true;
      this.notifyUpdateReady(releaseName);
    });
    
    // Handle update errors
    autoUpdater.on('error', (error) => {
      log.error('Update error', error);
    });
    
    // Setup IPC handlers for communicating with renderer
    ipcMain.on('check-for-updates', (event) => {
      this.checkForUpdates();
    });
    
    ipcMain.on('install-update', () => {
      if (this.updateDownloaded) {
        autoUpdater.quitAndInstall();
      }
    });
  }
  
  /**
   * Check for updates
   * @param {boolean} silent - Whether to check silently (no UI notifications for no updates)
   */
  checkForUpdates(silent = false) {
    if (isDev) {
      log.info('Update checking disabled in development mode');
      return;
    }
    
    log.info('Checking for updates...');
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('Failed to check for updates', error);
      if (!silent) {
        dialog.showErrorBox('Update Error', 'Failed to check for updates. Please try again later.');
      }
    }
  }
  
  /**
   * Notify the user about an available update
   */
  notifyUpdateAvailable() {
    if (!this.mainWindow) return;
    
    this.mainWindow.webContents.send('update-available');
    
    // Also show a system dialog
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version of IPTV Player is available!',
      detail: 'The update is being downloaded now. You will be notified when it is ready to install.',
      buttons: ['OK']
    });
  }
  
  /**
   * Notify the user that an update is ready to install
   * @param {string} releaseName - The name/version of the release
   */
  notifyUpdateReady(releaseName) {
    if (!this.mainWindow) return;
    
    this.mainWindow.webContents.send('update-ready');
    
    // Show a system dialog with install option
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `IPTV Player ${releaseName} is ready to install!`,
      detail: 'The update will be installed when you restart the application.',
      buttons: ['Install and Restart', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
}

module.exports = new Updater();

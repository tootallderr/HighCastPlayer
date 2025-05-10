/**
 * Path Manager
 * 
 * Centralized path handling for IPTV Player
 * This module provides consistent path management across development and production environments
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const platform = require('./platform');

/**
 * Determine if the application is running in development or production mode
 * @returns {boolean} True if running in development mode
 */
function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development' || !app || !app.isPackaged;
}

/**
 * Get the application's root path that works in both development and production
 * @returns {string} The root path of the application
 */
function getAppRootPath() {
  // In development
  if (isDevelopmentMode()) {
    return path.join(__dirname, '..');
  }
  
  // In production, handle asar packaging
  return process.env.PORTABLE_EXECUTABLE_DIR || 
         (app && app.getAppPath().replace(/app\.asar$/, '')) || 
         (app && path.join(app.getPath('userData')));
}

/**
 * Get the user data directory path
 * @returns {string} Path to the user data directory
 */
function getUserDataPath() {
  if (app && app.getPath) {
    return app.getPath('userData');
  } else {
    // If app is not available (e.g., running in tests), use platform utility
    return platform.getAppDataPath();
  }
}

/**
 * Ensure a directory exists
 * @param {string} dirPath - The directory path to ensure
 * @returns {string} The directory path
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
    }
  }
  return dirPath;
}

/**
 * Get the path to data directory
 * @returns {string} Path to the data directory
 */
function getDataDir() {
  const userDataPath = getUserDataPath();
  const dataDir = path.join(userDataPath, 'data');
  return ensureDir(dataDir);
}

/**
 * Get the path to playlists directory
 * @returns {string} Path to the playlists directory
 */
function getPlaylistsDir() {
  const dataDir = getDataDir();
  const playlistsDir = path.join(dataDir, 'playlists');
  return ensureDir(playlistsDir);
}

/**
 * Get the path to recordings directory
 * @returns {string} Path to the recordings directory
 */
function getRecordingsDir() {
  const dataDir = getDataDir();
  const recordingsDir = path.join(dataDir, 'recordings');
  return ensureDir(recordingsDir);
}

/**
 * Get the path to logs directory
 * @returns {string} Path to the logs directory
 */
function getLogsDir() {
  const userDataPath = getUserDataPath();
  const logsDir = path.join(userDataPath, 'logs');
  return ensureDir(logsDir);
}

/**
 * Get the path to settings.json
 * @returns {string} Path to settings.json
 */
function getSettingsPath() {
  const dataDir = getDataDir();
  return path.join(dataDir, 'settings.json');
}

/**
 * Get the path to sources.json
 * @returns {string} Path to sources.json
 */
function getSourcesPath() {
  const dataDir = getDataDir();
  return path.join(dataDir, 'sources.json');
}

/**
 * Get the path to merged playlist
 * @returns {string} Path to merged playlist
 */
function getMergedPlaylistPath() {
  const playlistsDir = getPlaylistsDir();
  return path.join(playlistsDir, 'merged-playlist.m3u8');
}

/**
 * Get path to a log file
 * @param {string} name - Log file name
 * @returns {string} Path to the log file
 */
function getLogPath(name) {
  const logsDir = getLogsDir();
  return path.join(logsDir, name);
}

/**
 * Get the path to cache directory
 * @returns {string} Path to the cache directory
 */
function getCacheDir() {
  const userDataPath = getUserDataPath();
  const cacheDir = path.join(userDataPath, 'cache');
  return ensureDir(cacheDir);
}

// Export all functions
module.exports = {
  isDevelopmentMode,
  getAppRootPath,
  getUserDataPath,
  getDataDir,
  getPlaylistsDir,
  getRecordingsDir,
  getCacheDir,
  getLogsDir,
  getSettingsPath,
  getSourcesPath,
  getMergedPlaylistPath,
  getLogPath,
  ensureDir
};
/**
 * IPTV Player Configuration Manager
 * 
 * This module manages application settings and configuration.
 */

const fs = require('fs');
const path = require('path');
const platform = require('./platform');

// Define paths
const CONFIG_DIR = path.join(platform.getAppDataPath());
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');
const DEFAULT_CONFIG = {
  player: {
    volume: 1.0,
    muted: false,
    autoplay: true,
    bufferLength: 30, // seconds
    useHardwareAcceleration: true,
  },
  playlists: {
    updateInterval: 60, // minutes
  },
  recordings: {
    format: 'mp4',
    quality: 'original',
    folder: path.join(platform.getAppDataPath(), 'recordings'),
  },
  ui: {
    theme: 'dark',
    language: 'en',
    showNotifications: true,
  }
};

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  } catch (error) {
    console.error(`Error creating config directory: ${error.message}`);
  }
}

// Ensure recordings directory exists
if (!fs.existsSync(DEFAULT_CONFIG.recordings.folder)) {
  try {
    fs.mkdirSync(DEFAULT_CONFIG.recordings.folder, { recursive: true });
  } catch (error) {
    console.error(`Error creating recordings directory: ${error.message}`);
  }
}

/**
 * Load configuration from file or create with defaults
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      // Merge with defaults to ensure all required fields are present
      return { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
    }
  } catch (error) {
    console.error(`Error reading config file: ${error.message}`);
  }
  
  // Create default config if loading fails
  saveConfig(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(config, null, 2),
      'utf8'
    );
    return true;
  } catch (error) {
    console.error(`Error writing config file: ${error.message}`);
    return false;
  }
}

// Load config on module import
let config = loadConfig();

/**
 * Get a configuration value by key path
 * @param {string} keyPath - Dot-notation path to the setting (e.g., 'player.volume')
 * @param {any} defaultValue - Default value if not found
 */
function get(keyPath, defaultValue = null) {
  const keys = keyPath.split('.');
  let value = config;
  
  for (const key of keys) {
    if (value === undefined || value === null || !Object.prototype.hasOwnProperty.call(value, key)) {
      return defaultValue;
    }
    value = value[key];
  }
  
  return value !== undefined ? value : defaultValue;
}

/**
 * Set a configuration value by key path
 * @param {string} keyPath - Dot-notation path to the setting (e.g., 'player.volume')
 * @param {any} value - Value to set
 */
function set(keyPath, value) {
  const keys = keyPath.split('.');
  const lastKey = keys.pop();
  let obj = config;
  
  // Navigate to the right object
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = {};
    }
    obj = obj[key];
  }
  
  // Set value
  obj[lastKey] = value;
  
  // Save updated config
  return saveConfig(config);
}

/**
 * Reset configuration to defaults
 */
function reset() {
  config = { ...DEFAULT_CONFIG };
  return saveConfig(config);
}

module.exports = {
  get,
  set,
  reset,
  getAll: () => ({ ...config }),
  setAll: (newConfig) => {
    config = { ...DEFAULT_CONFIG, ...newConfig };
    return saveConfig(config);
  }
};

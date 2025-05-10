/**
 * IPTV Player Configuration Manager
 * 
 * This module manages application settings and configuration.
 */

const fs = require('fs');
const path = require('path');
const platform = require('./platform');
const pathManager = require('./path-manager');

// Use centralized path management
const CONFIG_DIR = pathManager.getDataDir();
const CONFIG_FILE = pathManager.getSettingsPath();
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
    autoMerge: true
  },
  recordings: {
    format: 'mp4',
    quality: 'original',
    folder: pathManager.getRecordingsDir(),
  },
  ui: {
    theme: 'dark',
    language: 'en',
    showNotifications: true,
  }
};

// Path manager already ensures config directory exists

/**
 * Load configuration from file or create with defaults
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      
      try {
        // Parse the config file
        const config = JSON.parse(configData);
        
        // Check if the config is empty (just {})
        if (Object.keys(config).length === 0) {
          console.log('Config file exists but is empty, using default configuration');
          saveConfig(DEFAULT_CONFIG);
          return DEFAULT_CONFIG;
        }
        
        // Deep merge with defaults to ensure all properties exist
        const mergedConfig = deepMerge(DEFAULT_CONFIG, config);
        return mergedConfig;
      } catch (parseError) {
        console.error(`Error parsing config file: ${parseError.message}`);
        console.log('Using default configuration');
        saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }
    } else {
      console.log('Config file does not exist, creating with defaults');
      saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const output = Object.assign({}, target);
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 * @param {any} item - Value to check
 * @returns {boolean} True if object
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
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

/**
 * IPTV Player Settings Logger
 * 
 * This module logs settings changes and playlist source modifications
 * to maintain an audit trail of configuration changes.
 */

const fs = require('fs');
const path = require('path');

// Define log file paths
const SETTINGS_LOG_FILE = path.join(__dirname, '..', 'tests', 'settings.log');
const SOURCES_LOG_FILE = path.join(__dirname, '..', 'tests', 'sources.log');

// Ensure log directory exists
const logDir = path.dirname(SETTINGS_LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Log settings change to settings.log
 * @param {string} message - Description of the settings change
 * @param {string} level - Log level: 'info', 'warn', 'error'
 */
function logSettingsChange(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(SETTINGS_LOG_FILE, formattedMessage);
    
    // Also output to console if not in production
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Settings] ${message}`);
    }
}

/**
 * Log playlist source change to sources.log
 * @param {string} message - Description of the playlist source change
 * @param {string} level - Log level: 'info', 'warn', 'error'
 */
function logSourceChange(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(SOURCES_LOG_FILE, formattedMessage);
    
    // Also output to console if not in production
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Sources] ${message}`);
    }
}

module.exports = {
    logSettingsChange,
    logSourceChange
};
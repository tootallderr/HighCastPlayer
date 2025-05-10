/**
 * IPTV Player Settings Logger
 * 
 * This module logs settings changes and playlist source modifications
 * to maintain an audit trail of configuration changes.
 * 
 * Can also be run directly as a utility for viewing or managing logs.
 */

const fs = require('fs');
const path = require('path');

// Try to use the path manager if available
let SETTINGS_LOG_FILE, SOURCES_LOG_FILE, logDir;

function initializePaths() {
    try {
        // Check if we're in Electron environment
        let electronApp;
        try {
            electronApp = require('electron').app;
        } catch (e) {
            // Not in Electron - will use fallback paths
            console.log('Not running in Electron environment, using fallback paths');
        }
        
        // Use the path manager if available (it properly handles dev vs. production paths)
        let logsDir;
        try {
            const pathManager = require('./path-manager');
            logsDir = pathManager.getLogsDir();
            console.log(`Using path manager logs directory: ${logsDir}`);
        } catch (error) {
            console.log(`Path manager not available: ${error.message}`);
            // Fallback if path manager isn't available
            if (electronApp && electronApp.getPath) {
                // We're in Electron but path-manager failed
                const userDataDir = electronApp.getPath('userData');
                logsDir = path.join(userDataDir, 'logs');
                console.log(`Using Electron user data logs directory: ${logsDir}`);
            } else {
                // We're not in Electron, use OS-specific paths
                if (process.platform === 'win32') {
                    logsDir = path.join(process.env.APPDATA, 'iptv-player', 'logs');
                } else if (process.platform === 'darwin') {
                    logsDir = path.join(process.env.HOME, 'Library', 'Application Support', 'iptv-player', 'logs');
                } else {
                    // Linux and others
                    logsDir = path.join(process.env.HOME, '.iptv-player', 'logs');
                }
                console.log(`Using OS-specific logs directory: ${logsDir}`);
            }
        }
        
        // Ensure log directory exists
        if (!fs.existsSync(logsDir)) {
            console.log(`Creating logs directory: ${logsDir}`);
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        SETTINGS_LOG_FILE = path.join(logsDir, 'settings.log');
        SOURCES_LOG_FILE = path.join(logsDir, 'sources.log');
        logDir = logsDir;
        
        console.log(`Settings log file: ${SETTINGS_LOG_FILE}`);
        console.log(`Sources log file: ${SOURCES_LOG_FILE}`);
        
        // Create empty log files if they don't exist
        if (!fs.existsSync(SETTINGS_LOG_FILE)) {
            console.log(`Creating settings log file: ${SETTINGS_LOG_FILE}`);
            fs.writeFileSync(SETTINGS_LOG_FILE, '# Settings Log File\n', 'utf8');
        }
        
        if (!fs.existsSync(SOURCES_LOG_FILE)) {
            console.log(`Creating sources log file: ${SOURCES_LOG_FILE}`);
            fs.writeFileSync(SOURCES_LOG_FILE, '# Playlist Sources Log File\n', 'utf8');
        }
        
        return true;
    } catch (error) {
        console.error(`Failed to initialize log paths: ${error.message}`);
        
        // Last resort fallback
        const fallbackDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(fallbackDir)) {
            fs.mkdirSync(fallbackDir, { recursive: true });
        }
        
        SETTINGS_LOG_FILE = path.join(fallbackDir, 'settings.log');
        SOURCES_LOG_FILE = path.join(fallbackDir, 'sources.log');
        logDir = fallbackDir;
        
        return false;
    }
}

// Initialize paths when the module is loaded
initializePaths();

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

/**
 * Display log file contents
 * @param {string} filePath - Path to the log file
 * @param {number} lines - Number of lines to display from the end
 */
function displayLogFile(filePath, lines = 10) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`Log file not found: ${filePath}`);
            return;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const allLines = content.split('\n');
        const lastLines = allLines.slice(Math.max(allLines.length - lines - 1, 0));
        
        console.log(lastLines.join('\n'));
    } catch (error) {
        console.error(`Error reading log file ${filePath}: ${error.message}`);
    }
}

/**
 * Clear a log file
 * @param {string} filePath - Path to the log file
 */
function clearLogFile(filePath) {
    try {
        fs.writeFileSync(filePath, '', 'utf8');
        return true;
    } catch (error) {
        console.error(`Error clearing log file ${filePath}: ${error.message}`);
        return false;
    }
}

// Add these functions to the exports
module.exports.displayLogFile = displayLogFile;
module.exports.clearLogFile = clearLogFile;
module.exports.SETTINGS_LOG_FILE = SETTINGS_LOG_FILE;
module.exports.SOURCES_LOG_FILE = SOURCES_LOG_FILE;
module.exports.initializePaths = initializePaths;

/**
 * Display help information for CLI usage
 */
function displayHelp() {
    console.log('IPTV Player Settings Logger Utility');
    console.log('-----------------------------------');
    console.log('Commands:');
    console.log('  view-settings   - Display settings log');
    console.log('  view-sources    - Display playlist sources log');
    console.log('  clear-settings  - Clear settings log');
    console.log('  clear-sources   - Clear playlist sources log');
    console.log('  paths           - Display log file paths');
    console.log('  help            - Display this help message');
    console.log('\nExample: node settings-logger.js view-settings');
}

// If this file is run directly, provide some sample logging to test functionality
if (require.main === module) {
    // Re-initialize paths to make sure they're correct when running directly
    initializePaths();
    
    // Check for command line arguments
    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();
      console.log('IPTV Player Settings Logger - Utility Mode');
    
    switch (command) {
        case 'view-settings':
            const settingsLineCount = parseInt(args[1]) || 50;
            console.log(`\nSettings log (last ${settingsLineCount} lines):`);
            console.log('-'.repeat(50));
            displayLogFile(SETTINGS_LOG_FILE, settingsLineCount);
            break;
            
        case 'view-sources':
            const sourcesLineCount = parseInt(args[1]) || 50;
            console.log(`\nSources log (last ${sourcesLineCount} lines):`);
            console.log('-'.repeat(50));
            displayLogFile(SOURCES_LOG_FILE, sourcesLineCount);
            break;
            
        case 'clear-settings':
            if (clearLogFile(SETTINGS_LOG_FILE)) {
                console.log(`✓ Settings log cleared: ${SETTINGS_LOG_FILE}`);
            }
            break;
            
        case 'clear-sources':
            if (clearLogFile(SOURCES_LOG_FILE)) {
                console.log(`✓ Sources log cleared: ${SOURCES_LOG_FILE}`);
            }
            break;
            
        case 'paths':
            console.log(`Log files:\n- Settings log: ${SETTINGS_LOG_FILE}\n- Sources log: ${SOURCES_LOG_FILE}`);
            break;
            
        case 'help':
            displayHelp();
            break;
            
        case 'test':
            // Log test messages
            logSettingsChange('Test settings log entry from command line', 'info');
            console.log(`✓ Written test entry to settings log: ${SETTINGS_LOG_FILE}`);
            
            logSourceChange('Test sources log entry from command line', 'info');
            console.log(`✓ Written test entry to sources log: ${SOURCES_LOG_FILE}`);
            break;
            
        default:
            console.log('No valid command provided.');
            displayHelp();
        
        // Log a test message for sources
        logSourceChange('Test sources log entry from command line', 'info');
        console.log(`✓ Written test entry to sources log: ${SOURCES_LOG_FILE}`);
        
        // Display the file contents
        console.log(`\nSettings log (last 5 lines):`);
        console.log('-'.repeat(50));
        displayLogFile(SETTINGS_LOG_FILE, 5);
        
        console.log(`\nSources log (last 5 lines):`);
        console.log('-'.repeat(50));
        displayLogFile(SOURCES_LOG_FILE, 5);
        
        console.log('\nUsage:');
        console.log('  node settings-logger.js           - Test logging with sample entries');
        console.log('  node settings-logger.js view [n]  - View last n lines of logs (default: 10)');
        console.log('  node settings-logger.js clear     - Clear all logs');
    }
}
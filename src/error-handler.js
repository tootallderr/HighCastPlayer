/**
 * Global Error Handler
 * 
 * This module provides centralized error handling for the IPTV Player application.
 * It captures uncaught exceptions and unhandled promise rejections to prevent crashes.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Try to use path manager if available
let LOGS_DIR;
let ERROR_LOG_FILE;

// Set up log file paths
function initializePaths() {
    try {
        // Check if we're in Electron environment
        let electronApp;
        try {
            electronApp = require('electron').app;
        } catch (e) {
            // Not in Electron
        }
        
        // Use the path manager if available
        let logsDir;
        try {
            const pathManager = require('./path-manager');
            logsDir = pathManager.getLogsDir();
        } catch (error) {
            // Fallback if path manager isn't available
            if (electronApp && electronApp.getPath) {
                // We're in Electron but path-manager failed
                const userDataDir = electronApp.getPath('userData');
                logsDir = path.join(userDataDir, 'logs');
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
            }
        }
        
        // Ensure log directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        LOGS_DIR = logsDir;
        ERROR_LOG_FILE = path.join(LOGS_DIR, 'uncaught-errors.log');
        
        // Create log file if it doesn't exist
        if (!fs.existsSync(ERROR_LOG_FILE)) {
            fs.writeFileSync(ERROR_LOG_FILE, '# Uncaught Errors Log\n', 'utf8');
        }
        
        return true;
    } catch (error) {
        console.error(`Failed to initialize error logger paths: ${error.message}`);
        
        // Last resort fallback
        const fallbackDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(fallbackDir)) {
            fs.mkdirSync(fallbackDir, { recursive: true });
        }
        
        LOGS_DIR = fallbackDir;
        ERROR_LOG_FILE = path.join(LOGS_DIR, 'uncaught-errors.log');
        
        return false;
    }
}

// Initialize paths
initializePaths();

/**
 * Log an error to the error log file
 * @param {Error} error - The error to log
 * @param {string} source - Source of the error (uncaughtException, unhandledRejection, etc.)
 */
function logError(error, source) {
    const timestamp = new Date().toISOString();
    const errorMessage = error.message || 'Unknown error';
    const errorStack = error.stack || '';
    
    const logEntry = `[${timestamp}] [${source}] ${errorMessage}\n${errorStack}\n\n`;
    
    try {
        fs.appendFileSync(ERROR_LOG_FILE, logEntry);
        console.error(`[${source}] ${errorMessage}`);
    } catch (writeError) {
        // If we can't write to the file, at least log to console
        console.error(`[ERROR LOGGER FAILED] ${writeError.message}`);
        console.error(`[${source}] ${errorMessage}`);
        console.error(errorStack);
    }
}

/**
 * Set up global error handlers
 */
function setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        logError(error, 'UNCAUGHT_EXCEPTION');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (error) => {
        logError(error, 'UNHANDLED_REJECTION');
    });
    
    // Handle Electron app errors if in Electron environment
    if (app && typeof app.on === 'function') {
        app.on('render-process-gone', (event, webContents, details) => {
            const error = new Error(`Render process crashed: ${details.reason}`);
            logError(error, 'RENDER_PROCESS_GONE');
        });
        
        app.on('child-process-gone', (event, details) => {
            const error = new Error(`Child process crashed: ${details.type} - ${details.reason}`);
            logError(error, 'CHILD_PROCESS_GONE');
        });
    }
    
    console.log('Global error handlers set up');
}

// Export the functions
module.exports = {
    setupGlobalErrorHandlers,
    logError
};

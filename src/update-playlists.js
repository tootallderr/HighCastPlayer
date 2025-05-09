#!/usr/bin/env node

/**
 * Update Playlists Script
 * 
 * This script is designed to be run by the system scheduler (Task Scheduler or cron)
 * to periodically update IPTV playlists.
 */

const path = require('path');
const fs = require('fs');
const playlistManager = require('./playlist-manager');

// Create log for scheduler runs
const LOG_FILE = path.join(__dirname, '..', 'tests', 'playlist_update.log');
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Log function
function log(message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [SCHEDULER] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(LOG_FILE, formattedMessage);
    
    // Also output to console
    console.log(message);
}

// Main function
async function main() {
    log('Scheduled playlist update started');
    
    try {
        // Update all playlists
        const result = await playlistManager.updateAllPlaylists();
        
        if (result.success) {
            log(`Successfully updated ${result.playlistCount} playlists with ${result.channels} channels`);
            
            // Clean up old playlist files
            const cleanup = playlistManager.cleanupOldPlaylists();
            if (cleanup.success) {
                log(`Cleaned up ${cleanup.deletedCount} old playlist files`);
            }
        } else {
            log(`Failed to update playlists: ${result.error}`);
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(err => {
                    log(`- ${err.source.name || err.source.url || err.source.path}: ${err.error}`);
                });
            }
        }
    } catch (error) {
        log(`Error during scheduled update: ${error.message}`);
    }
    
    log('Scheduled playlist update finished');
}

// Execute main function
main().catch(err => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
});

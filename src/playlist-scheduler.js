/**
 * Playlist Scheduler for IPTV Player
 * 
 * This script manages scheduled playlist updates using platform-specific
 * schedulers (Task Scheduler on Windows, cron on macOS/Linux).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const platform = require('./platform');

// Paths
const SCRIPT_PATH = path.join(__dirname, 'update-playlists.js');
const LOG_PATH = path.join(__dirname, '..', 'tests', 'playlist_update.log');

/**
 * Create a Windows Task Scheduler task for playlist updates
 */
function createWindowsTask(intervalMinutes = 60) {
    const taskName = 'IPTVPlayerPlaylistUpdate';
    const nodePath = process.execPath; // Path to node executable
    
    try {
        // Check if task already exists
        const checkCmd = `schtasks /query /tn "${taskName}" > nul 2>&1`;
        const taskExists = execSync(checkCmd, { shell: true }).toString() === '';
        
        if (taskExists) {
            execSync(`schtasks /delete /tn "${taskName}" /f`, { shell: true });
        }
        
        // Create task to run every intervalMinutes
        const createCmd = `schtasks /create /tn "${taskName}" /tr "${nodePath} \\"${SCRIPT_PATH}\\"" /sc minute /mo ${intervalMinutes} /f`;
        execSync(createCmd, { shell: true });
        
        console.log(`Created Windows scheduled task to update playlists every ${intervalMinutes} minutes`);
        return true;
    } catch (error) {
        console.error(`Error creating Windows scheduled task: ${error.message}`);
        return false;
    }
}

/**
 * Create a cron job for playlist updates (macOS/Linux)
 */
function createCronJob(intervalMinutes = 60) {
    const nodePath = process.execPath; // Path to node executable
    const username = os.userInfo().username;
    
    // Format for crontab: min hour * * * command
    // If intervalMinutes divides evenly into 60, we can use * for hours
    // Otherwise we need to calculate minutes
    let cronSchedule = '';
    
    if (60 % intervalMinutes === 0) {
        // Runs every intervalMinutes (e.g., */5 * * * * for every 5 minutes)
        cronSchedule = `*/${intervalMinutes} * * * *`;
    } else {
        // For odd intervals like 45 minutes, list out specific minutes (0,45,90,135...)
        const minutes = [];
        for (let i = 0; i < 60; i += intervalMinutes % 60) {
            minutes.push(i);
        }
        cronSchedule = `${minutes.join(',')} */${Math.floor(intervalMinutes / 60)} * * *`;
    }
    
    const cronCommand = `${cronSchedule} ${nodePath} ${SCRIPT_PATH} >> ${LOG_PATH} 2>&1`;
    
    try {
        // Get existing crontab
        let crontab = '';
        try {
            crontab = execSync('crontab -l', { stdio: 'pipe' }).toString();
        } catch (err) {
            // No crontab for user
        }
        
        // Remove any existing IPTV playlist update jobs
        crontab = crontab
            .split('\n')
            .filter(line => !line.includes(SCRIPT_PATH))
            .join('\n');
        
        // Add new job
        crontab = `${crontab}\n# IPTV Player playlist update\n${cronCommand}\n`;
        
        // Write to temp file and load new crontab
        const tempFile = path.join(os.tmpdir(), 'iptv-crontab');
        fs.writeFileSync(tempFile, crontab, 'utf8');
        execSync(`crontab ${tempFile}`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        console.log(`Created cron job to update playlists every ${intervalMinutes} minutes`);
        return true;
    } catch (error) {
        console.error(`Error creating cron job: ${error.message}`);
        return false;
    }
}

/**
 * Create a scheduled task/job for playlist updates based on platform
 */
function schedulePlaylistUpdates(intervalMinutes = 60) {
    if (platform.isWindows) {
        return createWindowsTask(intervalMinutes);
    } else {
        return createCronJob(intervalMinutes);
    }
}

/**
 * Remove scheduled task/job for playlist updates
 */
function removeScheduledUpdates() {
    try {
        if (platform.isWindows) {
            const taskName = 'IPTVPlayerPlaylistUpdate';
            execSync(`schtasks /query /tn "${taskName}" > nul 2>&1 && schtasks /delete /tn "${taskName}" /f`, { shell: true });
        } else {
            // Get existing crontab
            let crontab = '';
            try {
                crontab = execSync('crontab -l', { stdio: 'pipe' }).toString();
            } catch (err) {
                // No crontab
                return true;
            }
            
            // Remove any lines containing the update script
            crontab = crontab
                .split('\n')
                .filter(line => !line.includes(SCRIPT_PATH))
                .join('\n');
            
            // Write back to crontab
            const tempFile = path.join(os.tmpdir(), 'iptv-crontab');
            fs.writeFileSync(tempFile, crontab, 'utf8');
            execSync(`crontab ${tempFile}`, { stdio: 'pipe' });
            fs.unlinkSync(tempFile);
        }
        console.log('Removed scheduled playlist updates');
        return true;
    } catch (error) {
        console.error(`Error removing scheduled updates: ${error.message}`);
        return false;
    }
}

module.exports = {
    schedulePlaylistUpdates,
    removeScheduledUpdates
};

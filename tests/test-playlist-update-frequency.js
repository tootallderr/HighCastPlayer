/**
 * Playlist Update Frequency Test
 * 
 * This script tests the playlist update scheduling system by:
 * 1. Monitoring playlist updates at specified intervals
 * 2. Verifying the timing between updates is correct
 * 3. Checking that playlists are consistently updated
 * 
 * Usage: node tests/test-playlist-update-frequency.js [minutes]
 * Where [minutes] is the interval to test (default: 2 minutes)
 */

const fs = require('fs');
const path = require('path');
const playlistManager = require('../src/playlist-manager');
const pathManager = require('../src/path-manager');

// Define log and merged playlist paths
const LOG_FILE = path.join(__dirname, 'update_frequency_test.log');
const MERGED_PLAYLIST = pathManager.getMergedPlaylistPath();

// Default test duration in minutes
const DEFAULT_TEST_DURATION_MINUTES = 5;

// Initialize log file
fs.writeFileSync(LOG_FILE, '', 'utf8');

// Log function with timestamp
function log(message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}\n`;
    
    fs.appendFileSync(LOG_FILE, formattedMessage);
    console.log(`[${timestamp}] ${message}`);
}

// Get playlist file modified time
function getPlaylistModifiedTime() {
    try {
        const stats = fs.statSync(MERGED_PLAYLIST);
        return stats.mtime;
    } catch (error) {
        log(`Error getting playlist modified time: ${error.message}`);
        return null;
    }
}

// Run the test
async function runUpdateFrequencyTest() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const updateIntervalMinutes = parseInt(args[0]) || 2;
    const totalTestDurationMinutes = args[1] ? parseInt(args[1]) : DEFAULT_TEST_DURATION_MINUTES;
    
    log(`Starting playlist update frequency test`);
    log(`Update interval: ${updateIntervalMinutes} minutes`);
    log(`Test duration: ${totalTestDurationMinutes} minutes`);
    
    // Initial playlist update
    log(`Performing initial playlist update...`);
    await playlistManager.updateAllPlaylists();
    let lastModified = getPlaylistModifiedTime();
    log(`Initial playlist update complete at ${lastModified}`);
    
    // Setup the update schedule
    log(`Scheduling updates every ${updateIntervalMinutes} minutes`);
    const intervalId = playlistManager.scheduleUpdates(updateIntervalMinutes);
    
    // Store update times
    const updateTimes = [];
    updateTimes.push({
        time: new Date(),
        playlistModified: lastModified
    });
    
    log(`Monitoring for ${totalTestDurationMinutes} minutes...`);
    
    // Check the file periodically
    const checkIntervalMs = 10 * 1000; // 10 seconds
    let elapsedMinutes = 0;
    
    const monitorInterval = setInterval(() => {
        const currentTime = new Date();
        const currentModified = getPlaylistModifiedTime();
        elapsedMinutes = (currentTime - updateTimes[0].time) / (60 * 1000);
        
        // If modified time changed, log it
        if (currentModified && (!lastModified || currentModified.getTime() !== lastModified.getTime())) {
            log(`Playlist updated at ${currentModified}`);
            
            // Calculate minutes since last update
            const previousUpdate = updateTimes[updateTimes.length - 1].time;
            const minutesSinceLastUpdate = (currentTime - previousUpdate) / (60 * 1000);
            
            log(`Time since last update: ${minutesSinceLastUpdate.toFixed(2)} minutes`);
            
            // Check if timing is close to expected
            const deviation = Math.abs(minutesSinceLastUpdate - updateIntervalMinutes);
            const deviationPercent = (deviation / updateIntervalMinutes) * 100;
            
            if (deviationPercent < 10) {
                log(`✅ Timing accuracy within 10% (${deviationPercent.toFixed(2)}%)`);
            } else {
                log(`❌ Timing deviation exceeds 10%: ${deviationPercent.toFixed(2)}%`);
            }
            
            // Store this update
            updateTimes.push({
                time: currentTime,
                playlistModified: currentModified
            });
            
            lastModified = currentModified;
        }
        
        // Check if test duration has elapsed
        if (elapsedMinutes >= totalTestDurationMinutes) {
            clearInterval(monitorInterval);
            clearInterval(intervalId); // Stop the updates
            
            // Final report
            log(`\n=== Test Results ===`);
            log(`Total updates during test: ${updateTimes.length - 1}`);
            const expectedUpdates = Math.floor(totalTestDurationMinutes / updateIntervalMinutes);
            log(`Expected updates (approx): ${expectedUpdates}`);
            
            if (updateTimes.length - 1 >= expectedUpdates) {
                log(`✅ Update frequency test PASSED`);
            } else {
                log(`❌ Update frequency test FAILED - insufficient updates`);
            }
            
            // Calculate average interval
            if (updateTimes.length > 2) {
                let totalInterval = 0;
                for (let i = 1; i < updateTimes.length; i++) {
                    totalInterval += (updateTimes[i].time - updateTimes[i-1].time);
                }
                const avgInterval = totalInterval / (updateTimes.length - 1) / (60 * 1000);
                log(`Average update interval: ${avgInterval.toFixed(2)} minutes`);
            }
            
            log(`Test complete. Results saved to ${LOG_FILE}`);
            process.exit(0);
        }
    }, checkIntervalMs);
}

// Run the test
runUpdateFrequencyTest().catch(error => {
    log(`Test error: ${error.message}`);
    process.exit(1);
});

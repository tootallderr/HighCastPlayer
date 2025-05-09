/**
 * Settings and Playlist Management Test
 * 
 * This script tests the settings functionality by:
 * 1. Loading and verifying settings
 * 2. Modifying settings and checking persistence
 * 3. Testing playlist source management
 * 4. Verifying log entries for settings changes
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const config = require('../src/config-manager');
const playlistManager = require('../src/playlist-manager');
const validator = require('../src/playlist-validator');

// Define paths
const SETTINGS_LOG_FILE = path.join(__dirname, 'settings.log');
const SOURCES_LOG_FILE = path.join(__dirname, 'sources.log');
const platform = require('../src/platform');
const SETTINGS_FILE = path.join(platform.getAppDataPath(), 'settings.json');
const SOURCES_FILE = path.join(__dirname, '..', 'data', 'sources.json');

// Sample playlist for testing
const TEST_PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const LOCAL_PLAYLIST_PATH = path.join(__dirname, 'test-data', 'test-playlist.m3u8');

// Log test results
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(path.join(__dirname, 'settings_test.log'), formattedMessage);
    
    // Also output to console
    console.log(`[${level.toUpperCase()}] ${message}`);
}

// Setup log file for test results
fs.writeFileSync(path.join(__dirname, 'settings_test.log'), '', 'utf8'); // Clear log file

// Run tests
async function runTests() {
    log('=== IPTV Player Settings Test ===');
    
    try {
        // Test 1: Load and verify settings
        log('\n1. Testing settings loading...');
        const settings = config.getAll();
        log(`Settings object structure check: ${typeof settings === 'object' ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        log(`Settings properties: ${Object.keys(settings).join(', ')}`);
        
        // Check if settings file exists
        const settingsExists = fs.existsSync(SETTINGS_FILE);
        log(`Settings file exists: ${settingsExists ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        if (settingsExists) {
            const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
            try {
                JSON.parse(settingsData);
                log('Settings JSON structure is valid: PASSED ✅');
            } catch (e) {
                log(`Settings JSON structure is invalid: FAILED ❌ - ${e.message}`);
            }
        }
        
        // Test 2: Modify settings and check persistence
        log('\n2. Testing settings modification...');
        const originalBufferLength = settings.player.bufferLength;
        const newBufferLength = originalBufferLength + 10;
        
        const setResult = config.set('player.bufferLength', newBufferLength);
        log(`Settings update result: ${setResult ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Verify updated settings
        const updatedSettings = config.getAll();
        log(`Settings updated correctly: ${updatedSettings.player.bufferLength === newBufferLength ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Restore original value
        config.set('player.bufferLength', originalBufferLength);
        log(`Restored buffer length to original value: ${originalBufferLength}`);
        
        // Test 3: Check playlist sources file
        log('\n3. Testing playlist sources file...');
        const sourcesExists = fs.existsSync(SOURCES_FILE);
        log(`Sources file exists: ${sourcesExists ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        const sources = playlistManager.getSources();
        log(`Sources object structure check: ${typeof sources === 'object' && sources.hasOwnProperty('remote') && sources.hasOwnProperty('local') ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Test 4: Validate playlist with validator
        log('\n4. Testing playlist validation...');
        try {
            // Create test file if it doesn't exist
            if (!fs.existsSync(LOCAL_PLAYLIST_PATH)) {
                const dir = path.dirname(LOCAL_PLAYLIST_PATH);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                const content = `#EXTM3U
#EXTINF:-1 tvg-id="test" tvg-name="Test Channel",Test Channel
http://example.com/test.m3u8
`;
                fs.writeFileSync(LOCAL_PLAYLIST_PATH, content);
            }
            
            // Validate local file
            const localResult = await validator.validatePlaylistFile(LOCAL_PLAYLIST_PATH);
            log(`Local playlist validation: ${localResult.valid ? 'PASSED ✅' : 'FAILED ❌'}`);
            if (localResult.valid) {
                log(`Channels found: ${localResult.channelCount}`);
            } else {
                log(`Validation error: ${localResult.error}`);
            }
            
            // Try validating a non-existent file
            const badResult = await validator.validatePlaylistFile('/path/to/nonexistent/file.m3u8');
            log(`Invalid file validation correctly failed: ${!badResult.valid ? 'PASSED ✅' : 'FAILED ❌'}`);
        } catch (error) {
            log(`Error during validation test: ${error.message}`, 'error');
        }
        
        // Test 5: Check log files
        log('\n5. Testing settings and sources logs...');
        const settingsLogExists = fs.existsSync(SETTINGS_LOG_FILE);
        const sourcesLogExists = fs.existsSync(SOURCES_LOG_FILE);
        
        log(`Settings log exists: ${settingsLogExists ? 'PASSED ✅' : 'FAILED ❌'}`);
        log(`Sources log exists: ${sourcesLogExists ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        if (!settingsLogExists) {
            // Create a test entry
            const { logSettingsChange } = require('../src/settings-logger');
            logSettingsChange('Test settings log entry', 'info');
            log('Created a test settings log entry');
        }
        
        if (!sourcesLogExists) {
            // Create a test entry
            const { logSourceChange } = require('../src/settings-logger');
            logSourceChange('Test sources log entry', 'info');
            log('Created a test sources log entry');
        }
        
        log('\n=== Settings Tests Complete ===');
    } catch (error) {
        log(`Test error: ${error.message}`, 'error');
        log(error.stack);
    }
}

// Run tests
runTests().catch(err => {
    console.error('Test error:', err);
});

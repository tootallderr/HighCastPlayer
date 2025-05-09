/**
 * Playlist Management Test
 * 
 * This script tests the playlist manager functionality by:
 * 1. Loading playlist sources
 * 2. Downloading remote playlists 
 * 3. Merging playlists
 * 4. Validating the merged playlist
 */

const fs = require('fs');
const path = require('path');
let playlistManager;
try {
    playlistManager = require('../src/playlist-manager');
    console.log("Successfully imported playlist manager module");
    console.log("Available functions:", Object.keys(playlistManager));
} catch (error) {
    console.error("Error importing playlist manager:", error);
    process.exit(1);
}

// Test directories
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEST_PLAYLIST = path.join(TEST_DATA_DIR, 'test-playlist.m3u8');

// Sample test playlist content
const TEST_PLAYLIST_CONTENT = `#EXTM3U
#EXTINF:-1 tvg-id="Channel1" tvg-name="Test Channel 1" tvg-logo="http://example.com/logo1.png" group-title="Test", Test Channel 1
http://example.com/stream1.m3u8

#EXTINF:-1 tvg-id="Channel2" tvg-name="Test Channel 2" tvg-logo="http://example.com/logo2.png" group-title="Test", Test Channel 2
http://example.com/stream2.m3u8
`;

// Create test directory if it doesn't exist
if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// Create a test local playlist
fs.writeFileSync(TEST_PLAYLIST, TEST_PLAYLIST_CONTENT);

// Log test results
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Make sure the tests directory exists
if (!fs.existsSync(path.join(__dirname))) {
    fs.mkdirSync(path.join(__dirname), { recursive: true });
}

// Setup log file for test results
const TEST_LOG_FILE = path.join(__dirname, 'playlist_test.log');
fs.writeFileSync(TEST_LOG_FILE, '', 'utf8'); // Clear log file

// Log function with file output
function log(message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(TEST_LOG_FILE, formattedMessage);
    
    // Also output to console
    console.log(`[${timestamp}] ${message}`);
}

// Run tests
async function runTests() {
    log('=== IPTV Player Playlist Management Test ===');
    
    // Test 1: Add a local playlist source
    log('\n1. Testing adding a local playlist source...');
    const addLocalResult = playlistManager.addLocalSource(TEST_PLAYLIST, 'Test Local Playlist');
    log(`Add local playlist result: ${addLocalResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Test 2: Add a remote playlist source
    log('\n2. Testing adding a remote playlist source...');
    const addRemoteResult = playlistManager.addRemoteSource('https://iptv-org.github.io/iptv/index.m3u', 'Test Remote Playlist');
    log(`Add remote playlist result: ${addRemoteResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Test 3: Get sources
    log('\n3. Testing getting playlist sources...');
    const sources = playlistManager.getSources();
    log(`Number of remote sources: ${sources.remote.length}`);
    log(`Number of local sources: ${sources.local.length}`);
    log(`Get sources result: ${sources ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Test 4: Update all playlists (this will download remote playlists and merge them)
    log('\n4. Testing updating all playlists...');
    try {
        const updateResult = await playlistManager.updateAllPlaylists();
        log(`Update playlists result: ${updateResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        if (updateResult.success) {
            log(`Number of playlists processed: ${updateResult.playlistCount}`);
            log(`Number of channels in merged playlist: ${updateResult.channels}`);
        } else {
            log(`Error: ${updateResult.error}`);
            if (updateResult.errors && updateResult.errors.length) {
                updateResult.errors.forEach(err => {
                    log(`- ${err.source.name || err.source.url || err.source.path}: ${err.error}`);
                });
            }
        }
    } catch (error) {
        log(`Update playlists error: ${error.message}`);
        log('Update playlists result: FAILED ❌');
    }
    
    // Test 5: Verify merged playlist exists
    log('\n5. Testing merged playlist file...');
    const mergedPath = playlistManager.getMergedPlaylistPath();
    const mergedExists = fs.existsSync(mergedPath);
    log(`Merged playlist path: ${mergedPath}`);
    log(`Merged playlist exists: ${mergedExists ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    if (mergedExists) {
        const mergedStats = fs.statSync(mergedPath);
        log(`Merged playlist size: ${(mergedStats.size / 1024).toFixed(2)} KB`);
        log(`Last modified: ${mergedStats.mtime}`);
    }
    
    // Test 6: Clean up old playlists
    log('\n6. Testing playlist cleanup...');
    const cleanupResult = playlistManager.cleanupOldPlaylists(0);
    log(`Cleanup result: ${cleanupResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    log(`Number of files cleaned up: ${cleanupResult.deletedCount}`);
    
    // Test 7: Remove a source
    log('\n7. Testing removing a source...');
    const removeLocalResult = playlistManager.removeSource('local', TEST_PLAYLIST);
    log(`Remove local source result: ${removeLocalResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    log('\n=== Playlist Management Tests Complete ===');
}

// Run tests
runTests().catch(err => {
    console.error('Test error:', err);
});

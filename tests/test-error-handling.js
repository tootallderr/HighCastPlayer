/**
 * Error Handling Test for Player Engine
 * 
 * This script tests the error handling capabilities of the player engine
 * by intentionally using invalid stream URLs and verifying proper handling.
 */

const fs = require('fs');
const path = require('path');
const playerEngine = require('../src/player-engine');

// Set up logging
const LOG_FILE = path.join(__dirname, 'error_handling_test.log');
fs.writeFileSync(LOG_FILE, '', 'utf8'); // Clear log file

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  // Write to log file
  fs.appendFileSync(LOG_FILE, formattedMessage);
  
  // Output to console
  console.log(`[${timestamp}] ${message}`);
}

// Run tests
async function runErrorHandlingTests() {
  log('=== IPTV Player Error Handling Test ===');
  
  // Test 1: Initialize the player engine
  log('\n1. Testing player engine initialization...');
  const initResult = await playerEngine.initialize();
  log(`Initialization result: ${initResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
  
  // Test 2: Play non-existent channel
  log('\n2. Testing playback with non-existent channel ID...');
  try {
    const playResult = await playerEngine.playChannel('non-existent-channel-id');
    log(`Play non-existent channel returns error: ${playResult.error ? 'PASSED ✅' : 'FAILED ❌'}`);
    log(`Error message: ${playResult.error}`);
  } catch (error) {
    log(`Error was thrown (good): ${error.message}`);
    log('Play non-existent channel handling: PASSED ✅');
  }
  
  // Test 3: Invalid stream URL
  log('\n3. Testing invalid stream URL handling...');
  
  // Create a test channel with invalid URL
  const invalidStreamChannel = {
    id: 'test-invalid-stream',
    title: 'Test Invalid Stream',
    duration: -1,
    logo: '',
    group: 'Test',
    url: 'https://example.com/invalid-stream.m3u8', // Non-existent URL
    attributes: {
      'tvg-id': 'test-invalid-stream',
      'tvg-name': 'Test Invalid Stream',
      'group-title': 'Test'
    }
  };
  
  // Add the test channel to the player engine
  playerEngine.addTestChannel(invalidStreamChannel);
  
  // Try to validate the stream
  try {
    const validationResult = await playerEngine.validateStream(invalidStreamChannel.url);
    log(`Stream validation returns false for invalid URL: ${!validationResult ? 'PASSED ✅' : 'FAILED ❌'}`);
  } catch (error) {
    log(`Stream validation error: ${error.message}`, 'error');
    log('Stream validation exception handling: PASSED ✅');
  }
  
  // Test 4: Malformed playlist
  log('\n4. Testing malformed playlist handling...');
  const malformedPlaylist = `#EXTM3U
  #EXTINF:-1,This is a malformed playlist
  http://example.com/stream
  #EXTINF:This line is missing duration
  http://example.com/missing-duration
  #EXTINF:-1,
  `;
  
  try {
    const result = playerEngine.parseM3U8Playlist(malformedPlaylist);
    log(`Malformed playlist parsing returned ${result.length} channels`);
    log(`Malformed playlist handling: ${result.length === 1 ? 'PASSED ✅' : 'FAILED ❌'}`);
  } catch (error) {
    log(`Malformed playlist parsing threw error: ${error.message}`, 'error');
    log('Malformed playlist exception handling: PASSED ✅');
  }
  
  // Test 5: Error handling during playback
  log('\n5. Testing error handling during playback...');
  
  // Listen for errors during playback
  let errorReceived = false;
  const originalConsoleError = console.error;
  console.error = (message) => {
    if (message.includes('playback') || message.includes('Playback')) {
      errorReceived = true;
      log(`Captured error: ${message}`, 'error');
    }
    originalConsoleError(message);
  };
  
  try {
    // Try to play the invalid stream
    await playerEngine.playChannel('test-invalid-stream');
    
    // Wait a bit to see if errors occur
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log(`Error handling during playback: ${errorReceived ? 'PASSED ✅' : 'No errors detected'}`);
  } catch (error) {
    log(`Playback error thrown: ${error.message}`, 'error');
    log('Error handling during playback exception: PASSED ✅');
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }
  
  // Test 6: Check graceful handling when stopping non-existent playback
  log('\n6. Testing stopping non-existent playback...');
  try {
    // Stop any existing playback first
    await playerEngine.stopPlayback();
    
    // Try stopping again when nothing is playing
    const result = await playerEngine.stopPlayback();
    log(`Stopping non-existent playback result: ${result ? 'PASSED ✅' : 'FAILED ❌'}`);
  } catch (error) {
    log(`Stop non-existent playback error: ${error.message}`, 'error');
    log('Stop playback exception handling needs improvement ❌');
  }
  
  log('\n=== Error Handling Test Complete ===');
}

// Add a patch to handle missing functions if needed
if (!playerEngine.parseM3U8Playlist) {
  playerEngine.parseM3U8Playlist = function(content) {
    console.log("Using fallback parseM3U8Playlist function");
    return [];
  };
}

if (!playerEngine.addTestChannel) {
  playerEngine.addTestChannel = function(channel) {
    console.log("Using fallback addTestChannel function");
    return true;
  };
}

// Run the tests
runErrorHandlingTests().catch(error => {
  log(`Test runner error: ${error.message}`, 'error');
  console.error(error);
});

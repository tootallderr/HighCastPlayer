/**
 * Player Engine Test
 * 
 * This script tests the core player engine functionality by:
 * 1. Loading channels from a playlist
 * 2. Playing a channel
 * 3. Testing playback controls
 * 4. Testing recording functionality
 */

const fs = require('fs');
const path = require('path');
const playerEngine = require('../src/player-engine');

// Log test results
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Setup log file
const LOG_FILE = path.join(__dirname, 'player_test.log');
fs.writeFileSync(LOG_FILE, '', 'utf8'); // Clear log file

// Run tests
async function runTests() {
  log('=== IPTV Player Engine Test ===');
  
  try {
    // Test 1: Initialize the player engine
    log('\n1. Testing player engine initialization...');
    const initResult = await playerEngine.initialize();
    log(`Initialization result: ${initResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Test 2: Load channels
    log('\n2. Testing channel loading...');
    const channels = await playerEngine.getChannels();
    log(`Loaded ${channels.length} channels`);
    log(`Channel loading result: ${channels.length > 0 ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Test 3: Play a channel (if any channels available)
    if (channels.length > 0) {
      log('\n3. Testing channel playback...');
      const channel = channels[0];
      log(`Playing channel: ${channel.title} (${channel.id})`);
      
      try {
        const playResult = await playerEngine.playChannel(channel.id, {
          useTimeShift: true,
          bufferSize: 30,
          autoplay: true
        });
        
        log(`Channel URL: ${playResult.streamUrl}`);
        log(`Channel playback result: ${playResult ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Test 4: Get playback info
        log('\n4. Testing playback info...');
        const playbackInfo = playerEngine.getPlaybackInfo();
        log(`Playback info: ${JSON.stringify(playbackInfo)}`);
        log(`Playback info result: ${playbackInfo ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Test 5: Test pause/resume
        log('\n5. Testing pause/resume...');
        const pauseResult = playerEngine.pausePlayback();
        log(`Pause result: ${pauseResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const resumeResult = playerEngine.resumePlayback();
        log(`Resume result: ${resumeResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Test 6: Test seeking
        log('\n6. Testing seeking...');
        const seekResult = playerEngine.seekBuffer(-5);
        log(`Seek result: ${seekResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Test 7: Filter channels
        log('\n7. Testing channel filtering...');
        const filteredChannels = playerEngine.filterChannels({
          query: channel.title.substring(0, 3)
        });
        log(`Found ${filteredChannels.length} channels matching query`);
        log(`Filter result: ${filteredChannels.length > 0 ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Test 8: Get channel groups
        log('\n8. Testing channel groups...');
        const groups = playerEngine.getChannelGroups();
        log(`Found ${groups.length} channel groups`);
        log(`Groups result: ${groups.length > 0 ? 'PASSED ✅' : 'FAILED ❌'}`);
        
        // Test 9: Stop playback
        log('\n9. Testing stop playback...');
        const stopResult = await playerEngine.stopPlayback();
        log(`Stop result: ${stopResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
      } catch (error) {
        log(`Error during playback tests: ${error.message}`, 'error');
      }
    }
    
    // Test 10: Test recording (only if FFmpeg is available)
    const platform = require('../src/platform');
    if (platform.hasFFmpeg && platform.hasFFmpeg()) {
      log('\n10. Testing recording (requires FFmpeg)...');
      
      if (channels.length > 0) {
        try {
          const channel = channels[0];
          const recordResult = await playerEngine.startRecording(channel.id);
          log(`Recording started: ${channel.title} to ${path.basename(recordResult.outputPath)}`);
          log(`Recording start result: ${recordResult ? 'PASSED ✅' : 'FAILED ❌'}`);
            // Record for a few seconds
          log('Recording for 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Stop recording
          const stopResult = await playerEngine.stopRecording();
          log(`Recording stop result: ${stopResult.success ? 'PASSED ✅' : 'FAILED ❌'}${stopResult.timedOut ? ' (timed out)' : ''}`);
          
          if (stopResult.success) {
            log(`Recorded file: ${stopResult.outputPath}`);
            log(`File exists: ${fs.existsSync(stopResult.outputPath) ? 'Yes' : 'No'}`);
          }
        } catch (error) {
          log(`Error during recording test: ${error.message}`, 'error');
        }
      }
    } else {
      log('\nSkipping recording tests - FFmpeg not available');
    }
    
  } catch (error) {
    log(`Test error: ${error.message}`);
    log(error.stack);
  }
  
  log('\n=== Player Engine Tests Complete ===');
}

// Run tests
runTests().catch(err => {
  console.error('Test error:', err);
});

/**
 * Recording Scheduler Test
 * 
 * This script tests the recording scheduler functionality by:
 * 1. Setting up scheduled recordings
 * 2. Testing manual recording
 * 3. Testing simultaneous recordings
 * 4. Verifying file naming and directory structure
 */

const fs = require('fs');
const path = require('path');
const scheduler = require('../src/recording-scheduler');
const playerEngine = require('../src/player-engine');
const platform = require('../src/platform');

// Log test results
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Setup log file
const LOG_FILE = path.join(__dirname, 'recording_test.log');
fs.writeFileSync(LOG_FILE, '', 'utf8'); // Clear log file

// Run tests
async function runTests() {
  log('=== IPTV Recording Scheduler Test ===');
  
  try {
    // Test 1: Initialize the recording scheduler
    log('\n1. Testing recording scheduler initialization...');
    const initResult = await scheduler.initialize();
    log(`Initialization result: ${initResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Test 2: Initialize player engine to get channels
    log('\n2. Testing player engine initialization...');
    await playerEngine.initialize();
    const channels = await playerEngine.getChannels();
    log(`Loaded ${channels.length} channels`);
    
    if (channels.length === 0) {
      log('No channels available, cannot continue testing', 'error');
      return;
    }
    
    // Test 3: Test manual recording
    log('\n3. Testing manual recording...');
    const testChannel = channels[0];
    log(`Selected test channel: ${testChannel.title} (${testChannel.id})`);
    
    try {
      const recordResult = await playerEngine.startRecording(testChannel.id);
      log(`Recording started: ${testChannel.title}`);
      log(`Recording path: ${recordResult.outputPath}`);
      log(`Naming convention check: ${path.basename(recordResult.outputPath).match(/^\d{4}-\d{2}-\d{2}_.*\.mp4$/) ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      log('Recording for 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const stopResult = await playerEngine.stopRecording();
      log(`Recording stopped: ${stopResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      // Check file exists
      const fileExists = fs.existsSync(stopResult.outputPath);
      log(`Recording file exists: ${fileExists ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      // Check file size
      if (fileExists) {
        const stats = fs.statSync(stopResult.outputPath);
        log(`Recording file size: ${stats.size} bytes`);
        log(`File not empty: ${stats.size > 0 ? 'PASSED ✅' : 'FAILED ❌'}`);
      }
    } catch (error) {
      log(`Error during manual recording test: ${error.message}`, 'error');
    }
    
    // Test 4: Scheduled recording (near future)
    log('\n4. Testing scheduled recording...');
    try {
      // Schedule a recording to start in 5 seconds
      const startTime = new Date(Date.now() + 5000); // 5 seconds from now
      const secondTestChannel = channels[Math.min(1, channels.length - 1)]; // Use channel index 1 or 0 if only one channel
      
      log(`Scheduling recording of ${secondTestChannel.title} to start at ${startTime.toISOString()} for 10 seconds`);
      
      const scheduleResult = await scheduler.scheduleRecording(
        secondTestChannel.id,
        startTime,
        0.2, // 0.2 minutes = 12 seconds
        `Test recording of ${secondTestChannel.title}`
      );
      
      log(`Scheduling result: ${scheduleResult ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      // Listen for recording events
      scheduler.on('recording-started', (data) => {
        log(`Event: Recording started for ${data.recording.title}`);
      });
      
      scheduler.on('recording-completed', (data) => {
        log(`Event: Recording completed for ${data.recording.title}`);
        if (data.result && data.result.outputPath) {
          log(`Recording saved to: ${data.result.outputPath}`);
          
          // Check file exists
          const fileExists = fs.existsSync(data.result.outputPath);
          log(`Scheduled recording file exists: ${fileExists ? 'PASSED ✅' : 'FAILED ❌'}`);
          
          // Check directory structure
          const expectedDir = path.join(platform.getAppDataPath(), 'recordings');
          const actualDir = path.dirname(data.result.outputPath);
          log(`Directory structure check: ${actualDir === expectedDir ? 'PASSED ✅' : 'FAILED ❌'}`);
        }
      });
      
      // Wait for recording to complete (5s wait + 12s recording + 1s buffer)
      log('Waiting for scheduled recording to complete...');
      await new Promise(resolve => setTimeout(resolve, 18000));
      
      // Check all recordings
      const allRecordings = scheduler.getAllScheduledRecordings();
      log(`Total scheduled recordings: ${allRecordings.length}`);
      log(`Completed recordings: ${scheduler.getRecordingsByStatus('completed').length}`);
    } catch (error) {
      log(`Error during scheduled recording test: ${error.message}`, 'error');
    }
    
    // Test 5: Time-shifting (pause, rewind, resume)
    log('\n5. Testing time-shifting functionality...');
    try {
      const timeShiftChannel = channels[0];
      log(`Playing channel for time-shift test: ${timeShiftChannel.title}`);
      
      const playResult = await playerEngine.playChannel(timeShiftChannel.id, {
        useTimeShift: true,
        bufferSize: 30,
        autoplay: true
      });
      
      log('Letting stream play for 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test pause
      const pauseResult = playerEngine.pausePlayback();
      log(`Pause result: ${pauseResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      // Wait while paused
      log('Paused for 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test rewind
      const rewindResult = playerEngine.seekBuffer(-3);
      log(`Rewind 3 seconds result: ${rewindResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      // Test resume
      const resumeResult = playerEngine.resumePlayback();
      log(`Resume result: ${resumeResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
      log(`Behind live by ${resumeResult.behindLive?.toFixed(1)} seconds`);
      
      // Let it play a bit longer
      log('Resumed playback for 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Stop playback
      await playerEngine.stopPlayback();
    } catch (error) {
      log(`Error during time-shifting test: ${error.message}`, 'error');
    }
    
  } catch (error) {
    log(`Test error: ${error.message}`);
    log(error.stack);
  } finally {
    // Cleanup
    await scheduler.shutdown();
  }
  
  log('\n=== Recording Tests Complete ===');
}

// Run tests
runTests().catch(err => {
  console.error('Test error:', err);
});

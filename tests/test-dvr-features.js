/**
 * DVR Features Test Script
 * 
 * Tests all DVR features: recording, time-shifting, scheduling
 */

const fs = require('fs');
const path = require('path');
const playerEngine = require('../src/player-engine');
const recordingScheduler = require('../src/recording-scheduler');

// Define log file
const TEST_LOG_FILE = path.join(__dirname, 'dvr-test.log');

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
    log('=== IPTV DVR Features Verification Test ===');
    
    try {
        // Initialize components
        log('\n1. Initializing player engine and recording scheduler...');
        await playerEngine.initialize();
        await recordingScheduler.initialize();
        
        // Load channels
        const channels = await playerEngine.getChannels();
        log(`Loaded ${channels.length} channels`);
        
        if (channels.length === 0) {
            log('No channels available, cannot continue testing', 'error');
            return;
        }
        
        // Test 1: Record a channel
        log('\n2. Testing manual recording...');
        try {
            const testChannel = channels[0];
            log(`Starting recording of channel ${testChannel.title}`);
            
            const recordResult = await playerEngine.startRecording(testChannel.id);
            log(`Recording path: ${recordResult.outputPath}`);
            
            // Check filename format (YYYY-MM-DD_title.mp4)
            const filename = path.basename(recordResult.outputPath);
            log(`Filename format check: ${filename.match(/^\d{4}-\d{2}-\d{2}_.*\.mp4$/) ? 'PASSED ✅' : 'FAILED ❌'}`);
            
            // Record for 5 seconds
            log('Recording for 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const stopResult = await playerEngine.stopRecording();
            log(`Recording stopped: ${stopResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
            
            // Check recording logs
            const recordingLogPath = path.join(__dirname, 'recording.log');
            const recordingLogs = fs.existsSync(recordingLogPath) ? fs.readFileSync(recordingLogPath, 'utf8') : '';
            log(`Recording logs created: ${recordingLogs.includes(testChannel.title) ? 'PASSED ✅' : 'FAILED ❌'}`);
        } catch (error) {
            log(`Error during recording test: ${error.message}`, 'error');
        }
        
        // Test 2: Time-shifting
        log('\n3. Testing time-shifting functionality...');
        try {
            // Use first channel for test
            const testChannel = channels[0];
            log(`Playing channel for time-shift test: ${testChannel.title}`);
            
            const playResult = await playerEngine.playChannel(testChannel.id, {
                useTimeShift: true,
                bufferSize: 30,
                autoplay: true
            });
            
            log('Letting stream play for 10 seconds to build buffer...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Test pause
            const pauseResult = playerEngine.pausePlayback();
            log(`Pause result: ${pauseResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
            
            // Test seek backward
            const seekBackResult = playerEngine.seekBuffer(-5);
            log(`Seek backward 5 seconds result: ${seekBackResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
            log(`Behind live point by: ${seekBackResult.behindLive?.toFixed(1) || 'unknown'} seconds`);
            
            // Test seek forward
            const seekForwardResult = playerEngine.seekBuffer(2);
            log(`Seek forward 2 seconds result: ${seekForwardResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
            log(`Behind live point by: ${seekForwardResult.behindLive?.toFixed(1) || 'unknown'} seconds`);
            
            // Resume playback
            const resumeResult = playerEngine.resumePlayback();
            log(`Resume result: ${resumeResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
            log(`Behind live point by: ${resumeResult.behindLive?.toFixed(1) || 'unknown'} seconds`);
            
            // Play for a bit longer
            log('Playing for 5 more seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Stop playback
            const stopResult = await playerEngine.stopPlayback();
            log(`Stop playback result: ${stopResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        } catch (error) {
            log(`Error during time-shifting test: ${error.message}`, 'error');
        }
        
        // Test 3: Scheduled recording
        log('\n4. Testing scheduled recording...');
        try {
            // Schedule a recording to start in 5 seconds
            const testChannel = channels[Math.min(1, channels.length - 1)];
            const startTime = new Date(Date.now() + 5000); // 5 seconds from now
            const durationMinutes = 0.2; // 12 seconds
            
            log(`Scheduling recording of ${testChannel.title} to start at ${startTime.toISOString()} for ${durationMinutes} minutes`);
            
            const scheduleResult = await recordingScheduler.scheduleRecording(
                testChannel.id,
                startTime,
                durationMinutes,
                `Test Recording ${new Date().toISOString()}`
            );
            
            log(`Schedule result ID: ${scheduleResult.id}`);
            log('Waiting for scheduled recording to start and complete...');
            
            // Wait enough time for recording to start and finish (5 seconds + duration + 5 seconds buffer)
            const waitTime = 5000 + (durationMinutes * 60 * 1000) + 5000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Check scheduled recordings
            const recordings = recordingScheduler.getAllScheduledRecordings();
            const recording = recordings.find(r => r.id === scheduleResult.id);
            
            if (recording) {
                log(`Recording status: ${recording.status}`);
                log(`Recording status check: ${recording.status === 'completed' ? 'PASSED ✅' : 'FAILED ❌'}`);
            } else {
                log('Could not find the scheduled recording in list: FAILED ❌');
            }
        } catch (error) {
            log(`Error during scheduled recording test: ${error.message}`, 'error');
        }
        
        log('\n=== DVR Features Test Complete ===');
    } catch (error) {
        log(`Error during tests: ${error.message}`, 'error');
    }
}

// Clear log file before starting
if (fs.existsSync(TEST_LOG_FILE)) {
    fs.unlinkSync(TEST_LOG_FILE);
}

// Run the tests
runTests();

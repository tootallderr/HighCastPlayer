/**
 * Player Engine Troubleshooting Script
 * 
 * This script specifically diagnoses and helps fix the "currentStreamInfo is not defined" error
 */

const fs = require('fs');
const path = require('path');

// Find the user data path based on platform
function getUserDataPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, 'iptv-player');
  } else if (process.platform === 'darwin') {
    return path.join(process.env.HOME, 'Library', 'Application Support', 'iptv-player');
  } else {
    return path.join(process.env.HOME, '.iptv-player');
  }
}

// Paths
const USER_DATA_PATH = getUserDataPath();
const LOGS_DIR = path.join(USER_DATA_PATH, 'logs');
const PLAYER_LOG = path.join(LOGS_DIR, 'player.log');
const REPORT_FILE = path.join(LOGS_DIR, 'player-troubleshoot-report.log');

// Create/clear report file
fs.writeFileSync(REPORT_FILE, `IPTV Player Engine Troubleshooting Report\nGenerated: ${new Date().toISOString()}\n\n`);

/**
 * Log function to console and report file
 * @param {string} message - The message to log
 */
function log(message) {
  console.log(message);
  fs.appendFileSync(REPORT_FILE, message + '\n');
}

/**
 * Analyze player log for currentStreamInfo errors
 */
function analyzePlayerLog() {
  log('Analyzing player log for stream info errors...');
  
  if (!fs.existsSync(PLAYER_LOG)) {
    log('❌ Player log not found at: ' + PLAYER_LOG);
    return;
  }
  
  try {
    const content = fs.readFileSync(PLAYER_LOG, 'utf8');
    const lines = content.split('\n');
    
    log(`Found ${lines.length} log entries`);
    
    // Find stream info errors
    const streamInfoErrors = lines.filter(line => 
      line.includes('currentStreamInfo is not defined')
    );
    
    if (streamInfoErrors.length > 0) {
      log(`\n🚨 Found ${streamInfoErrors.length} references to "currentStreamInfo is not defined"`);
      
      // Show the most recent errors
      log('\nMost recent occurrences:');
      streamInfoErrors.slice(-5).forEach(line => {
        log(`  - ${line}`);
      });
      
      // Check for actions that precede the errors
      let errorActions = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('currentStreamInfo is not defined')) {
          // Look at up to 5 lines before the error
          for (let j = Math.max(0, i-5); j < i; j++) {
            errorActions.push(lines[j]);
          }
        }
      }
      
      // Look for patterns in actions that precede errors
      const commonActions = {
        'Getting playback info': 0,
        'Playing channel': 0,
        'Stopping playback': 0,
        'Updating playback quality': 0
      };
      
      errorActions.forEach(line => {
        if (line.includes('Getting playback info')) commonActions['Getting playback info']++;
        if (line.includes('Playing channel')) commonActions['Playing channel']++;
        if (line.includes('Stopping playback')) commonActions['Stopping playback']++;
        if (line.includes('Updating playback quality')) commonActions['Updating playback quality']++;
      });
      
      // Report common actions
      log('\nActions that frequently precede errors:');
      Object.entries(commonActions)
        .sort((a, b) => b[1] - a[1])
        .forEach(([action, count]) => {
          if (count > 0) {
            log(`  - ${action}: ${count} occurrences`);
          }
        });
    } else {
      log('\n✅ No "currentStreamInfo is not defined" errors found! The fix appears to be working.');
    }
  } catch (error) {
    log(`❌ Error analyzing player log: ${error.message}`);
  }
}

/**
 * Check if player-engine.js has the proper fix
 */
function checkPlayerEngineFile() {
  log('\nChecking player-engine.js for proper implementation...');
  
  const playerEnginePath = path.join(process.cwd(), 'src', 'player-engine.js');
  
  if (!fs.existsSync(playerEnginePath)) {
    log('❌ player-engine.js not found at: ' + playerEnginePath);
    return false;
  }
  
  try {
    const content = fs.readFileSync(playerEnginePath, 'utf8');
    
    // Check if currentStreamInfo is defined at module level
    const hasGlobalDefinition = /let\s+currentStreamInfo\s*=/.test(content);
    log(`- Global currentStreamInfo definition: ${hasGlobalDefinition ? '✅ Found' : '❌ Missing'}`);
    
    // Check for null check inside getPlaybackInfo
    const hasNullCheck = content.includes('if (!currentStreamInfo)') && 
                        content.includes('currentStreamInfo is not defined') &&
                        /function\s+getPlaybackInfo/.test(content);
    log(`- Null check inside getPlaybackInfo: ${hasNullCheck ? '✅ Found' : '❌ Missing'}`);
    
    // Check if there's a stray code block outside a function
    const hasStrayCode = /}\s*\/\/[\s\S]*if\s*\(\s*!currentStreamInfo\s*\)/.test(content);
    log(`- Stray code block outside function: ${hasStrayCode ? '❌ Found (bug)' : '✅ Not found (good)'}`);
    
    // Check if updatePlaybackQuality updates currentStreamInfo
    const updatesStreamInfo = content.includes('currentStreamInfo = {') ||
                             content.includes('currentStreamInfo.resolution =') ||
                             content.includes('currentStreamInfo = quality');
    log(`- Updates to currentStreamInfo: ${updatesStreamInfo ? '✅ Found' : '⚠️ May be missing'}`);
    
    return hasGlobalDefinition && hasNullCheck && !hasStrayCode;
  } catch (error) {
    log(`❌ Error checking player-engine.js: ${error.message}`);
    return false;
  }
}

/**
 * Recommend fixes based on analysis
 */
function recommendFixes(isFixed) {
  log('\nRecommendations:');
  
  if (isFixed) {
    log('✅ The player-engine.js file appears to have the proper fixes for currentStreamInfo.');
    log('If you are still experiencing issues:');
    log('1. Make sure to restart the application after changes');
    log('2. Check if any other modules are trying to access currentStreamInfo without checks');
    log('3. Verify that stream info is being properly populated when a channel starts playing');
  } else {
    log('❌ Issues were found in player-engine.js. Apply these fixes:');
    log('1. Ensure currentStreamInfo is defined at the module level:');
    log('   ```javascript');
    log('   // Add near the top with other state variables');
    log('   let currentStreamInfo = null;');
    log('   ```');
    
    log('\n2. Ensure getPlaybackInfo has the null check INSIDE the function:');
    log('   ```javascript');
    log('   function getPlaybackInfo() {');
    log('     if (!currentChannel) {');
    log('       return { success: false, error: \'No channel playing\' };');
    log('     }');
    log('     ');
    log('     if (!currentStreamInfo) {');
    log('       log(\'currentStreamInfo is not defined, returning safe default\', \'warn\');');
    log('       return {');
    log('         success: true,');
    log('         channel: currentChannel ? currentChannel.title : \'Unknown\',');
    log('         quality: \'Unknown\',');
    log('         bitrate: 0,');
    log('         codec: \'Unknown\',');
    log('         isLive: false');
    log('       };');
    log('     }');
    log('     // Rest of the function...');
    log('   }');
    log('   ```');
    
    log('\n3. Remove any stray currentStreamInfo checks that are outside of functions');
  }
}

/**
 * Run tests to verify fix
 */
function runVerificationTests() {
  log('\nRunning verification tests...');
  
  try {
    // Try to import the player engine module
    const playerEnginePath = path.join(process.cwd(), 'src', 'player-engine.js');
    const playerEngine = require(playerEnginePath);
    
    // Test calling getPlaybackInfo without initialization
    try {
      const result = playerEngine.getPlaybackInfo();
      log(`- Test getPlaybackInfo without channel: ${result.success === false ? '✅ Passed' : '❌ Failed'}`);
    } catch (error) {
      log(`- Test getPlaybackInfo without channel: ❌ Failed with error: ${error.message}`);
    }
    
    log(`\nVerification complete. See full report at: ${REPORT_FILE}`);
  } catch (error) {
    log(`❌ Error during verification: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  log('=== IPTV Player Engine Troubleshooting ===');
  log(`Date: ${new Date().toISOString()}`);
  log(`Platform: ${process.platform}`);
  log(`User Data: ${USER_DATA_PATH}`);
  log(`Log File: ${PLAYER_LOG}`);
  log('');
  
  analyzePlayerLog();
  const isFixed = checkPlayerEngineFile();
  recommendFixes(isFixed);
  if (isFixed) {
    runVerificationTests();
  }
  
  log('\nTroubleshooting complete! Report saved to:');
  log(REPORT_FILE);
}

// Run the main function
main().catch(error => {
  log(`Error: ${error.message}`);
});

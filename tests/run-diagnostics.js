/**
 * IPTV Player Diagnostic Runner
 * 
 * This script runs all diagnostic tests for the IPTV Player application.
 * It can run individual tests or all tests based on command-line arguments.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// Define paths
const LOG_DIR = path.join(__dirname);
const DIAGNOSTIC_LOG = path.join(LOG_DIR, 'diagnostic_run.log');

// Available tests
const TESTS = {
  player: {
    name: 'Player Engine Tests',
    script: 'test-player-engine.js',
    description: 'Tests core video playback functionality'
  },
  playlist: {
    name: 'Playlist Manager Tests',
    script: 'test-playlist-manager.js',
    description: 'Tests playlist loading, merging, and management'
  },
  dvr: {
    name: 'DVR Feature Tests',
    script: 'test-dvr-features.js',
    description: 'Tests recording and time-shifting capabilities'
  },
  scheduler: {
    name: 'Recording Scheduler Tests',
    script: 'test-recording-scheduler.js',
    description: 'Tests scheduling and executing recordings'
  },
  settings: {
    name: 'Settings Tests',
    script: 'test-settings.js',
    description: 'Tests configuration management'
  },
  ui: {
    name: 'UI Enhancement Tests',
    script: 'test-ui-enhancements.js',
    description: 'Tests EPG, search, and metadata overlay'
  },
  verify: {
    name: 'Cross-Platform Verification',
    script: 'verification.js',
    description: 'Verifies platform-specific functionality'
  },
  performance: {
    name: 'Performance Monitoring',
    script: 'monitor-performance.js',
    description: 'Monitors application performance metrics'
  },
  error: {
    name: 'Error Analysis',
    script: 'analyze-errors.js',
    description: 'Analyzes application error logs'
  },
  crash: {
    name: 'Crash Handler Tests',
    script: 'crash-handler.js',
    description: 'Tests crash recovery mechanisms'
  },
  sample: {
    name: 'Sample Channels Generator',
    script: 'generate-sample-channels.js',
    description: 'Generates test channels for the application'
  }
};

// Initialize log file
function initLog() {
  const timestamp = new Date().toISOString();
  const header = 
`=================================================
IPTV Player Diagnostic Run - ${timestamp}
=================================================
`;
  fs.writeFileSync(DIAGNOSTIC_LOG, header);
}

// Log message to console and log file
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  fs.appendFileSync(DIAGNOSTIC_LOG, logMessage + '\n');
}

// Run a single test
async function runTest(testKey) {
  const test = TESTS[testKey];
  if (!test) {
    log(`Unknown test: ${testKey}`, 'ERROR');
    return false;
  }
  
  const scriptPath = path.join(__dirname, test.script);
  if (!fs.existsSync(scriptPath)) {
    log(`Test script not found: ${scriptPath}`, 'ERROR');
    return false;
  }
  
  log(`Running test: ${test.name} - ${test.description}`);
  
  try {
    const start = Date.now();
    const { stdout, stderr } = await exec(`node "${scriptPath}"`);
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    log(`Test completed in ${duration}s`);
    
    if (stderr) {
      log(`Errors detected:\n${stderr}`, 'WARNING');
      return false;
    }
    
    // Look for pass/fail indicators in output
    if (stdout.includes('FAILED') || stdout.toLowerCase().includes('error')) {
      log(`Test completed with issues`, 'WARNING');
      return false;
    }
    
    log(`Test passed successfully`);
    return true;
  } catch (error) {
    log(`Error running test: ${error.message}`, 'ERROR');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  log('Starting comprehensive diagnostic run');
  
  const results = {};
  const startTime = Date.now();
  
  // Run tests sequentially to avoid interference
  for (const [key, test] of Object.entries(TESTS)) {
    log(`\n--- Running ${test.name} ---`);
    results[key] = await runTest(key);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\nAll tests completed in ${totalTime}s`);
  
  // Summary
  let passed = 0;
  let failed = 0;
  
  log('\n=== Test Summary ===');
  for (const [key, result] of Object.entries(results)) {
    const status = result ? 'PASSED' : 'FAILED';
    const symbol = result ? '✅' : '❌';
    log(`${symbol} ${TESTS[key].name}: ${status}`);
    
    if (result) passed++;
    else failed++;
  }
  
  log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Show help
function showHelp() {
  console.log('IPTV Player Diagnostic Tool');
  console.log('\nUsage:');
  console.log('  node run-diagnostics.js [options] [test-name]');
  console.log('\nOptions:');
  console.log('  --all       Run all tests');
  console.log('  --help      Show this help');
  console.log('\nAvailable tests:');
  
  for (const [key, test] of Object.entries(TESTS)) {
    console.log(`  ${key.padEnd(10)} ${test.name} - ${test.description}`);
  }
}

// Parse command-line arguments and run appropriate tests
async function main() {
  const args = process.argv.slice(2);
  
  // Initialize log
  initLog();
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  // Run all tests if requested
  if (args.includes('--all') || args.includes('-a')) {
    await runAllTests();
    return;
  }
  
  // Run specified test
  if (args.length > 0) {
    const testKey = args[0];
    if (TESTS[testKey]) {
      await runTest(testKey);
    } else {
      log(`Unknown test: ${testKey}`, 'ERROR');
      showHelp();
    }
    return;
  }
  
  // No arguments, show help
  showHelp();
}

// Run the script
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'ERROR');
  process.exit(1);
});
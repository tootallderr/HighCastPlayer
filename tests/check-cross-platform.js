/**
 * Cross-Platform Testing Script
 * 
 * This script tests platform-specific features and ensures that the application
 * correctly detects platform, provides correct paths, and manages dependencies
 * appropriately for the current operating system.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const platform = require('../src/platform');
const pathManager = require('../src/path-manager');
const depCheck = require('../src/dependency-check-improved');

// Create a log file for the test
const LOG_FILE = path.join(__dirname, 'cross-platform-test.log');

// Clear log file
fs.writeFileSync(LOG_FILE, '', 'utf8');

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n', 'utf8');
}

// Log separator
function separator() {
  log('='.repeat(50));
}

// Check if a path exists and is accessible
function checkPath(pathName, pathFn) {
  try {
    const fullPath = pathFn();
    const exists = fs.existsSync(fullPath);
    log(`${pathName}: ${exists ? '✅ EXISTS' : '❌ MISSING'} - ${fullPath}`);
    
    // Check if writable
    if (exists) {
      try {
        const testFile = path.join(fullPath, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        log(`${pathName}: ✅ WRITABLE`);
      } catch (error) {
        log(`${pathName}: ❌ NOT WRITABLE - ${error.message}`);
      }
    }
  } catch (error) {
    log(`${pathName}: ❌ ERROR - ${error.message}`);
  }
}

// Main test function
async function runCrossPlatformTests() {
  separator();
  log('CROSS-PLATFORM COMPATIBILITY TEST');
  log(`Testing on ${process.platform} platform`);
  separator();
  
  // 1. Test platform detection
  log('1. PLATFORM DETECTION');
  log(`Platform: ${platform.isWindows ? 'Windows' : platform.isMacOS ? 'macOS' : 'Linux'}`);
  log(`OS details: ${JSON.stringify(platform.getOSInfo(), null, 2)}`);
  log(`Path separator: ${platform.pathSep}`);
  log(`Scheduler type: ${platform.getSchedulerType()}`);
  
  separator();
  
  // 2. Test path handling
  log('2. PATH HANDLING');
  checkPath('App root path', pathManager.getAppRootPath);
  checkPath('User data path', pathManager.getUserDataPath);
  checkPath('Data directory', pathManager.getDataDir);
  checkPath('Playlists directory', pathManager.getPlaylistsDir);
  checkPath('Recordings directory', pathManager.getRecordingsDir);
  checkPath('Logs directory', pathManager.getLogsDir);
  checkPath('Cache directory', pathManager.getCacheDir);
  
  // Test file paths
  log(`Settings path: ${pathManager.getSettingsPath()}`);
  log(`Sources path: ${pathManager.getSourcesPath()}`);
  log(`Merged playlist path: ${pathManager.getMergedPlaylistPath()}`);
  
  separator();
  
  // 3. Test dependency checking
  log('3. DEPENDENCY VERIFICATION');
  const depResults = depCheck.checkAllDependencies();
  log(`Dependency check success: ${depResults.success ? '✅ YES' : '❌ NO'}`);
  log(`Critical issues: ${depResults.criticalIssues}`);
  log(`Missing critical dependencies: ${depResults.missingCritical.join(', ') || 'None'}`);
  log(`Has optional issues: ${depResults.hasOptionalIssues ? 'Yes' : 'No'}`);
  
  // Log details of dependency check
  log('Dependency details:');
  Object.entries(depResults.results).forEach(([key, value]) => {
    if (key !== 'uiRuntimes' && typeof value !== 'object') {
      log(`- ${key}: ${value ? '✅ INSTALLED' : '❌ MISSING'}`);
    }
  });
  
  // Check UI runtimes
  log(`Available UI runtimes: ${depResults.results.uiRuntimes.join(', ')}`);
  
  separator();
  
  // 4. Test platform-specific features
  log('4. PLATFORM-SPECIFIC FEATURES');
  
  if (platform.isWindows) {
    // Windows-specific tests
    log('Testing Windows-specific features:');
    
    try {
      const hasTaskScheduler = platform.commandExists('schtasks');
      log(`Windows Task Scheduler: ${hasTaskScheduler ? '✅ AVAILABLE' : '❌ MISSING'}`);
    } catch (err) {
      log(`Windows Task Scheduler test error: ${err.message}`);
    }
    
  } else if (platform.isMacOS) {
    // macOS-specific tests
    log('Testing macOS-specific features:');
    
    try {
      const hasCron = platform.commandExists('crontab');
      log(`Cron: ${hasCron ? '✅ AVAILABLE' : '❌ MISSING'}`);
      
      const hasLaunchctl = platform.commandExists('launchctl');
      log(`Launchctl: ${hasLaunchctl ? '✅ AVAILABLE' : '❌ MISSING'}`);
    } catch (err) {
      log(`macOS feature test error: ${err.message}`);
    }
    
  } else if (platform.isLinux) {
    // Linux-specific tests
    log('Testing Linux-specific features:');
    
    try {
      const hasCron = platform.commandExists('crontab');
      log(`Cron: ${hasCron ? '✅ AVAILABLE' : '❌ MISSING'}`);
      
      const hasSystemd = fs.existsSync('/run/systemd/system');
      log(`Systemd: ${hasSystemd ? '✅ AVAILABLE' : '❌ MISSING'}`);
    } catch (err) {
      log(`Linux feature test error: ${err.message}`);
    }
  }
  
  separator();
  log('CROSS-PLATFORM TEST COMPLETED');
  log(`Results saved to: ${LOG_FILE}`);
  separator();
}

// Run tests
runCrossPlatformTests().catch(error => {
  log(`TEST ERROR: ${error.message}`);
  log(error.stack);
});
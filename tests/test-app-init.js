/**
 * Test App Initialization
 * 
 * This script tests the application initialization process
 * without actually launching the full UI. It specifically tests
 * the dependency verification and setup code.
 */

const path = require('path');
const fs = require('fs');
const dependencyCheck = require('../src/dependency-check-improved');
const platform = require('../src/platform');

// We need to mock app first since pathManager requires it
const electron = { app: { 
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(__dirname, '..', 'test-userdata');
    }
    return path.join(__dirname, '..');
  },
  isPackaged: false
}};

global.app = electron.app;

// Now require path manager with our mock
const pathManager = require('../src/path-manager');

// Mock app methods if needed
global.mockApp = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(__dirname, '..', 'test-userdata');
    }
    return path.join(__dirname, '..');
  }
};

// Initialize data directories
function initAppDirectories() {
  try {
    // Essential directories
    const userData = path.join(__dirname, '..', 'test-userdata');
    const dirs = [
      path.join(userData, 'data'),
      path.join(userData, 'data/playlists'),
      path.join(userData, 'data/recordings'),
      path.join(userData, 'logs'),
      path.join(userData, 'cache')
    ];
      
    // Create each directory if it doesn't exist
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`Created directory: ${dir}`);
        } catch (err) {
          console.error(`Failed to create directory ${dir}: ${err.message}`);
        }
      }
    });
  
    // Create test files
    const settingsPath = path.join(userData, 'data', 'settings.json');
    const sourcesPath = path.join(userData, 'data', 'sources.json');
    
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, '{}', 'utf8');
      console.log('Created empty settings file');
    }
    
    if (!fs.existsSync(sourcesPath)) {
      fs.writeFileSync(sourcesPath, '{"remote":[],"local":[]}', 'utf8');
      console.log('Created empty sources file');
    }

    console.log('All test directories initialized successfully');
    return true;
  } catch (error) {
    console.error(`Error initializing directories: ${error.message}`);
    return false;
  }
}

// Mock initialization process
async function testInitializeApp() {
  console.log('='.repeat(50));
  console.log('Testing Application Initialization');
  console.log('='.repeat(50));
  
  console.log(`\nRunning on ${platform.isWindows ? 'Windows' : platform.isMacOS ? 'macOS' : 'Linux'} platform`);
  
  // Initialize test directories
  console.log('\nInitializing test directories...');
  const dirsInitialized = initAppDirectories();
  console.log(dirsInitialized ? 'Directories initialized ✅' : 'Directory initialization failed ❌');
  
  // Run dependency check
  console.log('\nRunning dependency check...');
  const dependencyResult = dependencyCheck.checkAllDependencies();
  
  console.log(`Dependency check success: ${dependencyResult.success ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Critical issues: ${dependencyResult.criticalIssues}`);
  
  if (dependencyResult.missingCritical && dependencyResult.missingCritical.length > 0) {
    console.log(`Missing critical dependencies: ${dependencyResult.missingCritical.join(', ')}`);
  }
  
  // Test path manager functions
  console.log('\nTesting path functions...');
  
  try {
    const dataDir = pathManager.getDataDir();
    console.log(`Data directory: ${dataDir} ✅`);
    
    const playlistsDir = pathManager.getPlaylistsDir();
    console.log(`Playlists directory: ${playlistsDir} ✅`);
    
    const recordingsDir = pathManager.getRecordingsDir();
    console.log(`Recordings directory: ${recordingsDir} ✅`);
    
    const logsDir = pathManager.getLogsDir();
    console.log(`Logs directory: ${logsDir} ✅`);
    
    const cacheDir = pathManager.getCacheDir();
    console.log(`Cache directory: ${cacheDir} ✅`);
  } catch (error) {
    console.error(`Path function error: ${error.message} ❌`);
  }
  
  console.log('\n='.repeat(50));
  console.log('Initialization Test Completed');
  console.log('='.repeat(50));
}

// Run the test
testInitializeApp().catch(error => {
  console.error(`Test failed with error: ${error.message}`);
  console.error(error.stack);
});

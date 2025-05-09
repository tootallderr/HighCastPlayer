/**
 * Package Build Verification Tests
 * 
 * This script verifies that the packaged application runs correctly
 * and can access all necessary resources.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { app } = require('electron');
const log = require('electron-log');

// Test log path
const logFile = path.join(__dirname, 'package_verification.log');

// Logging function
function logMessage(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  // Also log to console
  console.log(logEntry);
  
  // Write to log file
  fs.appendFileSync(logFile, logEntry);
}

// Clear log file
fs.writeFileSync(logFile, '');

// Start tests
logMessage('Starting package verification tests');
logMessage(`App version: ${app.getVersion()}`);
logMessage(`Platform: ${process.platform}`);
logMessage(`Architecture: ${process.arch}`);
logMessage(`Electron: ${process.versions.electron}`);
logMessage(`Node.js: ${process.versions.node}`);

/**
 * Test access to bundled dependencies
 */
async function testBundledDependencies() {
  logMessage('Testing access to bundled dependencies...');
  
  try {
    // Check ffmpeg
    const ffmpegModule = require('ffmpeg-static');
    logMessage(`Found ffmpeg at: ${ffmpegModule}`);
    
    // Verify the file exists
    if (fs.existsSync(ffmpegModule)) {
      logMessage('ffmpeg binary exists', 'success');
      
      // Try executing ffmpeg to verify permissions
      try {
        const output = execSync(`"${ffmpegModule}" -version`).toString();
        logMessage(`ffmpeg version check successful: ${output.split('\n')[0]}`);
      } catch (err) {
        logMessage(`Failed to execute ffmpeg: ${err.message}`, 'error');
      }
    } else {
      logMessage('ffmpeg binary not found!', 'error');
    }
    
    // Test HLS.js
    try {
      const Hls = require('hls.js');
      logMessage(`HLS.js version: ${Hls.version}`);
    } catch (err) {
      logMessage(`Failed to load HLS.js: ${err.message}`, 'error');
    }
    
  } catch (err) {
    logMessage(`Failed to test bundled dependencies: ${err.message}`, 'error');
  }
}

/**
 * Test data directories
 */
async function testDataDirectories() {
  logMessage('Testing data directories...');
  
  const dataDir = path.join(app.getPath('userData'), 'data');
  const requiredDirs = [
    '',
    'playlists',
    'recordings'
  ];
  
  for (const dir of requiredDirs) {
    const fullPath = path.join(dataDir, dir);
    
    try {
      // Ensure directory exists
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        logMessage(`Created missing directory: ${fullPath}`);
      }
      
      // Test write access
      const testFile = path.join(fullPath, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      logMessage(`Directory access OK: ${fullPath}`);
    } catch (err) {
      logMessage(`Failed to access directory ${fullPath}: ${err.message}`, 'error');
    }
  }
}

/**
 * Test configuration files
 */
async function testConfigurationFiles() {
  logMessage('Testing configuration files...');
  
  const configFiles = [
    { name: 'settings.json', template: { bufferSize: 60, updateFrequency: 60 } },
    { name: 'sources.json', template: { sources: [] } }
  ];
  
  const dataDir = path.join(app.getPath('userData'), 'data');
  
  for (const config of configFiles) {
    const filePath = path.join(dataDir, config.name);
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // Create default file
        fs.writeFileSync(filePath, JSON.stringify(config.template, null, 2));
        logMessage(`Created default ${config.name}`);
      } else {
        // Verify it's valid JSON
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        logMessage(`${config.name} is valid JSON`);
      }
    } catch (err) {
      logMessage(`Error with ${config.name}: ${err.message}`, 'error');
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    await testBundledDependencies();
    await testDataDirectories();
    await testConfigurationFiles();
    
    logMessage('All tests completed');
  } catch (err) {
    logMessage(`Test execution failed: ${err.message}`, 'error');
  }
}

// Run all tests
runAllTests().catch(err => {
  logMessage(`Fatal error: ${err.message}`, 'error');
});

module.exports = {
  runAllTests
};

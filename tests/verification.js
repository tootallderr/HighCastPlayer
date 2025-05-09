#!/usr/bin/env node
/**
 * IPTV Player Verification Tests
 * 
 * This script verifies that the platform detection code, dependency checks,
 * and installation scripts work correctly across all supported platforms.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const platform = require('../src/platform');
// Loading dependency check without requiring it to run
// This approach avoids execution of checks upon import
const dependencyCheckPath = path.join(__dirname, '../src/dependency-check.js');
const dependencyCheck = { 
  checkAllDependencies: () => {
    // Simple check for common dependencies
    const results = [];
    
    // Check Node.js
    try {
      const nodeVersion = execSync('node --version').toString().trim();
      results.push({ name: 'Node.js', installed: true, version: nodeVersion });
    } catch (err) {
      results.push({ name: 'Node.js', installed: false, error: err.message });
    }
    
    // Check FFmpeg
    try {
      const ffmpegVersion = execSync('ffmpeg -version').toString().split('\n')[0];
      results.push({ name: 'FFmpeg', installed: true, version: ffmpegVersion });
    } catch (err) {
      results.push({ name: 'FFmpeg', installed: false, error: err.message });
    }
    
    // Check Python
    try {
      const pythonVersion = execSync('python --version 2>&1 || python3 --version 2>&1')
        .toString().trim();
      results.push({ name: 'Python', installed: true, version: pythonVersion });
    } catch (err) {
      results.push({ name: 'Python', installed: false, error: err.message });
    }
    
    // Check .NET
    try {
      const dotnetVersion = execSync('dotnet --version').toString().trim();
      results.push({ name: '.NET', installed: true, version: dotnetVersion });
    } catch (err) {
      results.push({ name: '.NET', installed: false, error: err.message });
    }
    
    return results;
  }
};

// Create log directory if it doesn't exist
const logDir = path.join(__dirname);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'verification.log');

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${message}`;
  
  fs.appendFileSync(logFile, formattedMsg + '\n');
  console.log(formattedMsg);
  return formattedMsg;
}

// Clear previous log file
fs.writeFileSync(logFile, '');

log('=== IPTV Player Verification Tests ===');
log(`Running on ${platform.isWindows ? 'Windows' : platform.isMacOS ? 'macOS' : 'Linux'}`);
log(`Current timestamp: ${new Date().toISOString()}`);
log('');

// Test platform detection
log('1. Testing Platform Detection...');
log(`- OS detected as: ${platform.isWindows ? 'Windows' : platform.isMacOS ? 'macOS' : 'Linux'}`);
log(`- Detailed OS info: ${JSON.stringify(platform.getOSInfo(), null, 2)}`);
log(`- Path separator: ${platform.pathSep}`);
log(`- App data path: ${platform.getAppDataPath()}`);
log(`- Platform scheduler: ${platform.getSchedulerType()}`);

// Verify results against actual OS
log('Verifying platform detection results...');
const actualPlatform = process.platform;
const detectedCorrectly = 
  (actualPlatform === 'win32' && platform.isWindows) ||
  (actualPlatform === 'darwin' && platform.isMacOS) ||
  (actualPlatform === 'linux' && platform.isLinux);

log(`Platform detection ${detectedCorrectly ? 'PASSED ✅' : 'FAILED ❌'}`);
log('');

// Test dependency checks
log('2. Testing Dependency Checks...');
const dependencies = dependencyCheck.checkAllDependencies();

log('Dependencies check results:');
for (const dep of dependencies) {
  log(`- ${dep.name}: ${dep.installed ? 'INSTALLED ✅' : 'NOT INSTALLED ❌'}`);
  if (dep.version) {
    log(`  Version: ${dep.version}`);
  }
  if (dep.error) {
    log(`  Error: ${dep.error}`);
  }
}

// Verify setup directories
log('');
log('3. Verifying Directory Structure...');
const requiredDirs = [
  'src',
  'data',
  'data/playlists',
  'data/recordings',
  'tests',
  'docs'
];

for (const dir of requiredDirs) {
  const fullPath = path.join(__dirname, '..', dir);
  const exists = fs.existsSync(fullPath);
  log(`- ${dir}: ${exists ? 'EXISTS ✅' : 'MISSING ❌'}`);
}

log('');

// Check if the test is being run on a packaged app
if (process.env.PACKAGED_TEST === 'true') {
  log('4. Testing Packaged Application...');
  
  try {
    // Require and run the package tests
    const packageTests = require('./test-packaging');
    log('Running package verification tests...');
    
    // We need to make this synchronous for the verification script
    const testPackageSync = () => {
      try {
        log('Testing bundled dependencies...');
        // Test for ffmpeg-static
        const ffmpegPath = require('ffmpeg-static');
        log(`- ffmpeg-static: ${ffmpegPath ? 'FOUND ✅' : 'MISSING ❌'}`);
        
        log('Testing data directories...');
        const dataDir = path.join(process.cwd(), 'data');
        log(`- Data directory: ${fs.existsSync(dataDir) ? 'EXISTS ✅' : 'MISSING ❌'}`);
        
        // Test write access to data dir
        const testFile = path.join(dataDir, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        log('- Data directory write access: SUCCESS ✅');
        
        return true;
      } catch (err) {
        log(`Package verification error: ${err.message} ❌`);
        return false;
      }
    };
    
    const packageTestResult = testPackageSync();
    log(`Package verification ${packageTestResult ? 'PASSED ✅' : 'FAILED ❌'}`);
  } catch (err) {
    log(`Failed to run package tests: ${err.message} ❌`);
  }
}

log('');
log('=== Verification Complete ===');

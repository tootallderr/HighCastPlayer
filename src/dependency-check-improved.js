/**
 * IPTV Player Dependency Check - Improved Version
 * 
 * This script runs at application launch to verify that all
 * required dependencies are installed and properly configured.
 * It handles optional dependencies gracefully to avoid blocking startup.
 */

const fs = require('fs');
const path = require('path');
const platform = require('./platform');
const { execSync } = require('child_process');
const pathManager = require('./path-manager');

// Logging utility
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  try {
    // Use path manager to ensure logs directory exists
    const logsDir = pathManager.getLogsDir();
    
    // Append to log file
    fs.appendFileSync(
      path.join(logsDir, 'dependency-check.log'),
      logMessage + '\n'
    );
  } catch (error) {
    // Fallback if pathManager fails
    try {
      const fallbackDir = path.join(__dirname, '..', 'tests');
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      fs.appendFileSync(
        path.join(fallbackDir, 'dependency-check.log'),
        logMessage + '\n'
      );
    } catch (fallbackError) {
      // If we can't write to log, at least output to console
      console.error('Failed to write to log file:', fallbackError.message);
    }
  }
  
  // Always output to console if not in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(logMessage);
  }
  
  return logMessage;
}

// Verify a specific dependency
function verifyDependency(name, checkFn, minVersion = null, isCritical = false) {
  try {
    const result = checkFn();
    if (result === false) {
      const level = isCritical ? 'error' : 'warning';
      log(`Dependency ${name} is NOT installed`, level);
      return false;
    }
    
    // If we have a version check
    if (minVersion !== null && typeof result === 'string') {
      const currentVersion = result.trim();
      log(`${name} version: ${currentVersion}`, 'info');
      
      // Simple version comparison (not perfect but works for most cases)
      const current = currentVersion.split('.').map(n => parseInt(n, 10));
      const required = minVersion.split('.').map(n => parseInt(n, 10));
      
      for (let i = 0; i < Math.max(current.length, required.length); i++) {
        const c = current[i] || 0;
        const r = required[i] || 0;
        if (c > r) return true;
        if (c < r) {
          const level = isCritical ? 'error' : 'warning';
          log(`${name} version ${currentVersion} is below required ${minVersion}`, level);
          return false;
        }
      }
    }
    
    log(`Dependency ${name} is installed`, 'info');
    return true;
  } catch (error) {
    const level = isCritical ? 'error' : 'warning';
    log(`Error checking ${name}: ${error.message}`, level);
    return false;
  }
}

// Get version extractors for different dependencies
const versionExtractors = {
  ffmpeg: () => {
    try {
      const output = execSync('ffmpeg -version', { encoding: 'utf8' });
      const match = output.match(/ffmpeg version (\d+\.\d+(\.\d+)?)/i);
      return match ? match[1] : 'unknown';
    } catch (e) {
      return false;
    }
  },
  
  node: () => {
    return process.version.substring(1); // Remove the 'v' prefix
  },
  
  python: () => {
    try {
      // Try python3 first, then python
      try {
        return execSync('python3 --version', { encoding: 'utf8' }).split(' ')[1];
      } catch (e) {
        try {
          return execSync('python --version', { encoding: 'utf8' }).split(' ')[1];
        } catch (e2) {
          log('Python not found, but will continue as it is not critical', 'warning');
          // Return false to indicate Python is not installed but handle it gracefully
          return false;
        }
      }
    } catch (e) {
      log('Error checking Python version: ' + e.message, 'warning');
      return false;
    }
  },
  
  dotnet: () => {
    try {
      const output = execSync('dotnet --version', { encoding: 'utf8' });
      return output.trim();
    } catch (e) {
      return false;
    }
  }
};

// Function to check all dependencies
function checkAllDependencies() {
  log('Starting dependency check', 'info');
  
  // Critical dependencies are required for the app to function
  const results = {};
  
  // Check critical dependencies
  results.ffmpeg = verifyDependency('FFmpeg', versionExtractors.ffmpeg, '4.0', true);
  results.node = verifyDependency('Node.js', versionExtractors.node, '14.0', true);
  
  // Check optional dependencies
  results.python = verifyDependency('Python', versionExtractors.python, '3.7', false);
  results.dotnet = verifyDependency('DotNet', versionExtractors.dotnet, '6.0', false);
  
  // Check for platform-specific tools
  if (platform.isWindows) {
    // Check Task Scheduler
    try {
      execSync('schtasks /query /fo LIST', { stdio: 'ignore' });
      results.taskScheduler = true;
      log('Windows Task Scheduler is available', 'info');
    } catch (e) {
      results.taskScheduler = false;
      log('Windows Task Scheduler is not available', 'warning');
    }
  } else {
    // Check cron on Unix systems
    try {
      if (platform.isMacOS) {
        execSync('launchctl list | grep com.vix.cron', { stdio: 'ignore' });
      } else {
        execSync('systemctl status cron.service', { stdio: 'ignore' });
      }
      results.cron = true;
      log('Cron service is available', 'info');
    } catch (e) {
      results.cron = false;
      log('Cron service is not available', 'warning');
    }
  }
  
  // Check available UI runtimes
  const uiRuntimes = platform.detectUIRuntime();
  log(`Available UI runtimes: ${uiRuntimes.join(', ')}`, 'info');
  results.uiRuntimes = uiRuntimes;
    // Check if data directories exist and are writable (using path manager)
  try {
    // Safely check and call path manager functions if they exist
    const checkPathFunction = (fnName) => {
      if (typeof pathManager[fnName] === 'function') {
        const path = pathManager[fnName]();
        log(`Path ${fnName} verified: ${path}`, 'info');
        return true;
      } else {
        log(`Path manager function ${fnName} not found`, 'warning');
        return false;
      }
    };
    
    // Check all required directory functions
    const dirFunctions = [
      'getDataDir',
      'getPlaylistsDir',
      'getRecordingsDir',
      'getLogsDir',
      'getCacheDir'
    ];
    
    // Verify each directory function
    const dirResults = dirFunctions.map(checkPathFunction);
    
    // Check merged playlist path
    if (typeof pathManager.getMergedPlaylistPath === 'function') {
      pathManager.getMergedPlaylistPath();
      log('Merged playlist path verified', 'info');
    }
    
    // All directories are valid only if all checks passed
    const allDirsValid = dirResults.every(result => result === true);
    
    if (allDirsValid) {
      log('All data directories verified and accessible', 'info');
      results.directories = true;
    } else {
      log('Some data directories could not be verified', 'warning');
      results.directories = false;
    }
  } catch (error) {
    log(`Error verifying data directories: ${error.message}`, 'error');
    results.directories = false;
  }
    // Check for directory-related issues
  const directoryIssue = results.directories === false;
  
  // Count critical issues - FFmpeg, Node.js, and directory access are considered critical
  const criticalIssues = [
    !results.ffmpeg, 
    !results.node,
    directoryIssue
  ].filter(Boolean).length;
  
  // List missing critical dependencies
  const missingCritical = [];
  if (!results.ffmpeg) missingCritical.push('FFmpeg');
  if (!results.node) missingCritical.push('Node.js');
  if (directoryIssue) missingCritical.push('Directory Access');
  
  // Check for optional dependencies issues
  const optionalIssues = {
    python: !results.python,
    dotnet: !results.dotnet,
    scheduler: platform.isWindows ? !results.taskScheduler : !results.cron
  };
  
  // Log summary
  if (criticalIssues > 0) {
    log(`Dependency check completed with ${criticalIssues} critical issues: ${missingCritical.join(', ')}`, 'error');
  } else if (Object.values(optionalIssues).some(Boolean)) {
    log('Dependency check completed with some optional dependencies missing', 'warning');
  } else {
    log('Dependency check completed successfully - all dependencies found', 'info');
  }
  
  return {
    success: criticalIssues === 0,
    results,
    criticalIssues,
    missingCritical,
    optionalIssues,
    hasOptionalIssues: Object.values(optionalIssues).some(Boolean)
  };
}

// If this script is run directly
if (require.main === module) {
  const result = checkAllDependencies();
  console.log('\nDependency Check Results:');
  console.log('------------------------');
  console.log(JSON.stringify(result, null, 2));
  
  if (!result.success) {
    console.log('\n⚠️ Some critical dependencies are missing. Please run the appropriate setup script:');
    console.log('  - Windows: setup.bat');
    console.log('  - macOS/Linux: ./setup.sh');
    console.log('\nSee docs/0-prerequisites.md for manual installation instructions.');
    process.exit(1);
  } else if (result.hasOptionalIssues) {
    console.log('\n⚠️ Some optional dependencies are missing. The application will run with limited functionality.');
    console.log('See docs/0-prerequisites.md for installation instructions.');
  } else {
    console.log('\n✅ All dependencies are installed.');
  }
}

module.exports = { checkAllDependencies };

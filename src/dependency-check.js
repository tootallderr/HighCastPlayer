/**
 * IPTV Player Dependency Check
 * 
 * This script runs at application launch to verify that all
 * required dependencies are installed and properly configured.
 */

const fs = require('fs');
const path = require('path');
const platform = require('./platform');
const { execSync } = require('child_process');

// Logging utility
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Ensure tests directory exists
  if (!fs.existsSync(path.join(__dirname, '..', 'tests'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'tests'), { recursive: true });
  }
  
  // Append to log file
  fs.appendFileSync(
    path.join(__dirname, '..', 'tests', 'dependency-check.log'),
    logMessage + '\n'
  );
  
  // Also output to console if not in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(logMessage);
  }
  
  return logMessage;
}

// Verify a specific dependency
function verifyDependency(name, checkFn, minVersion = null) {
  try {
    const result = checkFn();
    if (result === false) {
      log(`Dependency ${name} is NOT installed`, 'error');
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
          log(`${name} version ${currentVersion} is below required ${minVersion}`, 'warning');
          return false;
        }
      }
    }
    
    log(`Dependency ${name} is installed`, 'info');
    return true;
  } catch (error) {
    log(`Error checking ${name}: ${error.message}`, 'error');
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
          // Return a minimal version to prevent failure in non-critical scenarios
          return '3.7.0';
        }
      }
    } catch (e) {
      log('Error checking Python version: ' + e.message, 'warning');
      // Return a minimal version to prevent failure in non-critical scenarios
      return '3.7.0';
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
  const criticalResults = {
    ffmpeg: verifyDependency('FFmpeg', versionExtractors.ffmpeg, '4.0'),
    node: verifyDependency('Node.js', versionExtractors.node, '14.0')
  };
  
  // Optional dependencies enhance functionality but aren't strictly required
  const optionalResults = {
    python: verifyDependency('Python', versionExtractors.python, '3.7'),
    dotnet: verifyDependency('DotNet', versionExtractors.dotnet, '6.0')
  };
  
  // Combine results
  const results = {
    ...criticalResults,
    ...optionalResults
  };
  
  // Check for platform-specific tools
  if (platform.isWindows) {
    // Check Task Scheduler
    try {
      execSync('schtasks /query /fo LIST', { stdio: 'ignore' });
      results.taskScheduler = true;
      log('Windows Task Scheduler is available', 'info');
    } catch (e) {
      results.taskScheduler = false;
      log('Windows Task Scheduler is not available', 'error');
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
  
  // Check if required directories exist and are writable
  const dirs = ['data', 'data/playlists', 'data/recordings', 'tests', 'docs'];
  results.directories = {};
  
  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    try {
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      
      // Check if writable
      const testFile = path.join(fullPath, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      results.directories[dir] = true;
      log(`Directory ${dir} exists and is writable`, 'info');
    } catch (e) {
      results.directories[dir] = false;
      log(`Directory ${dir} issue: ${e.message}`, 'error');
    }
  });
  
  // Count critical issues
  const criticalIssues = Object.entries(results)
    .filter(([key, value]) => 
      key !== 'directories' && key !== 'uiRuntimes' && value === false
    ).length;
  
  const dirIssues = Object.values(results.directories).filter(v => v === false).length;
  
  log(`Dependency check completed with ${criticalIssues} critical issues and ${dirIssues} directory issues`, 
      criticalIssues + dirIssues > 0 ? 'warning' : 'info');
  
  return {
    success: criticalIssues === 0,
    results,
    criticalIssues,
    dirIssues
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
  } else {
    console.log('\n✅ All critical dependencies are installed.');
  }
}

module.exports = { checkAllDependencies };

/**
 * Platform Detection and Path Handling Utilities
 * 
 * This module provides cross-platform utilities for detecting OS,
 * handling paths, and accessing platform-specific features like schedulers.
 */

const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Platform detection object
 */
const platform = {
  // OS detection
  isWindows: process.platform === 'win32',
  isMacOS: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  
  // Get detailed OS information
  getOSInfo() {
    return {
      platform: process.platform,
      release: os.release(),
      type: os.type(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username
    };
  },
  
  // Get platform-specific path separator
  pathSep: path.sep,
    // Get platform-specific app data directory
  getAppDataPath() {
    if (this.isWindows) {
      return path.join(process.env.APPDATA || '', 'iptv-player');
    } else if (this.isMacOS) {
      return path.join(os.homedir(), 'Library', 'Application Support', 'iptv-player');
    } else {
      // Linux and others
      return path.join(os.homedir(), '.iptv-player');
    }
  },
  
  // Get platform-specific executable extensions
  getExeExtension() {
    return this.isWindows ? '.exe' : '';
  },
    // Get platform-specific scheduler type
  getSchedulerType() {
    if (this.isWindows) {
      return 'taskschd';
    } else {
      return 'cron';
    }
  },  // Check if a command exists in PATH
  commandExists(command) {
    try {
      if (this.isWindows) {
        execSync(`where ${command}`, { stdio: 'ignore' });
      } else {
        execSync(`which ${command}`, { stdio: 'ignore' });
      }
      return true;
    } catch (e) {
      return false;
    }
  },
  
  // Check if FFmpeg is available
  hasFFmpeg() {
    // First, check app bundle location
    if (this.isWindows) {
      const bundledPath = path.join(process.env.APPDATA, 'iptv-player', 'bin', 'ffmpeg.exe');
      if (fs.existsSync(bundledPath)) {
        return true;
      }
    } else if (this.isMacOS) {
      const bundledPath = path.join(this.getAppDataPath(), 'bin', 'ffmpeg');
      if (fs.existsSync(bundledPath)) {
        return true;
      }
    } else if (this.isLinux) {
      const bundledPath = path.join(this.getAppDataPath(), 'bin', 'ffmpeg');
      if (fs.existsSync(bundledPath)) {
        return true;
      }
    }
    
    // Then check PATH
    return this.commandExists('ffmpeg');
  },
  
  // Get platform-specific scheduler command
  getSchedulerCommand(taskName, scriptPath, schedule = '0 * * * *') {
    if (this.isWindows) {
      // Windows Task Scheduler
      return `schtasks /create /tn "${taskName}" /tr "${scriptPath}" /sc hourly /f`;
    } else if (this.isMacOS || this.isLinux) {
      // cron for macOS and Linux
      const cronEntry = `${schedule} ${scriptPath}`;
      const cronCmd = `(crontab -l 2>/dev/null || echo "") | grep -v "${taskName}" | echo "${cronEntry} # ${taskName}" | crontab -`;
      return cronCmd;
    } else {
      throw new Error('Unsupported platform for scheduling tasks');
    }
  },
  
  // Convert path to platform-specific format
  normalizePath(inputPath) {
    return path.normalize(inputPath);
  },
  
  // Get absolute path from relative path
  getAbsolutePath(relativePath) {
    return path.resolve(relativePath);
  },
  
  // Get user home directory
  getHomeDir() {
    return os.homedir();
  },
  
  // Check if ffmpeg is installed
  hasFFmpeg() {
    return this.commandExists('ffmpeg');
  },
  
  // Check required dependencies
  checkDependencies() {
    const dependencies = {
      ffmpeg: this.commandExists('ffmpeg'),
      node: true, // If this code is running, Node.js is available
      python: this.commandExists('python') || this.commandExists('python3'),
      dotnet: this.commandExists('dotnet')
    };
    
    return dependencies;
  },
  
  // Create platform-specific directory if it doesn't exist
  ensureDirectoryExists(dirPath) {
    const normalizedPath = this.normalizePath(dirPath);
    if (!fs.existsSync(normalizedPath)) {
      fs.mkdirSync(normalizedPath, { recursive: true });
    }
    return normalizedPath;
  },
  
  // Get the best available UI runtime for the current platform
  detectUIRuntime() {
    const runtimes = [];
    
    // Check for Electron
    try {
      require.resolve('electron');
      runtimes.push('electron');
    } catch (e) {
      // Electron not installed
    }
    
    // Check for Python (for PyQt)
    if (this.commandExists('python') || this.commandExists('python3')) {
      if (this.commandExists('pip') || this.commandExists('pip3')) {
        try {
          if (this.isWindows) {
            execSync('pip show PyQt5', { stdio: 'ignore' });
            runtimes.push('pyqt');
          } else {
            execSync('pip3 show PyQt5 2>/dev/null || pip show PyQt5 2>/dev/null', { stdio: 'ignore' });
            runtimes.push('pyqt');
          }
        } catch (e) {
          // PyQt not installed
        }
      }
    }
    
    // Check for .NET (for Avalonia)
    if (this.commandExists('dotnet')) {
      try {
        const dotnetOutput = execSync('dotnet --list-sdks', { encoding: 'utf8' });
        if (dotnetOutput.includes('6.0') || dotnetOutput.includes('7.0')) {
          runtimes.push('avalonia');
        }
      } catch (e) {
        // .NET SDK not installed or couldn't check
      }
    }    
    return runtimes.length > 0 ? runtimes : ['browser']; // Default to browser UI if nothing else available
  },
  
  // Check if FFmpeg is available
  hasFFmpeg() {
    // First, check app bundle location
    if (this.isWindows) {
      const bundledPath = path.join(process.env.APPDATA, 'iptv-player', 'bin', 'ffmpeg.exe');
      if (fs.existsSync(bundledPath)) {
        return true;
      }
    } else if (this.isMacOS) {
      const bundledPath = path.join(this.getAppDataPath(), 'bin', 'ffmpeg');
      if (fs.existsSync(bundledPath)) {
        return true;
      }
    } else if (this.isLinux) {
      const bundledPath = path.join(this.getAppDataPath(), 'bin', 'ffmpeg');
      if (fs.existsSync(bundledPath)) {
        return true;
      }
    }
    
    // Then check PATH
    return this.commandExists('ffmpeg');
  }
};

module.exports = platform;

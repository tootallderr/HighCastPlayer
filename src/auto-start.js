/**
 * Auto-Start Manager
 * 
 * This module handles configuring the application to run on system startup.
 * It uses platform-specific APIs to register/unregister the app with OS startup mechanisms.
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execSync } = require('child_process');
const platform = require('./platform');
const electronLog = require('electron-log');

// Log file path
const logPath = path.join(app.getPath('userData'), 'auto-start.log');

/**
 * Log function
 * @param {string} message - Message to log
 * @param {string} level - Log level
 */
function log(message, level = 'info') {
  // Use electron-log for better formatted logs
  switch(level.toLowerCase()) {
    case 'error':
      electronLog.error(message);
      break;
    case 'warn':
    case 'warning':
      electronLog.warn(message);
      break;
    case 'info':
    default:
      electronLog.info(message);
      break;
  }
  
  // Also write to dedicated log file
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  try {
    fs.appendFileSync(logPath, logEntry, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Failed to write to log file: ${error.message}`);
  }
}

/**
 * Get the app executable path
 * @returns {string} - Path to the app executable
 */
function getAppPath() {
  // When packaged, use the packaged app path
  if (app.isPackaged) {
    return process.execPath;
  } 
  
  // During development, return the path to the electron executable
  return process.execPath;
}

/**
 * Configure Windows auto-start using registry
 * @param {boolean} enable - Whether to enable or disable auto-start
 */
function configureWindowsAutoStart(enable) {
  const appPath = getAppPath().replace(/\\/g, '\\\\');
  const appName = app.getName();
  const regKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
  
  try {
    if (enable) {
      execSync(`reg add "${regKey}" /v "${appName}" /t REG_SZ /d "${appPath}" /f`);
      log('Added application to Windows startup registry');
    } else {
      execSync(`reg delete "${regKey}" /v "${appName}" /f`);
      log('Removed application from Windows startup registry');
    }
    return true;
  } catch (err) {
    log(`Error configuring Windows auto-start: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Configure macOS auto-start using Launch Agents
 * @param {boolean} enable - Whether to enable or disable auto-start
 */
function configureMacOSAutoStart(enable) {
  const launchAgentDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const launchAgentFile = path.join(launchAgentDir, `com.iptv.player.plist`);
  const appPath = getAppPath();
  
  // Ensure launch agents directory exists
  if (!fs.existsSync(launchAgentDir)) {
    fs.mkdirSync(launchAgentDir, { recursive: true });
  }
  
  try {
    if (enable) {
      // Create plist file
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.iptv.player</string>
  <key>ProgramArguments</key>
  <array>
    <string>${appPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`;
      
      fs.writeFileSync(launchAgentFile, plistContent, 'utf8');
      log('Created macOS launch agent plist file');
      
      // Load the launch agent
      execSync(`launchctl load ${launchAgentFile}`);
      log('Loaded macOS launch agent');
    } else {
      // Unload and remove the launch agent if it exists
      if (fs.existsSync(launchAgentFile)) {
        try {
          execSync(`launchctl unload ${launchAgentFile}`);
          log('Unloaded macOS launch agent');
        } catch (err) {
          log(`Error unloading macOS launch agent: ${err.message}`, 'warning');
        }
        
        fs.unlinkSync(launchAgentFile);
        log('Removed macOS launch agent plist file');
      }
    }
    return true;
  } catch (err) {
    log(`Error configuring macOS auto-start: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Configure Linux auto-start using desktop entry
 * @param {boolean} enable - Whether to enable or disable auto-start
 */
function configureLinuxAutoStart(enable) {
  const autostartDir = path.join(os.homedir(), '.config', 'autostart');
  const desktopEntryFile = path.join(autostartDir, 'iptv-player.desktop');
  const appPath = getAppPath();
  
  // Ensure autostart directory exists
  if (!fs.existsSync(autostartDir)) {
    fs.mkdirSync(autostartDir, { recursive: true });
  }
  
  try {
    if (enable) {
      // Create desktop entry file
      const desktopEntryContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=IPTV Player
Comment=IPTV Player Application
Exec=${appPath}
Icon=video-television
Terminal=false
Categories=Video;AudioVideo;Player;
StartupNotify=true
`;
      
      fs.writeFileSync(desktopEntryFile, desktopEntryContent, 'utf8');
      log('Created Linux autostart desktop entry');
    } else {
      // Remove desktop entry if it exists
      if (fs.existsSync(desktopEntryFile)) {
        fs.unlinkSync(desktopEntryFile);
        log('Removed Linux autostart desktop entry');
      }
    }
    return true;
  } catch (err) {
    log(`Error configuring Linux auto-start: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Configure auto-start depending on the platform
 * @param {boolean} enable - Whether to enable or disable auto-start
 */
function configureAutoStart(enable) {
  if (platform.isWindows) {
    return configureWindowsAutoStart(enable);
  } else if (platform.isMacOS) {
    return configureMacOSAutoStart(enable);
  } else if (platform.isLinux) {
    return configureLinuxAutoStart(enable);
  } else {
    log(`Unsupported platform for auto-start: ${platform.osType}`, 'error');
    return false;
  }
}

/**
 * Check if auto-start is enabled
 * @returns {boolean} - Whether auto-start is enabled
 */
function isAutoStartEnabled() {
  let enabled = false;
  
  try {
    if (platform.isWindows) {
      const appName = app.getName();
      const regKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
      const result = execSync(`reg query "${regKey}" /v "${appName}"`).toString();
      enabled = result.includes(appName);
    } else if (platform.isMacOS) {
      const launchAgentFile = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.iptv.player.plist`);
      enabled = fs.existsSync(launchAgentFile);
    } else if (platform.isLinux) {
      const desktopEntryFile = path.join(os.homedir(), '.config', 'autostart', 'iptv-player.desktop');
      enabled = fs.existsSync(desktopEntryFile);
    }
  } catch (err) {
    log(`Error checking auto-start status: ${err.message}`, 'error');
    enabled = false;
  }
  
  return enabled;
}

module.exports = {
  configureAutoStart,
  isAutoStartEnabled
};
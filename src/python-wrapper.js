/**
 * Python Wrapper
 * 
 * This module provides Python execution functionality with fallbacks when
 * Python is not available on the system.
 */

const { spawn, execSync } = require('child_process');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

class PythonWrapper {
  constructor() {
    this.pythonAvailable = false;
    this.pythonCommand = null; // Will be 'python', 'python3', or null
    this.pythonVersion = null;
    this.checkPythonAvailability();
  }

  /**
   * Check if Python is available on the system
   */
  checkPythonAvailability() {
    try {
      // Try python3 first (common on Unix systems)
      try {
        this.pythonVersion = execSync('python3 --version', { encoding: 'utf8' }).trim();
        this.pythonCommand = 'python3';
        this.pythonAvailable = true;
        log.info(`[PythonWrapper] Found Python: ${this.pythonVersion}`);
        return true;
      } catch (err) {
        // Try regular python command next (common on Windows)
        try {
          this.pythonVersion = execSync('python --version', { encoding: 'utf8' }).trim();
          this.pythonCommand = 'python';
          this.pythonAvailable = true;
          log.info(`[PythonWrapper] Found Python: ${this.pythonVersion}`);
          return true;
        } catch (err2) {
          // Python not available
          log.warn('[PythonWrapper] Python not found on system');
          this.pythonAvailable = false;
          this.pythonCommand = null;
          return false;
        }
      }
    } catch (error) {
      log.error(`[PythonWrapper] Error checking Python availability: ${error.message}`);
      this.pythonAvailable = false;
      return false;
    }
  }

  /**
   * Run a Python script with arguments
   * @param {string} scriptPath - Path to the Python script
   * @param {Array<string>} args - Arguments to pass to the script
   * @param {Object} options - Options for execution
   * @returns {Promise<string>} - Script output
   */
  async runScript(scriptPath, args = [], options = {}) {
    if (!this.pythonAvailable) {
      if (options.silent !== true) {
        log.warn(`[PythonWrapper] Cannot run Python script, Python is not available`);
        
        // Display a more helpful message about installing Python
        const helpMessage = this.getInstallationHelp();
        log.info(`[PythonWrapper] ${helpMessage}`);
      }
      
      if (options.fallback) {
        return options.fallback();
      }
      
      throw new Error('Python is not available on this system');
    }

    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonCommand, [scriptPath, ...args]);
      
      let stdoutData = '';
      let stderrData = '';

      python.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve(stdoutData.trim());
        } else {
          const error = new Error(`Python script exited with code ${code}: ${stderrData}`);
          error.code = code;
          error.stderr = stderrData;
          
          if (options.fallback) {
            log.warn(`[PythonWrapper] Python script failed, using fallback: ${error.message}`);
            resolve(options.fallback());
          } else {
            reject(error);
          }
        }
      });

      python.on('error', (error) => {
        if (options.fallback) {
          log.warn(`[PythonWrapper] Python execution error, using fallback: ${error.message}`);
          resolve(options.fallback());
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Get OS-specific help for installing Python
   * @returns {string} - Help message
   */
  getInstallationHelp() {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return 'To install Python on Windows, download the installer from python.org or install from Microsoft Store';
    } else if (platform === 'darwin') {
      return 'To install Python on macOS, use "brew install python3" or download from python.org';
    } else {
      // Linux/Unix systems
      return 'To install Python on Linux, use your package manager (e.g., "apt install python3" on Debian/Ubuntu)';
    }
  }

  /**
   * Check if Python is available
   * @returns {boolean} - True if Python is available
   */
  isPythonAvailable() {
    return this.pythonAvailable;
  }

  /**
   * Get Python version
   * @returns {string|null} - Python version if available
   */
  getVersion() {
    return this.pythonVersion;
  }
}

// Export singleton instance
module.exports = new PythonWrapper();

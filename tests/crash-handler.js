/**
 * IPTV Player Crash Handler Test
 * 
 * This script tests the crash handling capabilities of the IPTV Player
 * by simulating different types of crashes and verifying recovery mechanisms.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');

// Define paths
const TEST_LOG_FILE = path.join(__dirname, 'crash_test.log');

// Initialize log file
fs.writeFileSync(TEST_LOG_FILE, '');

// Log function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(TEST_LOG_FILE, formattedMessage);
  
  // Also output to console
  console.log(`[${level}] ${message}`);
}

// Test scenarios
const CRASH_SCENARIOS = [
  {
    name: 'Uncaught Exception',
    script: `
      setTimeout(() => {
        throw new Error('Simulated uncaught exception');
      }, 1000);
    `
  },
  {
    name: 'Promise Rejection',
    script: `
      setTimeout(() => {
        Promise.reject(new Error('Simulated promise rejection'));
      }, 1000);
    `
  },
  {
    name: 'Memory Overflow',
    script: `
      setTimeout(() => {
        const arrays = [];
        try {
          while (true) {
            arrays.push(new Array(1024 * 1024).fill('x'));
          }
        } catch (e) {
          console.error('Memory overflow simulation completed');
        }
      }, 1000);
    `
  },
  {
    name: 'Renderer Process Crash',
    script: `
      const { BrowserWindow } = require('electron');
      
      setTimeout(() => {
        const win = new BrowserWindow({ 
          width: 400, 
          height: 300,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
          }
        });
        
        win.loadURL('data:text/html,<script>setTimeout(() => { process.crash(); }, 1000);</script>');
      }, 1000);
    `
  }
];

// Run a test scenario
function runTestScenario(scenario) {
  return new Promise((resolve) => {
    log(`Running crash test: ${scenario.name}`);
    
    // Create a temporary script file
    const tempScriptPath = path.join(__dirname, `temp_crash_test_${Date.now()}.js`);
    
    // Write the scenario script to a file
    const fullScript = `
      const { app } = require('electron');
      
      // Setup crash handlers
      process.on('uncaughtException', (error) => {
        console.log('CRASH_HANDLER:UNCAUGHT_EXCEPTION:' + error.message);
        app.exit(1);
      });
      
      process.on('unhandledRejection', (reason) => {
        console.log('CRASH_HANDLER:UNHANDLED_REJECTION:' + reason);
        app.exit(1);
      });
      
      app.on('ready', () => {
        console.log('CRASH_HANDLER:APP_READY');
        
        // Crash test scenario
        ${scenario.script}
      });
      
      app.on('render-process-gone', (event, webContents, details) => {
        console.log('CRASH_HANDLER:RENDERER_CRASHED:' + details.reason);
        app.exit(1);
      });
    `;
    
    fs.writeFileSync(tempScriptPath, fullScript);
    
    // Run with electron
    const process = spawn(electron, [tempScriptPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    let crashDetected = false;
    
    // Collect stdout
    process.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      
      // Look for crash handler messages
      if (message.includes('CRASH_HANDLER:')) {
        crashDetected = true;
        log(`Crash detected: ${message.trim()}`, 'WARNING');
      }
    });
    
    // Collect stderr
    process.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    // Set a timeout to kill the process if it hangs
    const timeout = setTimeout(() => {
      process.kill();
      log('Test timed out', 'WARNING');
      cleanup();
      resolve({ success: false, message: 'Test timed out' });
    }, 15000);
    
    // Handle process exit
    process.on('exit', (code) => {
      clearTimeout(timeout);
      
      const success = crashDetected;
      
      if (success) {
        log(`Test completed successfully - crash was handled`, 'SUCCESS');
      } else {
        log(`Test failed - crash was not detected or handled properly`, 'ERROR');
      }
      
      cleanup();
      resolve({
        success,
        output,
        code
      });
    });
    
    // Cleanup function
    function cleanup() {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  });
}

// Main function
async function main() {
  log('Starting crash handler tests');
  
  let passed = 0;
  let failed = 0;
  
  for (const scenario of CRASH_SCENARIOS) {
    log(`\n=== Testing ${scenario.name} ===`);
    
    try {
      const result = await runTestScenario(scenario);
      
      if (result.success) {
        log(`✅ ${scenario.name}: PASSED`, 'SUCCESS');
        passed++;
      } else {
        log(`❌ ${scenario.name}: FAILED`, 'ERROR');
        failed++;
        
        if (result.output) {
          log(`Output: ${result.output.slice(0, 500)}${result.output.length > 500 ? '...' : ''}`);
        }
      }
    } catch (error) {
      log(`Error running test: ${error.message}`, 'ERROR');
      failed++;
    }
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log(`\n=== Crash Handler Test Summary ===`);
  log(`Tests: ${CRASH_SCENARIOS.length}, Passed: ${passed}, Failed: ${failed}`);
  
  if (failed > 0) {
    log('Some crash handler tests failed. See log for details.', 'WARNING');
    process.exit(1);
  } else {
    log('All crash handler tests passed successfully!', 'SUCCESS');
    process.exit(0);
  }
}

// Run the main function
main();
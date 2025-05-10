/**
 * Cleanup test directories and files
 */

const fs = require('fs');
const path = require('path');

// Function to recursively delete a directory
function deleteDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call for directories
        deleteDirectory(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    });
    
    // Delete the now-empty directory
    fs.rmdirSync(dirPath);
    console.log(`Deleted directory: ${dirPath}`);
  }
}

// Main cleanup function
function cleanup() {
  console.log('Starting cleanup...');
  
  // Delete test-userdata directory
  const testUserDataDir = path.join(__dirname, '..', 'test-userdata');
  if (fs.existsSync(testUserDataDir)) {
    try {
      deleteDirectory(testUserDataDir);
      console.log('Test user data directory removed successfully');
    } catch (err) {
      console.error(`Error removing test user data: ${err.message}`);
    }
  } else {
    console.log('No test user data directory found');
  }
  
  // Delete log files
  const testLogFile = path.join(__dirname, 'cross-platform-test.log');
  if (fs.existsSync(testLogFile)) {
    try {
      fs.unlinkSync(testLogFile);
      console.log('Test log file removed');
    } catch (err) {
      console.error(`Error removing test log file: ${err.message}`);
    }
  }
  
  console.log('Cleanup completed');
}

// Run cleanup
cleanup();

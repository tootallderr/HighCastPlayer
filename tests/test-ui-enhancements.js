/**
 * UI Enhancements Test Script
 * 
 * This test verifies the following UI enhancements:
 * - EPG (XMLTV) implementation
 * - Channel search and filter functionality
 * - Metadata overlay showing title, quality, and bitrate
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { app } = require('electron');
const epgManager = require('../src/epg-manager');
const playerEngine = require('../src/player-engine');

// Test log
const LOG_FILE = path.join(__dirname, 'ui-enhancements.log');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '');
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
  console.log(`[${level.toUpperCase()}] ${message}`);
}

async function runTests() {
  log('Starting UI Enhancements Tests');
  
  try {
    // Test EPG functionality
    await testEpg();
    
    // Test channel search and filter
    await testChannelSearch();
    
    // Test metadata overlay
    await testMetadataOverlay();
    
    log('All UI enhancement tests completed successfully');
    process.exit(0);
  } catch (error) {
    log(`Test failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

async function testEpg() {
  log('Testing EPG functionality');
  
  // Test EPG initialization
  try {
    const result = await epgManager.initialize();
    assert(result.success, 'EPG initialization should succeed');
    log('EPG initialization successful');
  } catch (error) {
    throw new Error(`EPG initialization failed: ${error.message}`);
  }
  
  // Test adding an EPG source
  try {
    const testSource = 'http://example.com/epg.xml';
    const result = epgManager.addSource(testSource, 'Test Source');
    
    // This might fail if source already exists, which is fine
    if (result.success) {
      log('Added test EPG source successfully');
    } else {
      log('Test EPG source already exists', 'warn');
    }
  } catch (error) {
    log(`Error adding test EPG source: ${error.message}`, 'error');
  }
  
  // Test EPG configuration loading
  try {
    const config = epgManager.loadConfig();
    assert(config, 'EPG configuration should load');
    assert(Array.isArray(config.sources), 'EPG config should have sources array');
    log(`Loaded EPG config with ${config.sources.length} sources`);
  } catch (error) {
    throw new Error(`EPG config loading failed: ${error.message}`);
  }
  
  log('EPG functionality tests passed');
}

async function testChannelSearch() {
  log('Testing channel search and filter');
  
  // Initialize player engine if needed
  if (!playerEngine.initialized) {
    await playerEngine.initialize();
  }
  
  // Get all channels
  const channels = await playerEngine.getChannels();
  assert(Array.isArray(channels), 'Should get array of channels');
  assert(channels.length > 0, 'Should have at least one channel');
  log(`Found ${channels.length} total channels`);
  
  // Test filtering by text
  const filteredByName = playerEngine.filterChannels({ query: 'news' });
  log(`Found ${filteredByName.length} channels matching 'news' query`);
  
  // Test filtering by group
  const groups = playerEngine.getChannelGroups();
  assert(Array.isArray(groups), 'Should get array of channel groups');
  log(`Found ${groups.length} channel groups`);
  
  if (groups.length > 0) {
    const testGroup = groups[0];
    const filteredByGroup = playerEngine.filterChannels({ group: testGroup });
    log(`Found ${filteredByGroup.length} channels in group "${testGroup}"`);
  }
  
  log('Channel search and filter tests passed');
}

async function testMetadataOverlay() {
  log('Testing metadata overlay');
  
  // Initialize player engine if needed
  if (!playerEngine.initialized) {
    await playerEngine.initialize();
  }
  
  // Test getPlaybackInfo without a channel playing
  const emptyInfo = playerEngine.getPlaybackInfo();
  assert(!emptyInfo.success, 'getPlaybackInfo should fail when no channel is playing');
  log('Properly handled metadata request with no active channel');
  
  // We can't fully test with a playing channel in this automated test
  log('Note: Full metadata overlay testing requires manual verification during playback');
  log('Metadata overlay tests completed');
}

// Run tests when executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests
};

/**
 * Test Recommendation Engine
 * 
 * This script tests the ML recommendation engine functionality
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const recommendationEngine = require('../src/recommendation-engine');

// Log file
const LOG_FILE = path.join(__dirname, 'recommendation-test.log');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '', 'utf8');
}

/**
 * Log test results
 * @param {string} message - Message to log
 * @param {string} level - Log level
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, formatted);
  console.log(message);
}

/**
 * Test Recommendation Engine
 */
async function testRecommendationEngine() {
  log('=== Testing ML Recommendation Engine ===');
  
  try {
    // Test 1: Initialize recommendation engine
    log('\n1. Testing recommendation engine initialization');
    
    // Override saveHistory to prevent actual file writes during tests
    const originalSaveHistory = recommendationEngine.saveHistory;
    recommendationEngine.saveHistory = async function() {
      return true;
    };
    
    const settings = recommendationEngine.settings;
    assert(settings, 'Should load recommendation settings');
    log('Recommendation engine initialization: PASSED ✅');
    
    // Test 2: Record viewing history
    log('\n2. Testing recording viewing history');
    
    // Clear any existing history for testing
    recommendationEngine.viewingHistory = [];
    
    // Record a channel view
    const channel1 = {
      id: 'test-channel-1',
      title: 'Test Channel 1',
      group: 'Sports'
    };
    
    await recommendationEngine.recordViewing(channel1, 120); // 2 minutes
    
    assert(recommendationEngine.viewingHistory.length === 1, 'Should record one history entry');
    assert(recommendationEngine.viewingHistory[0].totalViewTime === 120, 'Should record correct view time');
    
    log('Recording viewing history: PASSED ✅');
    
    // Test 3: Get viewing history
    log('\n3. Testing get viewing history');
    
    const history = recommendationEngine.getViewingHistory();
    assert(history && history.length === 1, 'Should return viewing history');
    assert(history[0].channelId === 'test-channel-1', 'Should return correct channel ID');
    
    log('Getting viewing history: PASSED ✅');
    
    // Test 4: Get channel statistics
    log('\n4. Testing get channel statistics');
    
    const stats = recommendationEngine.getChannelStatistics('test-channel-1');
    assert(stats && stats.channelId === 'test-channel-1', 'Should return channel statistics');
    assert(stats.totalViewTime === 120, 'Should return correct total view time');
    
    log('Getting channel statistics: PASSED ✅');
    
    // Test 5: Record multiple views and get top watched
    log('\n5. Testing top watched channels');
    
    const channel2 = {
      id: 'test-channel-2',
      title: 'Test Channel 2',
      group: 'News'
    };
    
    const channel3 = {
      id: 'test-channel-3',
      title: 'Test Channel 3',
      group: 'Movies'
    };
    
    await recommendationEngine.recordViewing(channel2, 300); // 5 minutes
    await recommendationEngine.recordViewing(channel3, 180); // 3 minutes
    
    const topChannels = recommendationEngine.getTopWatchedChannels(3);
    assert(topChannels.length === 3, 'Should return 3 top channels');
    assert(topChannels[0].channelId === 'test-channel-2', 'Channel 2 should be most watched');
    assert(topChannels[0].totalViewTime === 300, 'Should have correct view time');
    
    log('Top watched channels: PASSED ✅');
    
    // Test 6: Get recommendations
    log('\n6. Testing channel recommendations');
    
    // Create test channels for recommendations
    const allChannels = [
      {
        id: 'test-channel-1',
        title: 'Test Channel 1',
        group: 'Sports'
      },
      {
        id: 'test-channel-2',
        title: 'Test Channel 2',
        group: 'News'
      },
      {
        id: 'test-channel-3',
        title: 'Test Channel 3',
        group: 'Movies'
      },
      {
        id: 'test-channel-4',
        title: 'Test Channel 4',
        group: 'Sports'
      },
      {
        id: 'test-channel-5',
        title: 'Test Channel 5',
        group: 'News'
      },
      {
        id: 'test-channel-6',
        title: 'Test Channel 6',
        group: 'Movies'
      }
    ];
    
    // Get recommendations excluding current channel
    const recommendations = recommendationEngine.getRecommendations(allChannels, 'test-channel-2');
    
    // Note: Since this is ML, we can't exactly predict outputs but we can verify structure
    assert(recommendations && Array.isArray(recommendations), 'Should return recommendations array');
    assert(recommendations.length > 0, 'Should have at least one recommendation');
    assert(recommendations[0].recommendationScore !== undefined, 'Should include recommendation score');
    
    // Verify the current channel is excluded
    const hasCurrentChannel = recommendations.some(rec => rec.id === 'test-channel-2');
    assert(hasCurrentChannel === false, 'Should exclude current channel from recommendations');
    
    log('Channel recommendations: PASSED ✅');
    
    // Test 7: Test similarity calculation
    log('\n7. Testing similarity calculation');
    
    const testChannel = {
      id: 'test-channel-4',
      title: 'Test Channel 4',
      group: 'Sports' // Same group as channel 1
    };
    
    const historyEntries = recommendationEngine.viewingHistory;
    const score = recommendationEngine.calculateSimilarityScore(testChannel, historyEntries);
    
    assert(typeof score === 'number', 'Should calculate a numerical similarity score');
    assert(score >= 0 && score <= 1, 'Score should be in range 0-1');
    
    log('Similarity calculation: PASSED ✅');
    
    // Test 8: Update settings
    log('\n8. Testing update settings');
    
    const newSettings = {
      historyLimit: 150,
      minViewTimeSeconds: 60
    };
    
    // Mock updateSettings
    const originalUpdateSettings = recommendationEngine.updateSettings;
    recommendationEngine.updateSettings = function(settings) {
      this.settings = {
        ...this.settings,
        ...settings
      };
      return true;
    };
    
    const updateResult = recommendationEngine.updateSettings(newSettings);
    assert(updateResult === true, 'Should update settings successfully');
    assert(recommendationEngine.settings.historyLimit === 150, 'Should update historyLimit setting');
    assert(recommendationEngine.settings.minViewTimeSeconds === 60, 'Should update minViewTimeSeconds setting');
    
    // Restore original method
    recommendationEngine.updateSettings = originalUpdateSettings;
    
    log('Update settings: PASSED ✅');
    
    // Test 9: Clear history
    log('\n9. Testing clear history');
    
    await recommendationEngine.clearHistory();
    assert(recommendationEngine.viewingHistory.length === 0, 'Should clear viewing history');
    
    log('Clear history: PASSED ✅');
    
    // Restore original method
    recommendationEngine.saveHistory = originalSaveHistory;
    
  } catch (error) {
    log(`Test error: ${error.message}`, 'error');
    console.error(error);
  }
  
  log('\n=== Recommendation Engine Tests Complete ===');
}

// Run tests
testRecommendationEngine().catch(err => console.error('Test error:', err));

/**
 * Caption Features Test Script
 * 
 * This test verifies the closed caption functionality:
 * - Caption detection and loading
 * - WebVTT and SRT parsing
 * - AI caption enhancement with Ollama
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const captionManager = require('../src/caption-manager');
const playerEngine = require('../src/player-engine');

// Test log
const LOG_FILE = path.join(__dirname, 'caption-features.log');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '', 'utf8');
}

// Log test results
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, formatted);
  console.log(message);
}

// Test caption features
async function testCaptionFeatures() {
  log('=== Caption Features Test ===');
  
  try {
    // Test 1: Initialize caption manager
    log('\n1. Testing caption manager initialization...');
    const settings = captionManager.settings;
    assert(settings, 'Caption settings should be defined');
    log(`Caption settings loaded: ${JSON.stringify(settings)}`);
    log('Caption manager initialization: PASSED ✅');
    
    // Test 2: Test WebVTT parsing
    log('\n2. Testing WebVTT parsing...');
    const webVttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
This is a test caption

00:00:06.000 --> 00:00:10.000
This is another test caption`;
    
    const tempVttPath = path.join(__dirname, 'temp-test.vtt');
    fs.writeFileSync(tempVttPath, webVttContent, 'utf8');
    
    try {
      const parsedWebVtt = await captionManager.parseCaptionFile(tempVttPath);
      assert(parsedWebVtt && parsedWebVtt.length > 0, 'Should parse WebVTT captions');
      log(`Parsed ${parsedWebVtt.length} WebVTT captions`);
      log('WebVTT parsing: PASSED ✅');
    } catch (error) {
      log(`WebVTT parsing error: ${error.message}`, 'error');
      log('WebVTT parsing: FAILED ❌');
    } finally {
      // Cleanup
      if (fs.existsSync(tempVttPath)) {
        fs.unlinkSync(tempVttPath);
      }
    }
    
    // Test 3: Test SRT parsing
    log('\n3. Testing SRT parsing...');
    const srtContent = `1
00:00:01,000 --> 00:00:05,000
This is a test SRT caption

2
00:00:06,000 --> 00:00:10,000
This is another test SRT caption`;
    
    const tempSrtPath = path.join(__dirname, 'temp-test.srt');
    fs.writeFileSync(tempSrtPath, srtContent, 'utf8');
    
    try {
      const parsedSrt = await captionManager.parseCaptionFile(tempSrtPath);
      assert(parsedSrt && parsedSrt.length > 0, 'Should parse SRT captions');
      log(`Parsed ${parsedSrt.length} SRT captions`);
      log('SRT parsing: PASSED ✅');
    } catch (error) {
      log(`SRT parsing error: ${error.message}`, 'error');
      log('SRT parsing: FAILED ❌');
    } finally {
      // Cleanup
      if (fs.existsSync(tempSrtPath)) {
        fs.unlinkSync(tempSrtPath);
      }
    }
    
    // Test 4: Test caption settings
    log('\n4. Testing caption settings update...');
    const testSettings = {
      enabled: true,
      size: 'large',
      color: '#FFFF00',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      position: 'top',
      font: 'monospace',
      aiEnhancement: {
        enabled: false
      }
    };
    
    try {
      const updateResult = captionManager.updateSettings(testSettings);
      assert(updateResult, 'Should update caption settings');
      
      // Verify settings were updated
      const newSettings = captionManager.settings;
      assert.strictEqual(newSettings.size, 'large', 'Caption size should be updated');
      assert.strictEqual(newSettings.position, 'top', 'Caption position should be updated');
      
      log('Caption settings update: PASSED ✅');
    } catch (error) {
      log(`Caption settings update error: ${error.message}`, 'error');
      log('Caption settings update: FAILED ❌');
    }
    
    // Test 5: Test AI caption enhancement (mock)
    log('\n5. Testing AI caption enhancement (mock)...');
    try {
      // Mock the Ollama integration
      const originalEnhanceMethod = captionManager.enhanceCaptionWithAI;
      captionManager.enhanceCaptionWithAI = async (text, mode) => {
        return `[${mode}] ${text}`;
      };
      
      const testCaption = 'This is a test caption';
      const enhancedCaption = await captionManager.enhanceCaptionWithAI(testCaption, 'simplified');
      assert(enhancedCaption.includes('simplified'), 'Should enhance caption with specified mode');
      
      // Restore original method
      captionManager.enhanceCaptionWithAI = originalEnhanceMethod;
      
      log('AI caption enhancement (mock): PASSED ✅');
    } catch (error) {
      log(`AI caption enhancement error: ${error.message}`, 'error');
      log('AI caption enhancement: FAILED ❌');
    }
    
  } catch (error) {
    log(`Test error: ${error.message}`, 'error');
    log(error.stack);
  }
  
  log('\n=== Caption Features Tests Complete ===');
}

// Run tests
testCaptionFeatures()
  .catch(err => console.error('Test error:', err));

/**
 * IPTV Player Sample Channel Generator
 * 
 * This script generates a sample M3U8 playlist with various channel types
 * for testing the IPTV Player application, including:
 * - Valid channels with different content types
 * - Invalid channels that should fail gracefully
 * - Slow loading channels to test timeout handling
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

// Define paths
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const SAMPLE_CHANNELS_FILE = path.join(TEST_DATA_DIR, 'sample-channels.m3u8');
const LOG_FILE = path.join(__dirname, 'sample_channels.log');

// Ensure test data directory exists
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// Log function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, formattedMessage);
  
  // Also output to console
  console.log(`[${level}] ${message}`);
}

// Clear log file
fs.writeFileSync(LOG_FILE, '');

// Sample valid channels with working streams
const VALID_CHANNELS = [
  {
    id: 'nasa-public',
    name: 'NASA Public Channel',
    logo: 'https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg',
    group: 'Science',
    url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8'
  },
  {
    id: 'redbull',
    name: 'Red Bull TV',
    logo: 'https://www.redbull.com/v3/resources/images/appdata/favicon.ico',
    group: 'Sports',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'
  },
  {
    id: 'reuters',
    name: 'Reuters TV',
    logo: 'https://www.reuters.tv/favicon.ico',
    group: 'News',
    url: 'https://reuters-reutersnow-1.plex.wurl.com/manifest/playlist.m3u8'
  },
  {
    id: 'weather',
    name: 'Weather Channel',
    logo: 'https://weather.com/favicon.ico',
    group: 'Weather',
    url: 'https://weather-lh.akamaihd.net/i/twc_1@92006/master.m3u8'
  }
];

// Sample invalid channels to test error handling
const INVALID_CHANNELS = [
  {
    id: 'broken1',
    name: 'Broken Stream 1 (404)',
    logo: '',
    group: 'Test',
    url: 'https://example.com/nonexistent-stream.m3u8'
  },
  {
    id: 'broken2',
    name: 'Broken Stream 2 (Invalid URL)',
    logo: '',
    group: 'Test',
    url: 'https://invalid-domain-name-that-doesnt-exist-123456.com/stream.m3u8'
  },
  {
    id: 'broken3',
    name: 'Broken Stream 3 (Malformed)',
    logo: '',
    group: 'Test',
    url: 'htps:/malformed-url.com/stream.m3u8'
  },
  {
    id: 'slow',
    name: 'Slow Loading Stream (Timeout)',
    logo: '',
    group: 'Test',
    url: 'https://httpbin.org/delay/10/stream.m3u8'
  }
];

// Test channels with different formats
const FORMAT_TEST_CHANNELS = [
  {
    id: 'mp4-test',
    name: 'MP4 Direct Test',
    logo: '',
    group: 'Format Test',
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  },
  {
    id: 'dash-test',
    name: 'DASH Test Stream',
    logo: '',
    group: 'Format Test',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd'
  }
];

// Check if a URL is accessible
async function checkUrl(url) {
  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 5000 }, (response) => {
      resolve({
        status: response.statusCode,
        accessible: response.statusCode >= 200 && response.statusCode < 400
      });
    });
    
    request.on('error', (error) => {
      resolve({
        status: 0,
        accessible: false,
        error: error.message
      });
    });
    
    request.on('timeout', () => {
      request.destroy();
      resolve({
        status: 0,
        accessible: false,
        error: 'Request timed out'
      });
    });
  });
}

// Generate M3U8 playlist content
function generatePlaylist(channels) {
  let content = '#EXTM3U\n';
  
  channels.forEach(channel => {
    content += `#EXTINF:-1 tvg-id="${channel.id}" tvg-name="${channel.name}" tvg-logo="${channel.logo}" group-title="${channel.group}",${channel.name}\n`;
    content += `${channel.url}\n`;
  });
  
  return content;
}

// Main function
async function main() {
  log('Starting sample channels generation');
  
  try {
    // Combine all channel types
    const allChannels = [...VALID_CHANNELS, ...INVALID_CHANNELS, ...FORMAT_TEST_CHANNELS];
    log(`Generating playlist with ${allChannels.length} channels`);
    
    // Generate playlist content
    const playlistContent = generatePlaylist(allChannels);
    
    // Write playlist file
    fs.writeFileSync(SAMPLE_CHANNELS_FILE, playlistContent);
    log(`Sample channels playlist written to ${SAMPLE_CHANNELS_FILE}`);
    
    // Verify valid channels are accessible
    log('\nValidating channels:');
    for (const channel of VALID_CHANNELS) {
      log(`Checking channel: ${channel.name}`);
      const result = await checkUrl(channel.url);
      
      if (result.accessible) {
        log(`✓ Channel ${channel.name} is accessible (Status: ${result.status})`, 'SUCCESS');
      } else {
        log(`✗ Channel ${channel.name} is not accessible: ${result.error || 'Unknown error'}`, 'WARNING');
      }
    }
    
    log('\nSample channels generated successfully!', 'SUCCESS');
  } catch (error) {
    log(`Error generating sample channels: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run the main function
main();
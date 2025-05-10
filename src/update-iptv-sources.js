/**
 * This script will update the IPTV playlist sources to use real sources instead of examples
 * Usage: node update-iptv-sources.js
 */

const fs = require('fs');
const path = require('path');

// Determine if we're running in production or development
const isProduction = process.env.NODE_ENV === 'production';
const userDataPath = isProduction 
  ? process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support/iptv-player' : '/var/local')
  : path.join(process.cwd(), 'data');

const sourcesPath = path.join(userDataPath, 'sources.json');

// Make sure the sources file exists
if (!fs.existsSync(sourcesPath)) {
  console.log(`Sources file not found at ${sourcesPath}, creating it...`);
  const defaultSources = {
    "remote": [],
    "local": []
  };
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(path.dirname(sourcesPath))) {
    fs.mkdirSync(path.dirname(sourcesPath), { recursive: true });
  }
  
  fs.writeFileSync(sourcesPath, JSON.stringify(defaultSources, null, 2));
}

// Read the current sources
let sources;
try {
  const sourcesContent = fs.readFileSync(sourcesPath, 'utf8');
  sources = JSON.parse(sourcesContent);
  console.log('Current sources:', sources);
} catch (error) {
  console.error(`Error reading sources file: ${error.message}`);
  sources = { "remote": [], "local": [] };
}

// Update with real IPTV sources
const realSources = [
  {
    "name": "TVPass Playlist",
    "url": "https://tvpass.org/playlist/m3u",
    "added": new Date().toISOString(),
    "enabled": true
  },
  {
    "name": "MovieJoy Playlist",
    "url": "http://moviejoy.stream/playlist.m3u",
    "added": new Date().toISOString(),
    "enabled": true
  }
];

// Check if sources already exist (by URL)
const existingUrls = sources.remote.map(source => source.url);
const newSources = realSources.filter(source => !existingUrls.includes(source.url));

// Add new sources
if (newSources.length > 0) {
  sources.remote = [...sources.remote, ...newSources];
  console.log(`Adding ${newSources.length} new sources`);
} else {
  console.log('No new sources to add');
}

// Update sources file
try {
  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
  console.log('Sources updated successfully!');
} catch (error) {
  console.error(`Error updating sources file: ${error.message}`);
}

// Now let's check for example.com URLs in the codebase and warn about them
const searchPaths = [
  path.join(process.cwd(), 'src'),
  path.join(process.cwd(), 'tests')
];

function scanForExampleUrls(directoryPath) {
  const files = fs.readdirSync(directoryPath);
  
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      scanForExampleUrls(filePath);
    } else if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.html'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('example.com')) {
        console.warn(`\nFound example.com URL in: ${filePath}`);
      }
    }
  }
}

// Scan for example URLs
console.log('\nScanning for example.com URLs in codebase...');
searchPaths.forEach(dirPath => {
  if (fs.existsSync(dirPath)) {
    scanForExampleUrls(dirPath);
  }
});

console.log('\nDone!');

/**
 * EPG Manager
 * 
 * This module provides functionality for fetching, parsing and querying
 * Electronic Program Guide (EPG) data in XMLTV format.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const { URL } = require('url');
const platform = require('./platform');
const config = require('./config-manager');

// Define paths
const DATA_DIR = path.join(platform.getAppDataPath());
const EPG_CACHE_DIR = path.join(DATA_DIR, 'epg');
const EPG_CONFIG_PATH = path.join(DATA_DIR, 'epg-sources.json');
const LOG_FILE = path.join(__dirname, '..', 'tests', 'epg.log');

// Default configuration
const DEFAULT_CONFIG = {
  sources: [],
  updateFrequency: 12, // hours
  lastUpdated: null
};

// Ensure directories exist
if (!fs.existsSync(EPG_CACHE_DIR)) {
  fs.mkdirSync(EPG_CACHE_DIR, { recursive: true });
}

// EPG data cache
let programGuideData = {};
let channelMapping = {};

/**
 * Logger function for EPG events
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, formattedMessage);
  
  // Also output to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EPG] ${message}`);
  }
}

/**
 * Load EPG configuration from file
 */
function loadConfig() {
  try {
    if (fs.existsSync(EPG_CONFIG_PATH)) {
      const configData = fs.readFileSync(EPG_CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    }
  } catch (error) {
    log(`Error loading EPG config: ${error.message}`, 'error');
  }
  
  // Create default config if none exists
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Save EPG configuration to file
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(EPG_CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    log(`Error saving EPG config: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Add a new EPG source
 */
function addSource(url, name) {
  const config = loadConfig();
  
  // Check if source already exists
  const sourceExists = config.sources.some(source => source.url === url);
  if (sourceExists) {
    log(`EPG source already exists: ${url}`, 'warn');
    return { success: false, message: 'Source already exists' };
  }
  
  // Add new source
  config.sources.push({
    url,
    name: name || `EPG Source ${config.sources.length + 1}`,
    enabled: true,
    lastFetched: null
  });
  
  saveConfig(config);
  log(`Added new EPG source: ${url}`);
  return { success: true, message: 'Source added' };
}

/**
 * Remove an EPG source
 */
function removeSource(url) {
  const config = loadConfig();
  const initialLength = config.sources.length;
  
  config.sources = config.sources.filter(source => source.url !== url);
  
  if (config.sources.length < initialLength) {
    saveConfig(config);
    log(`Removed EPG source: ${url}`);
    return { success: true, message: 'Source removed' };
  } else {
    log(`EPG source not found: ${url}`, 'warn');
    return { success: false, message: 'Source not found' };
  }
}

/**
 * Download and parse EPG data from a single source
 */
async function fetchEpgSource(source) {
  try {
    log(`Fetching EPG data from: ${source.url}`);
    
    // Download XMLTV data
    const response = await axios.get(source.url, {
      responseType: 'text',
      timeout: 30000 // 30 seconds timeout
    });
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch EPG data: HTTP ${response.status}`);
    }
    
    // Parse XML data
    const xmlData = response.data;
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlData);
    
    if (!result || !result.tv) {
      throw new Error('Invalid XMLTV format');
    }
    
    // Generate filename for cached data
    const urlObj = new URL(source.url);
    const hostname = urlObj.hostname.replace(/[^a-z0-9]/gi, '_');
    const filename = `${hostname}_${Date.now()}.json`;
    const cachePath = path.join(EPG_CACHE_DIR, filename);
    
    // Save parsed data to cache
    fs.writeFileSync(cachePath, JSON.stringify(result.tv, null, 2));
    
    // Update source metadata
    source.lastFetched = new Date().toISOString();
    source.cachedFile = cachePath;
    
    return { success: true, data: result.tv };
  } catch (error) {
    log(`Error fetching EPG data from ${source.url}: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Update all enabled EPG sources
 */
async function updateAllSources() {
  const config = loadConfig();
  const enabledSources = config.sources.filter(source => source.enabled);
  
  if (enabledSources.length === 0) {
    log('No enabled EPG sources to update');
    return { success: true, message: 'No sources to update' };
  }
  
  log(`Updating ${enabledSources.length} EPG sources`);
  
  const results = [];
  for (const source of enabledSources) {
    const result = await fetchEpgSource(source);
    results.push({ source: source.url, result });
    
    // If successful, update the source info in config
    if (result.success) {
      const sourceIndex = config.sources.findIndex(s => s.url === source.url);
      if (sourceIndex >= 0) {
        config.sources[sourceIndex] = source;
      }
    }
  }
  
  // Save updated config
  config.lastUpdated = new Date().toISOString();
  saveConfig(config);
  
  // Process and merge EPG data
  await processEpgData();
  
  return { 
    success: true, 
    results,
    updated: new Date().toISOString()
  };
}

/**
 * Process and merge all cached EPG data
 */
async function processEpgData() {
  const config = loadConfig();
  programGuideData = {};
  channelMapping = {};
  
  // Get all cached files from enabled sources
  const enabledSources = config.sources.filter(source => source.enabled && source.cachedFile);
  
  if (enabledSources.length === 0) {
    log('No cached EPG data found');
    return { success: false, message: 'No EPG data available' };
  }
  
  // Process each source
  for (const source of enabledSources) {
    try {
      if (!fs.existsSync(source.cachedFile)) {
        log(`Cached file not found: ${source.cachedFile}`, 'warn');
        continue;
      }
      
      const epgData = JSON.parse(fs.readFileSync(source.cachedFile, 'utf8'));
      
      // Process channels
      const channels = Array.isArray(epgData.channel) ? epgData.channel : [epgData.channel];
      channels.forEach(channel => {
        if (!channel || !channel.$ || !channel.$.id) return;
        
        const channelId = channel.$.id;
        channelMapping[channelId] = {
          id: channelId,
          displayName: channel.display_name || channelId,
          icon: channel.icon?.$ ? channel.icon.$.src : null
        };
      });
      
      // Process programs
      const programs = Array.isArray(epgData.programme) ? epgData.programme : [epgData.programme];
      programs.forEach(program => {
        if (!program || !program.$ || !program.$.channel) return;
        
        const channelId = program.$.channel;
        if (!programGuideData[channelId]) {
          programGuideData[channelId] = [];
        }
        
        // Convert times from XMLTV format to timestamps
        let startTime = null;
        let endTime = null;
        
        // Handle XMLTV date format (YYYYMMDDHHMMSS)
        if (program.$.start) {
          const startStr = program.$.start;
          try {
            // Parse XMLTV date format
            const year = parseInt(startStr.substring(0, 4));
            const month = parseInt(startStr.substring(4, 6)) - 1; // JS months are 0-based
            const day = parseInt(startStr.substring(6, 8));
            const hour = parseInt(startStr.substring(8, 10));
            const minute = parseInt(startStr.substring(10, 12));
            const second = parseInt(startStr.substring(12, 14) || '00');
            
            startTime = new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
          } catch (e) {
            log(`Invalid start time format: ${startStr}`, 'warn');
          }
        }
        
        if (program.$.stop) {
          const endStr = program.$.stop;
          try {
            // Parse XMLTV date format
            const year = parseInt(endStr.substring(0, 4));
            const month = parseInt(endStr.substring(4, 6)) - 1; // JS months are 0-based
            const day = parseInt(endStr.substring(6, 8));
            const hour = parseInt(endStr.substring(8, 10));
            const minute = parseInt(endStr.substring(10, 12));
            const second = parseInt(endStr.substring(12, 14) || '00');
            
            endTime = new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
          } catch (e) {
            log(`Invalid end time format: ${endStr}`, 'warn');
          }
        }
        
        programGuideData[channelId].push({
          title: program.title || 'Unknown Program',
          description: program.desc || '',
          category: program.category || '',
          start: startTime,
          end: endTime,
          duration: program.length?.$?.value || null,
          rating: program.rating || null,
          icon: program.icon?.$.src || null
        });
      });
    } catch (error) {
      log(`Error processing EPG data from ${source.cachedFile}: ${error.message}`, 'error');
    }
  }
  
  // Sort programs by start time for each channel
  Object.keys(programGuideData).forEach(channelId => {
    programGuideData[channelId].sort((a, b) => {
      return new Date(a.start) - new Date(b.start);
    });
  });
  
  log(`EPG data processed with ${Object.keys(channelMapping).length} channels`);
  return { 
    success: true, 
    channelCount: Object.keys(channelMapping).length,
    programCount: Object.values(programGuideData).reduce((acc, val) => acc + val.length, 0)
  };
}

/**
 * Get all EPG channels
 */
function getChannels() {
  return Object.values(channelMapping);
}

/**
 * Check if EPG data needs to be updated based on config
 */
function shouldUpdateEpg() {
  const config = loadConfig();
  if (!config.lastUpdated) return true;
  
  const lastUpdate = new Date(config.lastUpdated);
  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  
  return hoursSinceUpdate >= config.updateFrequency;
}

/**
 * Get current and upcoming programs for a channel
 */
function getChannelPrograms(channelId, count = 10) {
  if (!programGuideData[channelId]) {
    return [];
  }
  
  const now = new Date();
  let currentProgramIndex = -1;
  
  // Find the current program
  for (let i = 0; i < programGuideData[channelId].length; i++) {
    const program = programGuideData[channelId][i];
    const startTime = new Date(program.start);
    const endTime = program.end ? new Date(program.end) : null;
    
    // If program is currently airing
    if (startTime <= now && (!endTime || endTime >= now)) {
      currentProgramIndex = i;
      break;
    }
    
    // If we've passed the current time, the previous program was the last one
    if (startTime > now) {
      currentProgramIndex = Math.max(0, i - 1);
      break;
    }
  }
  
  // If we didn't find a current program, use the most recent one
  if (currentProgramIndex === -1 && programGuideData[channelId].length > 0) {
    currentProgramIndex = programGuideData[channelId].length - 1;
  }
  
  // Return current and upcoming programs
  return programGuideData[channelId].slice(
    Math.max(0, currentProgramIndex),
    Math.max(0, currentProgramIndex) + count
  );
}

/**
 * Get information about the current program on a channel
 */
function getCurrentProgram(channelId) {
  const programs = getChannelPrograms(channelId, 1);
  return programs.length > 0 ? programs[0] : null;
}

/**
 * Search for programs matching a query
 */
function searchPrograms(query, options = {}) {
  const normalizedQuery = query.toLowerCase();
  const results = [];
  
  Object.keys(programGuideData).forEach(channelId => {
    const channelInfo = channelMapping[channelId] || { id: channelId, displayName: channelId };
    
    programGuideData[channelId].forEach(program => {
      // Skip programs that have already ended
      if (options.futureOnly && program.end && new Date(program.end) < new Date()) {
        return;
      }
      
      // Match by title, description or category
      if (
        program.title?.toLowerCase().includes(normalizedQuery) ||
        program.description?.toLowerCase().includes(normalizedQuery) ||
        program.category?.toLowerCase().includes(normalizedQuery)
      ) {
        results.push({
          ...program,
          channelId,
          channelName: channelInfo.displayName,
          channelIcon: channelInfo.icon
        });
      }
    });
  });
  
  return results.slice(0, options.limit || 100);
}

/**
 * Initialize the EPG manager and load any cached data
 */
async function initialize() {
  try {
    log('Initializing EPG manager');
    await processEpgData();
    
    // Check if we need to update EPG data
    if (shouldUpdateEpg()) {
      log('EPG data needs updating');
      updateAllSources().catch(error => {
        log(`Error during automatic EPG update: ${error.message}`, 'error');
      });
    }
    
    return { success: true };
  } catch (error) {
    log(`Error initializing EPG manager: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

// Export functions
module.exports = {
  initialize,
  loadConfig,
  saveConfig,
  addSource,
  removeSource,
  updateAllSources,
  processEpgData,
  getChannels,
  getChannelPrograms,
  getCurrentProgram,
  searchPrograms
};

/**
 * ML Recommendation Engine - Failsafe Version
 * 
 * This module provides channel recommendations based on viewing history
 * using simple machine learning techniques for content-based filtering.
 * It includes fallbacks for when Python is not available.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const log = require('electron-log');
const pathManager = require('./path-manager');
const config = require('./config-manager');
const pythonWrapper = require('./python-wrapper');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

// Define file paths using path manager
const DATA_DIR = pathManager.getDataDir();
const LOGS_DIR = pathManager.getLogsDir();
const HISTORY_FILE = path.join(DATA_DIR, 'viewing-history.json');
const RECOMMENDATIONS_LOG = path.join(LOGS_DIR, 'recommendations.log');

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  historyLimit: 100, // Maximum number of entries to keep
  minViewTimeSeconds: 30, // Minimum viewing time to count as interest
  maxRecommendations: 10, // Maximum number of recommendations to return
  recommendationFactors: {
    genre: 0.5,    // Weight for genre/category similarity
    viewTime: 0.3, // Weight for total view time
    recency: 0.2   // Weight for how recent the views were
  },
  useFallbackMode: false // Set to true when Python is not available
};

/**
 * ML Recommendation Engine Class
 */
class RecommendationEngine {
  constructor() {
    this.settings = DEFAULT_SETTINGS;
    this.viewingHistory = [];
    this.channelMetadata = new Map(); // Stores additional metadata about channels
    this.similarityCache = new Map(); // Cache similarity calculations
    this.fallbackMode = false; // Will be set to true if Python is not available
    
    // Load history and settings
    this.loadSettings();
    this.loadHistory();
    this.checkPythonAvailability();
  }
    /**
   * Check if Python is available
   */
  checkPythonAvailability() {
    // Use the Python wrapper to check for Python
    const isPythonAvailable = pythonWrapper.isPythonAvailable();
    
    if (isPythonAvailable) {
      this.fallbackMode = false;
      this.logInfo(`Python is available for advanced recommendations (${pythonWrapper.getVersion()})`);
    } else {
      this.fallbackMode = true;
      this.logWarning('Python is not available, using fallback recommendation mode');
      
      // Send a notification that Python is not available but the app will still work
      this.emit('notification', {
        type: 'info',
        title: 'Recommendation Engine',
        message: 'Python is not installed. Basic recommendation features will still work, but advanced features are disabled.'
      });
    }
    
    // Update settings
    this.settings.useFallbackMode = this.fallbackMode;
  }
  
  /**
   * Load recommendation engine settings
   */
  loadSettings() {
    try {
      const appSettings = config.getAll();
      if (appSettings && appSettings.recommendations) {
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...appSettings.recommendations
        };
      }
      this.logInfo('Recommendation settings loaded');
    } catch (error) {
      this.logError(`Error loading recommendation settings: ${error.message}`);
    }
  }
  
  /**
   * Save recommendation engine settings
   */
  saveSettings() {
    try {
      const appSettings = config.getAll();
      appSettings.recommendations = this.settings;
      config.setAll(appSettings);
      this.logInfo('Recommendation settings saved');
      return true;
    } catch (error) {
      this.logError(`Error saving recommendation settings: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Load viewing history
   */
  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const historyData = fs.readFileSync(HISTORY_FILE, 'utf8');
        this.viewingHistory = JSON.parse(historyData);
        this.logInfo(`Loaded ${this.viewingHistory.length} viewing history entries`);
      } else {
        this.viewingHistory = [];
        this.logInfo('No viewing history found, starting with empty history');
      }
    } catch (error) {
      this.viewingHistory = [];
      this.logError(`Error loading viewing history: ${error.message}`);
    }
  }
  
  /**
   * Save viewing history
   */
  saveHistory() {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.viewingHistory, null, 2), 'utf8');
      this.logInfo(`Saved ${this.viewingHistory.length} viewing history entries`);
      return true;
    } catch (error) {
      this.logError(`Error saving viewing history: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Add a channel viewing entry to history
   * @param {Object} channel - Channel object
   * @param {number} duration - Viewing duration in seconds
   * @returns {boolean} Success status
   */
  addChannelView(channel, duration) {
    if (!channel || !channel.id) {
      this.logError('Invalid channel object');
      return false;
    }
    
    if (!this.settings.enabled) {
      this.logInfo('Recommendation engine is disabled, not recording view history');
      return false;
    }
    
    // Only record views longer than the minimum time
    if (duration < this.settings.minViewTimeSeconds) {
      this.logInfo(`View duration ${duration}s below minimum threshold, not recording`);
      return false;
    }
    
    // Add or update viewing entry
    const timestamp = new Date().toISOString();
    const existingIndex = this.viewingHistory.findIndex(entry => entry.channelId === channel.id);
    
    if (existingIndex >= 0) {
      // Update existing entry
      this.viewingHistory[existingIndex].viewCount += 1;
      this.viewingHistory[existingIndex].totalViewTime += duration;
      this.viewingHistory[existingIndex].lastViewed = timestamp;
    } else {
      // Add new entry
      this.viewingHistory.push({
        channelId: channel.id,
        channelName: channel.name,
        channelGroup: channel.group || '',
        channelLogo: channel.logo || '',
        viewCount: 1,
        totalViewTime: duration,
        firstViewed: timestamp,
        lastViewed: timestamp
      });
    }
    
    // Ensure we don't exceed history limit
    if (this.viewingHistory.length > this.settings.historyLimit) {
      // Sort by last viewed timestamp and remove oldest entries
      this.viewingHistory.sort((a, b) => 
        new Date(b.lastViewed) - new Date(a.lastViewed)
      );
      this.viewingHistory = this.viewingHistory.slice(0, this.settings.historyLimit);
    }
    
    this.saveHistory();
    return true;
  }
  
  /**
   * Get recommendations based on viewing history
   * @param {Array} availableChannels - All available channels
   * @param {string} currentChannelId - Currently viewed channel ID (will be excluded from recommendations)
   * @returns {Array} Recommended channels
   */
  getRecommendations(availableChannels, currentChannelId = null) {
    if (!this.settings.enabled || !availableChannels || availableChannels.length === 0) {
      return [];
    }
    
    try {
      // Use fallback mode if Python is not available
      if (this.fallbackMode) {
        return this.getFallbackRecommendations(availableChannels, currentChannelId);
      }
      
      // Otherwise use the ML-based approach
      return this.getMLRecommendations(availableChannels, currentChannelId);
    } catch (error) {
      this.logError(`Error generating recommendations: ${error.message}`);
      // If ML approach fails, fall back to simpler method
      return this.getFallbackRecommendations(availableChannels, currentChannelId);
    }
  }
    /**
   * Get recommendations using machine learning approach (when Python is available)
   * @param {Array} availableChannels - All available channels
   * @param {string} currentChannelId - Currently viewed channel ID
   * @returns {Promise<Array>} Recommended channels
   */
  async getMLRecommendations(availableChannels, currentChannelId) {
    this.logInfo('Using ML-based recommendations');
    
    // If no viewing history, return random channels
    if (this.viewingHistory.length === 0) {
      this.logInfo('No viewing history, returning random recommendations');
      return this.getRandomRecommendations(availableChannels, currentChannelId);
    }
    
    // First check if we can use Python
    if (pythonWrapper.isPythonAvailable() && !this.settings.useFallbackMode) {
      try {
        // Create temp data file for Python to use
        const tempDataFile = path.join(DATA_DIR, 'recommendation-data.json');
        const tempData = {
          history: this.viewingHistory,
          channels: availableChannels,
          currentChannel: currentChannelId,
          settings: this.settings
        };
        
        // Write data to temp file
        fs.writeFileSync(tempDataFile, JSON.stringify(tempData, null, 2), 'utf8');
        
        // Path to the Python script
        const scriptPath = path.join(__dirname, 'scripts', 'recommendation-script.py');
        
        // Ensure script exists
        if (!fs.existsSync(scriptPath)) {
          this.logError(`Python recommendation script not found at: ${scriptPath}`);
          throw new Error('Recommendation script not found');
        }
        
        // Run Python script with fallback option
        const result = await pythonWrapper.runScript(
          scriptPath,
          [tempDataFile],
          {
            fallback: () => {
              this.logInfo('Python script failed, using fallback recommendations');
              return this.getFallbackRecommendations(availableChannels, currentChannelId);
            }
          }
        );
        
        // Parse result
        try {
          const pythonResult = JSON.parse(result);
          
          if (pythonResult.error) {
            throw new Error(`Python script error: ${pythonResult.error}`);
          }
          
          if (Array.isArray(pythonResult.recommendations)) {
            this.logInfo(`Retrieved ${pythonResult.recommendations.length} recommendations from Python`);
            return pythonResult.recommendations;
          }
        } catch (parseError) {
          this.logError(`Error parsing Python result: ${parseError.message}`);
          throw parseError;
        }
      } catch (error) {
        this.logError(`ML recommendation error: ${error.message}`);
        return this.getFallbackRecommendations(availableChannels, currentChannelId);
      }
    }
    
    // Fallback to basic recommendations
    return this.getFallbackRecommendations(availableChannels, currentChannelId);
  }
  
  /**
   * Get fallback recommendations without Python
   * @param {Array} availableChannels - All available channels
   * @param {string} currentChannelId - Currently viewed channel ID
   * @returns {Array} Recommended channels
   */
  getFallbackRecommendations(availableChannels, currentChannelId) {
    this.logInfo('Using fallback recommendation engine');
    
    // Calculate similarity scores and build recommendations
    const recommendations = [];
    
    // Simple content-based filtering implementation
    const topViewedChannels = this.getTopWatchedChannels(5);
    
    // For each available channel, calculate similarity to top watched channels
    for (const channel of availableChannels) {
      // Skip current channel
      if (channel.id === currentChannelId) continue;
      
      let totalScore = 0;
      
      for (const viewedChannel of topViewedChannels) {
        const similarity = this.calculateChannelSimilarity(channel, viewedChannel);
        totalScore += similarity;
      }
      
      // Normalize score
      const score = topViewedChannels.length > 0 ? totalScore / topViewedChannels.length : 0;
      
      recommendations.push({
        channel,
        score
      });
    }
    
    // Sort by score and return top recommendations
    recommendations.sort((a, b) => b.score - a.score);
    return recommendations
      .slice(0, this.settings.maxRecommendations)
      .map(rec => rec.channel);
  }
  
  /**
   * Get recommendations using a simple fallback approach (when Python is not available)
   * @param {Array} availableChannels - All available channels
   * @param {string} currentChannelId - Currently viewed channel ID
   * @returns {Array} Recommended channels
   */
  getFallbackRecommendations(availableChannels, currentChannelId) {
    this.logInfo('Using fallback recommendations');
    
    // If no viewing history, return random channels
    if (this.viewingHistory.length === 0) {
      this.logInfo('No viewing history, returning random recommendations');
      return this.getRandomRecommendations(availableChannels, currentChannelId);
    }
    
    // Get channels by group/category similarity
    const recommendations = [];
    const watchHistory = [...this.viewingHistory];
    
    // Sort history by recency and view time
    watchHistory.sort((a, b) => {
      // 70% weight on recency, 30% on view time
      const recencyScore = new Date(b.lastViewed) - new Date(a.lastViewed);
      const viewTimeScore = b.totalViewTime - a.totalViewTime;
      return (recencyScore * 0.7) + (viewTimeScore * 0.3);
    });
    
    // Get top groups/categories from watch history
    const topGroups = new Map();
    watchHistory.forEach(entry => {
      const group = entry.channelGroup || 'Unknown';
      if (!topGroups.has(group)) {
        topGroups.set(group, 0);
      }
      topGroups.set(group, topGroups.get(group) + entry.totalViewTime);
    });
    
    // Sort groups by total view time
    const sortedGroups = [...topGroups.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    // Add channels from top groups
    for (const group of sortedGroups) {
      const channelsInGroup = availableChannels.filter(
        channel => (channel.group === group || (!channel.group && group === 'Unknown')) 
                  && channel.id !== currentChannelId
                  && !recommendations.some(rec => rec.id === channel.id)
      );
      
      // Add channels from this group
      recommendations.push(...channelsInGroup);
      
      // If we have enough recommendations, stop
      if (recommendations.length >= this.settings.maxRecommendations) {
        break;
      }
    }
    
    // If we still need more, add random channels
    if (recommendations.length < this.settings.maxRecommendations) {
      const remainingCount = this.settings.maxRecommendations - recommendations.length;
      const randomChannels = this.getRandomRecommendations(
        availableChannels.filter(
          channel => channel.id !== currentChannelId && 
                   !recommendations.some(rec => rec.id === channel.id)
        ),
        null,
        remainingCount
      );
      
      recommendations.push(...randomChannels);
    }
    
    return recommendations.slice(0, this.settings.maxRecommendations);
  }
  
  /**
   * Get random channel recommendations
   * @param {Array} availableChannels - Available channels
   * @param {string} currentChannelId - Currently viewed channel ID
   * @param {number} count - Number of recommendations to return
   * @returns {Array} Random channel recommendations
   */
  getRandomRecommendations(availableChannels, currentChannelId, count = null) {
    const channels = availableChannels.filter(channel => channel.id !== currentChannelId);
    const maxCount = count || this.settings.maxRecommendations;
    
    // Shuffle array
    const shuffled = [...channels].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, maxCount);
  }
  
  /**
   * Calculate similarity between two channels
   * @param {Object} channel1 - First channel
   * @param {Object} channel2 - Second channel or history entry
   * @returns {number} Similarity score (0-1)
   */
  calculateChannelSimilarity(channel1, channel2) {
    // Check cache first
    const cacheKey = `${channel1.id}|${channel2.channelId || channel2.id}`;
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey);
    }
    
    let score = 0;
    const factors = this.settings.recommendationFactors;
    
    // Compare group/category (highest weight)
    const group1 = channel1.group || '';
    const group2 = channel2.channelGroup || channel2.group || '';
    if (group1 && group2 && group1.toLowerCase() === group2.toLowerCase()) {
      score += factors.genre;
    }
    
    // Compare channel name for similarity
    const name1 = (channel1.name || '').toLowerCase();
    const name2 = (channel2.channelName || channel2.name || '').toLowerCase();
    
    // Name similarity (simple substring check)
    if (name1 && name2) {
      if (name1.includes(name2) || name2.includes(name1)) {
        score += 0.1;
      }
    }
    
    // Cache the result
    this.similarityCache.set(cacheKey, score);
    return score;
  }
  
  /**
   * Get viewing history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Viewing history
   */
  getViewingHistory(limit = 50) {
    // Sort by recency
    const sortedHistory = [...this.viewingHistory].sort(
      (a, b) => new Date(b.lastViewed) - new Date(a.lastViewed)
    );
    
    return limit ? sortedHistory.slice(0, limit) : sortedHistory;
  }
  
  /**
   * Get top watched channels
   * @param {number} limit - Maximum number of channels to return
   * @returns {Array} Top watched channels
   */
  getTopWatchedChannels(limit = 10) {
    // Sort by total view time
    const sortedChannels = [...this.viewingHistory].sort(
      (a, b) => b.totalViewTime - a.totalViewTime
    );
    
    return limit ? sortedChannels.slice(0, limit) : sortedChannels;
  }
  
  /**
   * Clear viewing history
   * @returns {boolean} Success status
   */
  async clearHistory() {
    try {
      this.viewingHistory = [];
      const success = this.saveHistory();
      this.logInfo('Viewing history cleared');
      return success;
    } catch (error) {
      this.logError(`Error clearing viewing history: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Update recommendation engine settings
   * @param {Object} newSettings - New settings
   * @returns {boolean} Success status
   */
  updateSettings(newSettings) {
    try {
      this.settings = {
        ...this.settings,
        ...newSettings
      };
      
      const success = this.saveSettings();
      this.logInfo('Recommendation settings updated');
      return success;
    } catch (error) {
      this.logError(`Error updating recommendation settings: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Log an info message
   * @param {string} message - Message to log
   */
  logInfo(message) {
    log.info(`[Recommendations] ${message}`);
  }
  
  /**
   * Log a warning message
   * @param {string} message - Message to log
   */
  logWarning(message) {
    log.warn(`[Recommendations] ${message}`);
  }
  
  /**
   * Log an error message
   * @param {string} message - Message to log
   */
  logError(message) {
    log.error(`[Recommendations] ${message}`);
  }
}

module.exports = new RecommendationEngine();

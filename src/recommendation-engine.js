/**
 * ML Recommendation Engine
 * 
 * This module provides channel recommendations based on viewing history
 * using simple machine learning techniques for content-based filtering.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const log = require('electron-log');
const platform = require('./platform');
const config = require('./config-manager');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

// Import path manager
const pathManager = require('./path-manager');

// Define file paths using centralized path manager
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
  }
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
    
    // Load history and settings
    this.loadSettings();
    this.loadHistory();
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
      const appSettings = config.getAll() || {};
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
   * Load viewing history from file
   */
  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        if (Array.isArray(parsed.history)) {
          this.viewingHistory = parsed.history;
          this.logInfo(`Loaded viewing history with ${this.viewingHistory.length} entries`);
        }
        
        if (parsed.channelMetadata && typeof parsed.channelMetadata === 'object') {
          this.channelMetadata = new Map(Object.entries(parsed.channelMetadata));
          this.logInfo(`Loaded metadata for ${this.channelMetadata.size} channels`);
        }
      } else {
        this.logInfo('No viewing history file found, starting fresh');
        this.viewingHistory = [];
        this.saveHistory(); // Create the initial file
      }
    } catch (error) {
      this.logError(`Error loading viewing history: ${error.message}`);
      this.viewingHistory = [];
      this.channelMetadata = new Map();
    }
  }
  
  /**
   * Save viewing history to file
   */
  async saveHistory() {
    try {
      // Convert channelMetadata Map to Object for JSON serialization
      const metadataObj = {};
      for (const [key, value] of this.channelMetadata.entries()) {
        metadataObj[key] = value;
      }
      
      const data = JSON.stringify({
        history: this.viewingHistory,
        channelMetadata: metadataObj
      }, null, 2);
      
      await promisify(fs.writeFile)(HISTORY_FILE, data, 'utf8');
      this.logInfo('Viewing history saved');
      return true;
    } catch (error) {
      this.logError(`Error saving viewing history: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Record channel viewing activity
   * @param {Object} channel - Channel information
   * @param {number} durationSeconds - Viewing duration in seconds
   */
  async recordViewing(channel, durationSeconds) {
    if (!this.settings.enabled || !channel || !channel.id) {
      return false;
    }
    
    // Skip if viewing time is too short
    if (durationSeconds < this.settings.minViewTimeSeconds) {
      this.logInfo(`Skipping short view (${durationSeconds}s) for ${channel.title}`);
      return false;
    }
    
    const timestamp = Date.now();
    
    // Look for existing entry for this channel from today
    const today = new Date().toDateString();
    const existingEntryIndex = this.viewingHistory.findIndex(entry => 
      entry.channelId === channel.id && 
      new Date(entry.lastViewed).toDateString() === today
    );
    
    if (existingEntryIndex >= 0) {
      // Update existing entry
      const entry = this.viewingHistory[existingEntryIndex];
      entry.viewCount += 1;
      entry.totalViewTime += durationSeconds;
      entry.lastViewed = timestamp;
      
      // Move to the beginning of the array (most recent)
      this.viewingHistory.splice(existingEntryIndex, 1);
      this.viewingHistory.unshift(entry);
    } else {
      // Create new entry
      this.viewingHistory.unshift({
        channelId: channel.id,
        channelTitle: channel.title,
        viewCount: 1,
        totalViewTime: durationSeconds,
        firstViewed: timestamp,
        lastViewed: timestamp,
        group: channel.group || 'Uncategorized'
      });
    }
    
    // Store/update channel metadata
    this.updateChannelMetadata(channel);
    
    // Trim history if needed
    if (this.viewingHistory.length > this.settings.historyLimit) {
      this.viewingHistory = this.viewingHistory.slice(0, this.settings.historyLimit);
    }
    
    // Save the updated history
    await this.saveHistory();
    
    // Clear the similarity cache since history changed
    this.similarityCache.clear();
    
    this.logInfo(`Recorded ${durationSeconds}s viewing of ${channel.title}`);
    return true;
  }
  
  /**
   * Update channel metadata
   * @param {Object} channel - Channel information
   */
  updateChannelMetadata(channel) {
    if (!channel || !channel.id) return;
    
    const existingMetadata = this.channelMetadata.get(channel.id) || {};
    
    this.channelMetadata.set(channel.id, {
      ...existingMetadata,
      id: channel.id,
      title: channel.title,
      logo: channel.logo,
      group: channel.group || existingMetadata.group || 'Uncategorized',
      language: channel.language || existingMetadata.language,
      tags: channel.tags || existingMetadata.tags || [],
      // Extract any additional metadata that might be useful for recommendations
      tvgName: channel.attributes?.['tvg-name'],
      tvgLogo: channel.attributes?.['tvg-logo'],
      groupTitle: channel.attributes?.['group-title'],
      tvgId: channel.attributes?.['tvg-id']
    });
  }
  
  /**
   * Get channel recommendations based on viewing history
   * @param {Array} allChannels - All available channels
   * @param {string|null} currentChannelId - Current channel ID (to exclude from recommendations)
   * @returns {Array} - List of recommended channels
   */
  getRecommendations(allChannels, currentChannelId = null) {
    if (!this.settings.enabled || this.viewingHistory.length === 0) {
      return [];
    }
    
    try {
      // Get the most recently viewed channels
      const recentlyViewedEntries = [...this.viewingHistory].sort(
        (a, b) => b.lastViewed - a.lastViewed
      ).slice(0, 20); // Focus on recent history
      
      // Calculate similarity scores for all channels
      const channelScores = allChannels.map(channel => {
        // Skip the current channel
        if (channel.id === currentChannelId) {
          return null;
        }
        
        // Calculate similarity score based on viewing history
        const similarityScore = this.calculateSimilarityScore(channel, recentlyViewedEntries);
        
        return {
          channel,
          score: similarityScore
        };
      }).filter(item => item !== null);
      
      // Sort by similarity score (descending)
      channelScores.sort((a, b) => b.score - a.score);
      
      // Take top N recommendations
      const topRecommendations = channelScores
        .slice(0, this.settings.maxRecommendations)
        .map(item => ({
          ...item.channel,
          recommendationScore: item.score
        }));
      
      this.logInfo(`Generated ${topRecommendations.length} recommendations`);
      return topRecommendations;
    } catch (error) {
      this.logError(`Error generating recommendations: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Calculate similarity score between a channel and viewing history
   * @param {Object} channel - Channel to calculate similarity for
   * @param {Array} historyEntries - Viewing history entries
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarityScore(channel, historyEntries) {
    // Check cache first
    const cacheKey = `${channel.id}_${historyEntries.length}_${historyEntries[0]?.lastViewed || 0}`;
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey);
    }
    
    // Get weights for different factors
    const { genre, viewTime, recency } = this.settings.recommendationFactors;
    
    // Initialize scores
    let genreScore = 0;
    let viewTimeScore = 0;
    let recencyScore = 0;
    
    // Get total view time across all entries
    const totalViewTime = historyEntries.reduce((sum, entry) => sum + entry.totalViewTime, 0);
    
    // Get the most recent timestamp
    const mostRecentTimestamp = Math.max(...historyEntries.map(entry => entry.lastViewed));
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Calculate scores for each history entry
    historyEntries.forEach(entry => {
      // Skip if it's the same channel
      if (entry.channelId === channel.id) {
        return;
      }
      
      // Genre/group similarity
      if (channel.group && entry.group && channel.group === entry.group) {
        genreScore += entry.totalViewTime / totalViewTime;
      }
      
      // View time factor (channels similar to ones watched a lot)
      viewTimeScore += entry.totalViewTime / totalViewTime;
      
      // Recency factor (more recent views have higher weight)
      const daysSinceViewed = (now - entry.lastViewed) / dayInMs;
      recencyScore += (1 / (1 + daysSinceViewed)) * (entry.totalViewTime / totalViewTime);
    });
    
    // Normalize scores to 0-1 range
    genreScore = Math.min(1, genreScore);
    viewTimeScore = Math.min(1, viewTimeScore);
    recencyScore = Math.min(1, recencyScore);
    
    // Calculate final weighted score
    const finalScore = (
      genre * genreScore +
      viewTime * viewTimeScore +
      recency * recencyScore
    );
    
    // Cache the result
    this.similarityCache.set(cacheKey, finalScore);
    
    return finalScore;
  }
  
  /**
   * Get viewing history
   * @param {number|null} limit - Limit number of entries
   * @returns {Array} - Viewing history entries
   */
  getViewingHistory(limit = null) {
    const history = [...this.viewingHistory];
    
    if (limit && limit > 0) {
      return history.slice(0, limit);
    }
    
    return history;
  }
  
  /**
   * Get viewing statistics for a channel
   * @param {string} channelId - Channel ID
   * @returns {Object|null} - Channel viewing statistics
   */
  getChannelStatistics(channelId) {
    if (!channelId) return null;
    
    const entries = this.viewingHistory.filter(entry => entry.channelId === channelId);
    
    if (entries.length === 0) {
      return null;
    }
    
    // Calculate statistics
    const totalViewCount = entries.reduce((sum, entry) => sum + entry.viewCount, 0);
    const totalViewTime = entries.reduce((sum, entry) => sum + entry.totalViewTime, 0);
    const firstViewed = Math.min(...entries.map(entry => entry.firstViewed));
    const lastViewed = Math.max(...entries.map(entry => entry.lastViewed));
    
    return {
      channelId,
      channelTitle: entries[0].channelTitle,
      totalViewCount,
      totalViewTime,
      firstViewed,
      lastViewed,
      daysSinceFirstViewed: Math.floor((Date.now() - firstViewed) / (24 * 60 * 60 * 1000)),
      daysSinceLastViewed: Math.floor((Date.now() - lastViewed) / (24 * 60 * 60 * 1000)),
      averageViewDuration: totalViewTime / totalViewCount
    };
  }
  
  /**
   * Clear viewing history
   * @returns {Promise<boolean>} - Success status
   */
  async clearHistory() {
    this.viewingHistory = [];
    this.similarityCache.clear();
    return await this.saveHistory();
  }
  
  /**
   * Get top watched channels
   * @param {number} limit - Maximum number of channels to return
   * @returns {Array} - Top watched channels
   */
  getTopWatchedChannels(limit = 10) {
    // Group by channel and calculate total view time
    const channelMap = new Map();
    
    this.viewingHistory.forEach(entry => {
      const existingData = channelMap.get(entry.channelId) || {
        channelId: entry.channelId,
        channelTitle: entry.channelTitle,
        totalViewTime: 0,
        viewCount: 0,
        lastViewed: 0
      };
      
      channelMap.set(entry.channelId, {
        ...existingData,
        totalViewTime: existingData.totalViewTime + entry.totalViewTime,
        viewCount: existingData.viewCount + entry.viewCount,
        lastViewed: Math.max(existingData.lastViewed, entry.lastViewed)
      });
    });
    
    // Convert to array and sort by total view time
    const sortedChannels = Array.from(channelMap.values())
      .sort((a, b) => b.totalViewTime - a.totalViewTime);
    
    return sortedChannels.slice(0, limit);
  }
  
  /**
   * Update recommendation engine settings
   * @param {Object} newSettings - New settings
   * @returns {boolean} - Success status
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    return this.saveSettings();
  }
    /**
   * Log info message
   * @param {string} message - Message to log
   */
  logInfo(message) {
    log.info(`[RecommendationEngine] ${message}`);
    
    try {
      // Also log to recommendations log file
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [INFO] ${message}\n`;
      fs.appendFileSync(RECOMMENDATIONS_LOG, logMessage);
    } catch (error) {
      // Silently fail if we can't write to the log file
      log.warn(`[RecommendationEngine] Could not write to log: ${error.message}`);
    }
  }
    /**
   * Log warning message
   * @param {string} message - Message to log
   */
  logWarning(message) {
    log.warn(`[RecommendationEngine] ${message}`);
    
    try {
      // Also log to recommendations log file
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [WARN] ${message}\n`;
      fs.appendFileSync(RECOMMENDATIONS_LOG, logMessage);
    } catch (error) {
      // Silently fail if we can't write to the log file
      log.warn(`[RecommendationEngine] Could not write to log: ${error.message}`);
    }
  }
    /**
   * Log error message
   * @param {string} message - Message to log
   */
  logError(message) {
    log.error(`[RecommendationEngine] ${message}`);
    
    try {
      // Also log to recommendations log file
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [ERROR] ${message}\n`;
      fs.appendFileSync(RECOMMENDATIONS_LOG, logMessage);
    } catch (error) {
      // Silently fail if we can't write to the log file
      log.warn(`[RecommendationEngine] Could not write to log: ${error.message}`);
    }
  }
}

module.exports = new RecommendationEngine();

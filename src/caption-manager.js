/**
 * Closed Caption Manager
 * 
 * This module handles fetching, parsing, and displaying closed captions
 * from streams, as well as AI-enhanced caption generation.
 */

const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const webvtt = require('node-webvtt');
const srtParser = require('subtitles-parser');
const { Ollama } = require('ollama');
const platform = require('./platform');
const config = require('./config-manager');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

// Define file paths
const DATA_DIR = path.join(platform.getAppDataPath());
const CAPTIONS_DIR = path.join(DATA_DIR, 'captions');
const CAPTIONS_LOG_FILE = path.join(__dirname, '..', 'tests', 'captions.log');

// Ensure necessary directories exist
if (!fs.existsSync(CAPTIONS_DIR)) {
  fs.mkdirSync(CAPTIONS_DIR, { recursive: true });
}

// Default caption settings
const DEFAULT_CAPTION_SETTINGS = {
  enabled: false,
  size: 'medium', // small, medium, large
  color: '#FFFFFF', // white
  backgroundColor: 'rgba(0, 0, 0, 0.75)', // semi-transparent black
  position: 'bottom', // top, middle, bottom
  font: 'sans-serif',
  aiEnhancement: {
    enabled: false,
    mode: 'standard', // standard, simplified, academic, casual
    translateTo: '', // empty for no translation
    ollamaEndpoint: 'http://localhost:11434',
    model: 'phi4-mini-reasoning'
  }
};

// Cache for captions
const captionsCache = new Map();

/**
 * Caption Manager Class
 */
class CaptionManager {
  constructor() {
    this.settings = DEFAULT_CAPTION_SETTINGS;
    this.currentCaptions = null;
    this.currentLanguage = 'en';
    this.ollama = null;
    this.isProcessingCaptions = false;
    this.aiStreamCache = new Map(); // Cache for AI-processed captions
    
    // Load settings
    this.loadSettings();
    
    // Initialize Ollama if enabled
    this.initOllama();
  }
  
  /**
   * Load caption settings from config
   */
  loadSettings() {
    try {
      const appSettings = config.getAll();
      if (appSettings && appSettings.captions) {
        this.settings = {
          ...DEFAULT_CAPTION_SETTINGS,
          ...appSettings.captions
        };
        this.logInfo('Caption settings loaded');
      }
    } catch (error) {
      this.logError(`Error loading caption settings: ${error.message}`);
    }
  }
  
  /**
   * Save caption settings to config
   */
  saveSettings() {
    try {
      const appSettings = config.getAll() || {};
      appSettings.captions = this.settings;
      config.setAll(appSettings);
      this.logInfo('Caption settings saved');
      return true;
    } catch (error) {
      this.logError(`Error saving caption settings: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Initialize Ollama client if AI enhancement is enabled
   */
  initOllama() {
    if (this.settings.aiEnhancement.enabled) {
      try {
        this.ollama = new Ollama({
          host: this.settings.aiEnhancement.ollamaEndpoint
        });
        
        this.testOllamaConnection();
      } catch (error) {
        this.logError(`Error initializing Ollama: ${error.message}`);
        this.settings.aiEnhancement.enabled = false;
      }
    }
  }
  
  /**
   * Test connection to Ollama server
   */
  async testOllamaConnection() {
    if (!this.ollama) return false;
    
    try {
      const models = await this.ollama.list();
      const hasRequiredModel = models.models.some(
        model => model.name.includes(this.settings.aiEnhancement.model)
      );
      
      if (!hasRequiredModel) {
        this.logWarning(`Required model ${this.settings.aiEnhancement.model} not found in Ollama`);
      }
      
      this.logInfo('Connected to Ollama successfully');
      return true;
    } catch (error) {
      this.logError(`Failed to connect to Ollama: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Update caption settings
   * @param {Object} newSettings - New caption settings
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    // If AI settings changed, reinitialize Ollama
    if (newSettings.aiEnhancement) {
      this.initOllama();
    }
    
    return this.saveSettings();
  }
  
  /**
   * Get current caption styles as CSS
   * @returns {Object} - CSS styles object
   */
  getCaptionStyles() {
    const { size, color, backgroundColor, position, font } = this.settings;
    
    // Base font sizes
    const fontSizes = {
      small: '16px',
      medium: '22px',
      large: '28px'
    };
    
    // Position styles
    const positions = {
      top: { top: '40px', bottom: 'auto' },
      middle: { top: '50%', transform: 'translateY(-50%)' },
      bottom: { bottom: '80px', top: 'auto' }
    };
    
    return {
      color,
      backgroundColor,
      fontFamily: font,
      fontSize: fontSizes[size] || fontSizes.medium,
      textAlign: 'center',
      padding: '6px 12px',
      borderRadius: '4px',
      maxWidth: '80%',
      margin: '0 auto',
      position: 'absolute',
      left: '50%',
      transform: position === 'middle' ? 'translate(-50%, -50%)' : 'translateX(-50%)',
      zIndex: 1000,
      textShadow: '1px 1px 1px rgba(0, 0, 0, 0.5)',
      ...positions[position]
    };
  }
  
  /**
   * Fetch captions for a stream
   * @param {string} streamUrl - The URL of the stream
   * @param {string} channelId - The channel ID
   */
  async fetchCaptions(streamUrl, channelId) {
    if (!this.settings.enabled || !streamUrl) {
      return null;
    }
    
    // Check cache first
    if (captionsCache.has(streamUrl)) {
      this.logInfo(`Using cached captions for ${channelId}`);
      return captionsCache.get(streamUrl);
    }
    
    try {
      // Extract captions URL from HLS manifest if available
      if (streamUrl.endsWith('.m3u8')) {
        const captionsInfo = await this.extractCaptionsFromHLS(streamUrl);
        if (captionsInfo) {
          captionsCache.set(streamUrl, captionsInfo);
          this.logInfo(`Extracted captions for ${channelId}: ${captionsInfo.language}`);
          return captionsInfo;
        }
      }
      
      // Check for sidecar caption files
      const captionsInfo = await this.findSidecarCaptions(streamUrl, channelId);
      if (captionsInfo) {
        captionsCache.set(streamUrl, captionsInfo);
        return captionsInfo;
      }
      
      this.logInfo(`No captions found for ${channelId}`);
      return null;
    } catch (error) {
      this.logError(`Error fetching captions: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Extract captions from HLS manifest
   * @param {string} hlsUrl - HLS manifest URL
   * @returns {Object|null} - Caption information if found
   */
  async extractCaptionsFromHLS(hlsUrl) {
    try {
      const response = await fetch(hlsUrl);
      const manifest = await response.text();
      
      // Look for subtitle tracks in the manifest
      const subtitleMatches = manifest.match(/#EXT-X-MEDIA:TYPE=SUBTITLES[^\n]+/g);
      
      if (!subtitleMatches || subtitleMatches.length === 0) {
        return null;
      }
      
      // Process the first subtitle track
      const subtitleInfo = subtitleMatches[0];
      const urlMatch = subtitleInfo.match(/URI="([^"]+)"/);
      const languageMatch = subtitleInfo.match(/LANGUAGE="([^"]+)"/);
      
      if (!urlMatch) return null;
      
      // Construct absolute URL
      const baseUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/') + 1);
      const subtitleUrl = new URL(urlMatch[1], baseUrl).href;
      
      return {
        url: subtitleUrl,
        format: subtitleUrl.endsWith('.vtt') ? 'vtt' : 'unknown',
        language: languageMatch ? languageMatch[1] : 'en'
      };
    } catch (error) {
      this.logError(`Error extracting captions from HLS: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Find sidecar caption files (SRT or VTT)
   * @param {string} streamUrl - Stream URL
   * @param {string} channelId - Channel ID
   * @returns {Object|null} - Caption information if found
   */
  async findSidecarCaptions(streamUrl, channelId) {
    try {
      // Common caption extensions to check
      const extensions = ['vtt', 'srt'];
      
      for (const ext of extensions) {
        // Check for same name with different extension
        const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('.'));
        const captionUrl = `${baseUrl}.${ext}`;
        
        try {
          const response = await fetch(captionUrl, { method: 'HEAD' });
          if (response.ok) {
            return {
              url: captionUrl,
              format: ext,
              language: 'en' // Default language
            };
          }
        } catch {
          // Continue to next method if this fails
        }
        
        // Check for channel ID-based filename in the same directory
        const dirUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
        const idBasedUrl = `${dirUrl}${channelId}.${ext}`;
        
        try {
          const response = await fetch(idBasedUrl, { method: 'HEAD' });
          if (response.ok) {
            return {
              url: idBasedUrl,
              format: ext,
              language: 'en'
            };
          }
        } catch {
          // Continue to next method if this fails
        }
      }
      
      return null;
    } catch (error) {
      this.logError(`Error finding sidecar captions: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Load captions from URL
   * @param {Object} captionsInfo - Caption information with URL and format
   * @returns {Array} - Array of parsed caption entries
   */
  async loadCaptions(captionsInfo) {
    if (!captionsInfo || !captionsInfo.url) return [];
    
    try {
      const response = await fetch(captionsInfo.url);
      const content = await response.text();
      
      if (captionsInfo.format === 'vtt') {
        return this.parseVTT(content);
      } else if (captionsInfo.format === 'srt') {
        return this.parseSRT(content);
      } else {
        // Try to auto-detect format
        if (content.includes('WEBVTT')) {
          return this.parseVTT(content);
        } else {
          return this.parseSRT(content);
        }
      }
    } catch (error) {
      this.logError(`Error loading captions: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Parse WebVTT content
   * @param {string} content - WebVTT content
   * @returns {Array} - Array of caption entries
   */
  parseVTT(content) {
    try {
      const parsed = webvtt.parse(content, { strict: false });
      return parsed.cues.map(cue => ({
        id: cue.identifier || `caption-${cue.start}`,
        start: cue.start * 1000, // Convert to ms
        end: cue.end * 1000,
        text: cue.text
      }));
    } catch (error) {
      this.logError(`Error parsing VTT: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Parse SRT content
   * @param {string} content - SRT content
   * @returns {Array} - Array of caption entries
   */
  parseSRT(content) {
    try {
      const parsed = srtParser.fromSrt(content);
      return parsed.map(item => ({
        id: `caption-${item.id}`,
        start: parseInt(item.startTime),
        end: parseInt(item.endTime),
        text: item.text
      }));
    } catch (error) {
      this.logError(`Error parsing SRT: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Parse a caption file from disk
   * @param {string} filePath - Path to caption file
   * @returns {Array} - Array of parsed caption entries
   */
  async parseCaptionFile(filePath) {
    try {
      const content = await promisify(fs.readFile)(filePath, 'utf8');
      const extension = path.extname(filePath).toLowerCase();
      
      if (extension === '.vtt') {
        return this.parseVTT(content);
      } else if (extension === '.srt') {
        return this.parseSRT(content);
      } else {
        // Try to auto-detect format
        if (content.includes('WEBVTT')) {
          return this.parseVTT(content);
        } else {
          return this.parseSRT(content);
        }
      }
    } catch (error) {
      this.logError(`Error parsing caption file: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get caption text for specific time
   * @param {number} time - Current time in milliseconds
   * @param {Array} captions - Array of caption entries
   * @returns {string|null} - Caption text if found
   */
  getCaptionAtTime(time, captions) {
    if (!captions || captions.length === 0) return null;
    
    for (const caption of captions) {
      if (time >= caption.start && time <= caption.end) {
        return caption.text;
      }
    }
    
    return null;
  }
  
  /**
   * Process caption with AI enhancement
   * @param {string} text - Caption text to enhance
   * @param {string} mode - Enhancement mode
   * @returns {Promise<string>} - Enhanced caption text
   */
  async enhanceCaptionWithAI(text, mode = null) {
    if (!text || !this.settings.aiEnhancement.enabled || !this.ollama) {
      return text;
    }
    
    const enhancementMode = mode || this.settings.aiEnhancement.mode;
    
    // Check cache first
    const cacheKey = `${text}_${enhancementMode}`;
    if (this.aiStreamCache.has(cacheKey)) {
      return this.aiStreamCache.get(cacheKey);
    }
    
    try {
      // Generate appropriate prompt based on mode
      let prompt = '';
      
      switch (enhancementMode) {
        case 'simplified':
          prompt = `Simplify this caption to use basic vocabulary and short sentences, preserving all important information: "${text}"`;
          break;
          
        case 'academic':
          prompt = `Transform this caption to use academic language and add brief explanations for complex terms in parentheses: "${text}"`;
          break;
          
        case 'casual':
          prompt = `Rewrite this caption to be more conversational and casual, like someone speaking to a friend: "${text}"`;
          break;
          
        case 'standard':
        default:
          // For standard mode, just check for errors and correct them
          prompt = `Correct any errors in this caption text, maintaining the same meaning: "${text}"`;
          break;
      }
      
      const response = await this.ollama.generate({
        model: this.settings.aiEnhancement.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 100
        }
      });
      
      let enhancedText = response.response.trim();
      
      // Remove quotes if the AI included them
      if ((enhancedText.startsWith('"') && enhancedText.endsWith('"')) ||
          (enhancedText.startsWith("'") && enhancedText.endsWith("'"))) {
        enhancedText = enhancedText.slice(1, -1);
      }
      
      // Cache the result
      this.aiStreamCache.set(cacheKey, enhancedText);
      
      // Limit cache size
      if (this.aiStreamCache.size > 1000) {
        const oldestKey = this.aiStreamCache.keys().next().value;
        this.aiStreamCache.delete(oldestKey);
      }
      
      return enhancedText;
    } catch (error) {
      this.logError(`Error enhancing caption with AI: ${error.message}`);
      return text; // Return original text if enhancement fails
    }
  }
  
  /**
   * Handle timeupdate event from video player
   * @param {number} currentTime - Current video time in seconds
   * @param {Array} captions - Parsed captions
   * @param {Function} displayCallback - Function to call with caption text
   */
  async handleTimeUpdate(currentTime, captions, displayCallback) {
    if (!this.settings.enabled || !captions || captions.length === 0) {
      displayCallback(null);
      return;
    }
    
    // Convert to milliseconds
    const timeMs = currentTime * 1000;
    
    // Find caption for current time
    const captionText = this.getCaptionAtTime(timeMs, captions);
    
    if (captionText) {
      if (this.settings.aiEnhancement.enabled && !this.isProcessingCaptions) {
        // Use AI enhancement if enabled
        this.isProcessingCaptions = true;
        try {
          const enhancedText = await this.enhanceCaptionWithAI(captionText);
          displayCallback(enhancedText);
        } catch (error) {
          displayCallback(captionText); // Fallback to original on error
        } finally {
          this.isProcessingCaptions = false;
        }
      } else {
        // Display original caption
        displayCallback(captionText);
      }
    } else {
      displayCallback(null);
    }
  }
  
  /**
   * Log info message
   * @param {string} message - Message to log
   */
  logInfo(message) {
    log.info(`[CaptionManager] ${message}`);
  }
  
  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  logWarning(message) {
    log.warn(`[CaptionManager] ${message}`);
  }
  
  /**
   * Log error message
   * @param {string} message - Message to log
   */
  logError(message) {
    log.error(`[CaptionManager] ${message}`);
  }
}

module.exports = new CaptionManager();

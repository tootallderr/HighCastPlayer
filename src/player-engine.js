/**
 * IPTV Player Engine
 * 
 * This module provides the core functionality for channel navigation,
 * video playback, and stream recording.
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');
const { app } = require('electron');
const platform = require('./platform');
const pathManager = require('./path-manager');
const playlistManager = require('./playlist-manager');
const captionManager = require('./caption-manager');
// Use recommendation engine from main app, which can be either the original or improved version
const recommendationEngine = require('./recommendation-engine');
const config = require('./config-manager');

// Define paths using the centralized path manager
const DATA_DIR = pathManager.getDataDir();
const RECORDINGS_DIR = pathManager.getRecordingsDir();
const LOGS_DIR = pathManager.getLogsDir();
const LOG_FILE = path.join(LOGS_DIR, 'player.log');
const RECORDING_LOG_FILE = path.join(LOGS_DIR, 'recording.log');

// The path manager already ensures directories exist, so we don't need these checks

// Set FFmpeg path
if (platform.isWindows) {
  const ffmpegPath = path.join(process.env.APPDATA, 'iptv-player', 'bin', 'ffmpeg.exe');
  if (fs.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
}

// Add currentStreamInfo to the state variables
let currentStreamInfo = null;

// Current state
let currentChannel = null;
let channels = [];
let isPlaying = false;
let isRecording = false;
let currentRecorder = null;
let currentRecordingPath = null;
let currentPlaybackTime = 0;
let currentBuffer = null;
let timeShiftActive = false;
let playbackQuality = { bitrate: 0, resolution: '', codec: '' };

/**
 * Logger function for player events
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, formattedMessage);
  
  // Also output to console if not in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Player] ${message}`);
  }
}

/**
 * Logger function specifically for recording events
 */
function recordingLog(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  // Append to recording log file
  fs.appendFileSync(RECORDING_LOG_FILE, formattedMessage);
  
  // Also log to player log
  log(message, level);
}

// Track initialization state
let initialized = false;

/**
 * Initialize the player engine
 */
async function initialize() {
  log('Initializing player engine');
  
  // Check for FFmpeg
  if (!platform.hasFFmpeg()) {
    log('FFmpeg not found, recording functionality will be limited', 'warn');
  }
  
  // Load channels from merged playlist
  await loadChannels();
  
  // Set initialized flag
  initialized = true;
  
  log('Player engine initialized');
  return { success: true };
}

/**
 * Load channels from the merged playlist
 */
async function loadChannels() {
  log('Loading channels from playlist');
  
  try {
    // Get path to merged playlist
    const mergedPlaylistPath = playlistManager.getMergedPlaylistPath();
    let playlistExists = fs.existsSync(mergedPlaylistPath);

    // If playlist doesn't exist or is empty, update playlists
    if (!playlistExists || fs.statSync(mergedPlaylistPath).size === 0) {
      log('Merged playlist not found or empty, updating playlists...', 'warn');
      try {
        log('Starting updateAllPlaylists...');
        const updateResult = await playlistManager.updateAllPlaylists();
        log(`Playlist update result: ${JSON.stringify(updateResult)}`);
        
        // Check if the update was successful
        if (updateResult && updateResult.success) {
          log(`Playlist update successful: ${updateResult.channels} channels.`, 'info');
          playlistExists = true;
        } else {
          log(`Playlist update failed: ${updateResult ? updateResult.error : 'Unknown error'}`, 'error');
          
          // Create a minimal valid playlist file if one doesn't exist
          if (!fs.existsSync(mergedPlaylistPath)) {
            log('Creating minimal valid playlist file after failed update', 'warn');
            const minimalPlaylist = '#EXTM3U\n#PLAYLIST: IPTV Player Merged Playlist (Error Recovery)\n';
            fs.writeFileSync(mergedPlaylistPath, minimalPlaylist, 'utf8');
            playlistExists = true;
          }
        }
      } catch (updateError) {
        log(`Error during playlist update: ${updateError.message}`, 'error');
        
        // Create a minimal valid playlist file if one doesn't exist
        if (!fs.existsSync(mergedPlaylistPath)) {
          log('Creating minimal valid playlist file after update error', 'warn');
          const minimalPlaylist = '#EXTM3U\n#PLAYLIST: IPTV Player Merged Playlist (Error Recovery)\n';
          fs.writeFileSync(mergedPlaylistPath, minimalPlaylist, 'utf8');
          playlistExists = true;
        }
      }
    }
    
    // At this point we should have a playlist file (even if it's empty/minimal)
    log(`Reading playlist file: ${mergedPlaylistPath}`);
    const playlistContent = fs.readFileSync(mergedPlaylistPath, 'utf8');
    
    // Parse the playlist content
    log('Parsing playlist content');
    const parsedChannels = parseM3U8Playlist(playlistContent);
    
    channels = parsedChannels;
    log(`Loaded ${channels.length} channels from playlist: ${mergedPlaylistPath}`);
    
    // If no channels were found, check if we should try sample channels
    if (channels.length === 0) {
      log('No channels found in playlist, checking for sample channels', 'warn');
      
      try {
        const sampleChannelsPath = path.join(pathManager.getDataDir(), 'sample-channels.m3u8');
        
        // Check if sample channels exist
        if (fs.existsSync(sampleChannelsPath)) {
          log('Using sample channels as fallback', 'info');
          const sampleContent = fs.readFileSync(sampleChannelsPath, 'utf8');
          channels = parseM3U8Playlist(sampleContent);
          log(`Loaded ${channels.length} sample channels`);
        } else {
          // Create minimal sample channel
          log('Creating minimal sample channel', 'warn');
          
          channels = [{
            id: 'sample-1',
            title: 'Sample Channel',
            duration: -1,
            logo: '',
            group: 'Samples',
            url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Public test stream
            attributes: {
              'tvg-id': 'sample-1',
              'tvg-name': 'Sample Channel',
              'group-title': 'Samples'
            }
          }];
          
          // Write sample channel to file
          const samplePlaylist = '#EXTM3U\n#EXTINF:-1 tvg-id="sample-1" tvg-name="Sample Channel" group-title="Samples",Sample Channel\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n';
          fs.writeFileSync(sampleChannelsPath, samplePlaylist, 'utf8');
          log('Created minimal sample channel file', 'warn');
        }
      } catch (sampleError) {
        log(`Error handling sample channels: ${sampleError.message}`, 'error');
      }
    }
    
    return channels;
  } catch (error) {
    log(`Error loading channels: ${error.message}`, 'error');
    
    // Return a minimal channel array on error
    channels = [{
      id: 'error-1',
      title: 'Error Loading Channels',
      duration: -1,
      logo: '',
      group: 'Error',
      url: '',
      attributes: {
        'tvg-id': 'error-1',
        'tvg-name': 'Error Loading Channels',
        'group-title': 'Error'
      }
    }];
    
    return channels;
  }
}

/**
 * Parse M3U8 playlist content and extract channels
 */
function parseM3U8Playlist(content) {
  log('Parsing M3U8 playlist content');
  
  const result = [];
  let currentChannel = null;
  let channelCount = 0;
  let errorCount = 0;
  
  try {
    // Split content by newlines
    const lines = content.split(/\r?\n/);
    
    // Check if file starts with #EXTM3U
    if (lines.length === 0 || !lines[0].trim().startsWith('#EXTM3U')) {
      log('Not a valid M3U8 file (missing #EXTM3U header)', 'warn');
      // Continue with parsing instead of returning empty array
      // This ensures we at least try to extract any valid channels
    }
    
    // Process each line
    for (const line of lines) {
      const trimLine = line.trim();
      
      // Skip empty lines and non-EXTINF comments
      if (trimLine === '' || (trimLine.startsWith('#') && !trimLine.startsWith('#EXTINF:'))) {
        continue;
      }
      
      // Process channel information line
      if (trimLine.startsWith('#EXTINF:')) {
        try {
          // Parse the EXTINF line
          const infoMatch = /#EXTINF:(-?\d+\.?\d*),(.*)/.exec(trimLine);
          
          if (infoMatch) {
            const duration = parseFloat(infoMatch[1]);
            const title = infoMatch[2] || `Unnamed Channel`;
            
            // Extract attributes
            const attributes = {};
            const attrMatches = Array.from(trimLine.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g));
            
            for (const match of attrMatches) {
              attributes[match[1]] = match[2];
            }
            
            // Create channel object
            channelCount++;
            currentChannel = {
              id: attributes['tvg-id'] || `channel-${channelCount}`,
              title: title,
              duration: duration,
              logo: attributes['tvg-logo'] || null,
              group: attributes['group-title'] || 'Uncategorized',
              attributes: attributes
            };
          } else {
            // Malformed EXTINF line, try simpler parsing
            const simplifiedMatch = /#EXTINF:[^,]*,(.*)/.exec(trimLine);
            if (simplifiedMatch) {
              const title = simplifiedMatch[1] || `Unnamed Channel ${channelCount + 1}`;
              
              // Create minimal channel object
              channelCount++;
              currentChannel = {
                id: `channel-${channelCount}`,
                title: title,
                duration: -1,
                logo: null,
                group: 'Uncategorized',
                attributes: {}
              };
              
              log(`Recovered from malformed EXTINF: created minimal channel "${title}"`, 'warn');
            } else {
              log(`Skipping malformed EXTINF line: ${trimLine}`, 'warn');
              errorCount++;
            }
          }
        } catch (error) {
          log(`Error parsing EXTINF line: ${error.message}`, 'error');
          errorCount++;
        }
      } else if (trimLine.startsWith('#EXTVLCOPT:') && currentChannel) {
        // Extract VLC options if present
        const option = trimLine.substring(11);
        if (!currentChannel.options) {
          currentChannel.options = [];
        }
        currentChannel.options.push(option);
      } else if (!trimLine.startsWith('#') && currentChannel) {
        // This is the URL of the channel
        currentChannel.url = trimLine;
        
        // Only add channels with valid URLs
        if (currentChannel.url && currentChannel.url.trim() !== '') {
          result.push(currentChannel);
        } else {
          log(`Channel "${currentChannel.title}" has empty URL, skipping`, 'warn');
          errorCount++;
        }
        
        currentChannel = null;
      }
    }
    
    // Log parsing results
    log(`Parsed ${result.length} channels successfully, encountered ${errorCount} issues`);      // If no valid channels were found, add fallback channels from real IPTV sources
      if (result.length === 0) {
        log('No valid channels found in playlist, adding fallback channels from real sources', 'warn');
        result.push({
          id: 'fallback-tvpass',
          title: 'TVPass Channel (Fallback)',
          duration: -1,
          logo: '',
          group: 'Fallback',
          url: 'https://tvpass.org/playlist/fallback.m3u8',
          attributes: {
            'tvg-id': 'fallback-tvpass',
            'tvg-name': 'TVPass Fallback',
            'group-title': 'Fallback'
          }
        });
      log('Added fallback test channel to ensure playback capability', 'info');
    }
    
    return result;
      } catch (error) {
    log(`Error parsing M3U8 playlist: ${error.message}`, 'error');
    
    // Always return at least one channel from a real IPTV source, even on error
    return [{
      id: 'error-fallback-moviejoy',
      title: 'MovieJoy Recovery Stream',
      duration: -1,
      logo: '',
      group: 'Error Recovery',
      url: 'http://moviejoy.stream/fallback/stream.m3u8',
      attributes: {
        'tvg-id': 'error-fallback-moviejoy',
        'tvg-name': 'MovieJoy Recovery Stream',
        'group-title': 'Error Recovery'
      }
    }];
  }
}

/**
 * Get all available channels
 */
async function getChannels() {
  if (channels.length === 0) {
    await loadChannels();
  }
  return channels;
}

/**
 * Get channel by ID
 */
function getChannelById(channelId) {
  return channels.find(channel => channel.id === channelId);
}

/**
 * Play a channel
 * @param {string} channelId - ID of the channel to play
 * @returns {Promise<Object>} - Promise resolving to playback info
 */
async function playChannel(channelId) {
  log(`Playing channel with ID: ${channelId}`);
  
  // Verify channel ID
  if (!channelId) {
    const error = new Error('No channel ID provided');
    log(error.message, 'error');
    return { error: error.message };
  }
  
  // Find the channel
  const channel = channels.find(c => c.id === channelId);
  if (!channel) {
    const error = new Error(`Channel with ID ${channelId} not found`);
    log(error.message, 'error');
    return { error: error.message };
  }
  
  // Stop any previous playback
  await stopPlayback();
  
  try {
    log(`Playing channel: ${channel.title} (${channel.url})`);
      // Update current channel
    currentChannel = { 
      ...channel,
      startTime: Date.now() // Add start time for tracking viewing duration
    };
    isPlaying = true;
    
    // Reset playback time
    currentPlaybackTime = 0;
    
    // Process URL if needed (proxy, auth, etc.)
    const processedUrl = channel.url;
    
    // Try to fetch captions for this channel
    try {
      captionManager.fetchCaptions(channel.url, channel.id)
        .then(captionsInfo => {
          if (captionsInfo) {
            log(`Found captions for channel ${channel.title}: ${captionsInfo.format} format`);
          } else {
            log(`No captions found for channel ${channel.title}`);
          }
        })
        .catch(err => {
          log(`Error fetching captions: ${err.message}`, 'error');
        });
    } catch (error) {
      log(`Caption initialization error: ${error.message}`, 'warn');
      // Continue with playback even if caption fetching fails
    }
    
    return {
      success: true,
      channel: {
        id: channel.id,
        title: channel.title,
        logo: channel.logo,
        group: channel.group
      },
      url: processedUrl
    };
  } catch (error) {
    log(`Error playing channel: ${error.message}`, 'error');
    return { error: error.message };
  }
}

/**
 * Validate if a stream is accessible and playable
 * @param {string} url - The stream URL to validate
 */
async function validateStream(url) {
  try {
    log(`Validating stream: ${url}`);
    
    // Use node-fetch to do a HEAD request to check if the stream is accessible
    const fetch = require('node-fetch');
    const response = await fetch(url, { 
      method: 'HEAD', 
      timeout: 5000,
      headers: { 'User-Agent': 'IPTV-Player/1.0' }
    });
    
    // If we get a successful response, the stream is probably valid
    const isValid = response.ok;
    log(`Stream validation result: ${isValid ? 'Valid' : 'Invalid'}, status: ${response.status}`);
    
    return isValid;
  } catch (error) {
    log(`Stream validation error: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Initialize time-shifting buffer
 * @param {number} bufferSize - Size of buffer in seconds
 */
function initializeTimeShift(bufferSize) {
  log(`Initializing time-shift buffer of ${bufferSize} seconds`);
    // Create a circular buffer for time-shifting
  currentBuffer = {
    maxSize: bufferSize,
    segments: [],
    startTime: Date.now(),
    lastSegmentTime: 0,
    segmentDuration: 1, // Use 1-second segments for smoother seeking
    isPaused: false,
    currentPosition: 0,
    chunkCount: 0,
    maxChunks: bufferSize // Maximum number of chunks to store
  };
  
  timeShiftActive = true;
  
  // Set up buffer management
  setupBufferCapture();
  
  return {
    bufferSize,
    timeShiftActive,
    segmentDuration: currentBuffer.segmentDuration
  };
}

/**
 * Set up buffer capture for time-shifting
 * This captures video segments to allow pause, rewind, etc.
 */
function setupBufferCapture() {
  if (!timeShiftActive || !currentBuffer) {
    return;
  }
  
  // In a real implementation, this would interact with a media buffer
  // Here we'll simulate the buffer with a timer to update positions
    currentBuffer.captureInterval = setInterval(() => {
    if (currentBuffer && !currentBuffer.isPaused) {
      // Add a new segment to our buffer
      const now = Date.now();
      const segment = {
        timestamp: now,
        position: currentBuffer.currentPosition,
        duration: currentBuffer.segmentDuration,
        index: currentBuffer.chunkCount++
      };
      
      currentBuffer.segments.push(segment);
      currentBuffer.currentPosition += currentBuffer.segmentDuration;
      
      // Improved buffer management strategy:
      // 1. Keep a fixed number of segments to allow longer rewinds
      // 2. If we exceed max chunks, remove oldest segments
      if (currentBuffer.segments.length > currentBuffer.maxChunks) {
        // Gradually increase the segment duration for older segments
        // This allows us to keep more historical data with less precision
        if (currentBuffer.segments.length > 120) { // If more than 2 minutes of 1-second segments
          // Combine older segments (every 5 seconds) to save memory but maintain rewind capability
          const oldestSegments = currentBuffer.segments.slice(0, 5);
          if (oldestSegments.length === 5) {
            // Create a combined segment
            const combinedSegment = {
              timestamp: oldestSegments[0].timestamp,
              position: oldestSegments[0].position,
              duration: oldestSegments.reduce((sum, seg) => sum + seg.duration, 0),
              index: oldestSegments[0].index,
              isCompressed: true
            };
            
            // Replace the 5 oldest segments with the combined one
            currentBuffer.segments = [combinedSegment, ...currentBuffer.segments.slice(5)];
          }
        }
        
        // If still exceeding max chunks after compression, remove oldest
        while (currentBuffer.segments.length > currentBuffer.maxChunks) {
          currentBuffer.segments.shift();
        }
      }
      
      // Also apply a maximum age limit for very long sessions
      const maxAgeMs = currentBuffer.maxSize * 2000; // Double the configured buffer size
      const oldestAllowed = now - maxAgeMs;
      
      currentBuffer.segments = currentBuffer.segments.filter(
        seg => seg.timestamp >= oldestAllowed
      );
    }
  }, currentBuffer.segmentDuration * 1000);
  
  log(`Time-shift buffer capture started with segment duration of ${currentBuffer.segmentDuration}s`);
}

/**
 * Stop playback
 */
async function stopPlayback() {
  log('Stopping playback');
  
  if (!isPlaying || !currentChannel) {
    log('No active playback to stop');
    return true;
  }
  
  try {
    // Record watching history for recommendations
    if (currentChannel && currentChannel.startTime) {
      const watchDuration = (Date.now() - currentChannel.startTime) / 1000; // in seconds
      try {
        recommendationEngine.recordChannelView(currentChannel.id, watchDuration);
        log(`Recorded ${watchDuration.toFixed(1)} seconds of viewing for ${currentChannel.title}`);
      } catch (error) {
        log(`Error recording channel view: ${error.message}`, 'warn');
      }
    }
    
    // Clean up resources
    isPlaying = false;
    
    // Keep channel metadata but clear playback status
    currentPlaybackTime = 0;
    
    log(`Stopped playback of ${currentChannel?.title || 'unknown channel'}`);
    return true;
  } catch (error) {
    log(`Error stopping playback: ${error.message}`, 'error');
    // Still consider it stopped even if there was an error
    isPlaying = false;
    return true;
  }
}

/**
 * Start recording a channel
 */
async function startRecording(channelId) {
  try {
    // If already recording, stop it first
    if (isRecording) {
      await stopRecording();
    }
    
    // Get channel to record
    const channel = channelId ? getChannelById(channelId) : currentChannel;
    
    if (!channel) {
      throw new Error('No channel specified for recording');
    }
    
    if (!platform.hasFFmpeg()) {
      throw new Error('FFmpeg not found, recording is not available');
    }
    
    // Generate output filename using required format YYYY-MM-DD_title.mp4
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `${dateStr}_${channel.title.replace(/[\\/:*?"<>|]/g, '_')}.mp4`;
    currentRecordingPath = path.join(RECORDINGS_DIR, filename);
    
    // Log to recording specific log
    recordingLog(`Starting recording of channel ${channel.title} to ${filename}`);
    
    // Start FFmpeg process
    currentRecorder = ffmpeg(channel.url)
      .outputOptions([
        '-c:v', 'copy',      // Copy video codec
        '-c:a', 'aac',       // Convert audio to AAC
        '-b:a', '192k'       // Audio bitrate
      ])
      .output(currentRecordingPath)
      .on('start', (commandLine) => {
        recordingLog(`FFmpeg started with command: ${commandLine}`);
        isRecording = true;
      })
      .on('error', (err, stdout, stderr) => {
        recordingLog(`FFmpeg error: ${err.message}`, 'error');
        recordingLog(`FFmpeg stderr: ${stderr}`, 'error');
        isRecording = false;
        currentRecorder = null;
      })
      .on('end', () => {
        recordingLog('Recording completed');
        isRecording = false;
        currentRecorder = null;
      });
    
    // Start recording
    currentRecorder.run();
    
    return {
      channel: channel,
      outputPath: currentRecordingPath,
      startTime: new Date().toISOString()
    };
  } catch (error) {
    recordingLog(`Error starting recording: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Stop current recording
 */
async function stopRecording() {
  if (!isRecording || !currentRecorder) {
    return { success: false, error: 'No recording in progress' };
  }
  
  return new Promise((resolve, reject) => {
    recordingLog('Stopping recording');
    
    try {
      // Set a timeout to prevent hanging forever
      const timeoutId = setTimeout(() => {
        recordingLog('Recording stop timed out, forcing termination', 'warn');
        isRecording = false;
        const outputPath = currentRecordingPath;
        currentRecorder = null;
        currentRecordingPath = null;
        resolve({
          success: true,
          outputPath: outputPath,
          timedOut: true
        });
      }, 5000); // 5 second timeout
      
      currentRecorder.on('end', () => {
        clearTimeout(timeoutId);
        recordingLog(`Recording saved to ${currentRecordingPath}`);
        isRecording = false;
        const outputPath = currentRecordingPath;
        currentRecorder = null;
        currentRecordingPath = null;
        resolve({
          success: true,
          outputPath: outputPath
        });
      });
      
      currentRecorder.on('error', (err) => {
        clearTimeout(timeoutId);
        recordingLog(`Error stopping recording: ${err.message}`, 'error');
        isRecording = false;
        currentRecorder = null;
        currentRecordingPath = null;
        reject(err);
      });
      
      // Kill the FFmpeg process
      currentRecorder.kill('SIGTERM');
      
    } catch (error) {
      recordingLog(`Error stopping recording: ${error.message}`, 'error');
      isRecording = false;
      currentRecorder = null;
      currentRecordingPath = null;
      reject(error);
    }
  });
}

/**
 * Schedule a recording for later
 */
async function scheduleRecording(channelId, startTime, duration) {
  const channel = getChannelById(channelId);
  
  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }
  
  // Integration with recording-scheduler.js
  try {
    const scheduler = require('./recording-scheduler');
    return scheduler.scheduleRecording({
      channelId: channelId || (currentChannel ? currentChannel.id : null),
      startTime: startTime,
      duration: duration,
      name: name || (currentChannel ? currentChannel.title : 'Scheduled Recording')
    });
  } catch (error) {
    log(`Error scheduling recording: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
  log(`Scheduled recording for channel ${channel.title} at ${startTime} for ${duration} minutes`);
  
  return { success: true };
}

/**
 * Pause playback (only available with time-shift)
 */
function pausePlayback() {
  if (!isPlaying) {
    return { success: false, error: 'Not currently playing' };
  }
  
  if (!timeShiftActive) {
    // Automatically enable time-shifting if it's not already active
    initializeTimeShift(config.get('timeShiftBufferSize') || 60);
  }
  
  log(`Pausing playback of ${currentChannel?.title}`);
  isPlaying = false;
  
  if (currentBuffer) {
    currentBuffer.isPaused = true;
    
    // Store the current time position
    currentBuffer.pausedAt = Date.now();
    currentBuffer.pausedPosition = currentPlaybackTime;
  }
  
  return { 
    success: true,
    pausedAt: currentPlaybackTime,
    channel: currentChannel,
    timeShiftActive
  };
}

/**
 * Resume playback
 */
function resumePlayback() {
  if (isPlaying) {
    return { success: false, error: 'Already playing' };
  }
  
  if (!currentChannel) {
    return { success: false, error: 'No channel selected' };
  }
  
  log(`Resuming playback of ${currentChannel.title}`);
  isPlaying = true;
  
  if (currentBuffer) {
    currentBuffer.isPaused = false;
    
    // Calculate any time that passed while paused
    if (currentBuffer.pausedAt) {
      const pauseDuration = (Date.now() - currentBuffer.pausedAt) / 1000;
      log(`Playback was paused for ${pauseDuration.toFixed(1)} seconds`);
      
      // Keep the current position where it was when paused
      currentPlaybackTime = currentBuffer.pausedPosition;
    }
  }
  
  return { 
    success: true,
    resumedAt: currentPlaybackTime,
    channel: currentChannel,
    behindLive: currentBuffer ? (Date.now() - currentBuffer.startTime) / 1000 - currentPlaybackTime : 0
  };
}

/**
 * Seek to a specific position in the time-shift buffer
 * @param {number} seconds - Number of seconds from current position (negative for rewind)
 */
function seekBuffer(seconds) {
  if (!timeShiftActive) {
    // Auto-enable time-shift if trying to seek
    const bufferSize = config.get('timeShiftBufferSize') || 60;
    log(`Automatically enabling time-shift buffer (${bufferSize}s) for seeking`);
    initializeTimeShift(bufferSize);
    
    // Since we just enabled time-shift, we can only rewind a small amount
    if (seconds < 0) {
      // Allow rewind up to 5 seconds initially as buffer builds
      const initialRewind = Math.max(-5, seconds);
      currentPlaybackTime = Math.max(0, initialRewind);
      log(`Limited initial rewind to ${initialRewind}s as buffer builds`);
      return { success: true, newPosition: currentPlaybackTime, timeShiftEnabled: true };
    } else {
      return { success: false, error: 'Cannot seek forward when just enabling time-shift' };
    }
  }
  
  // Calculate new position
  const newPosition = Math.max(0, currentPlaybackTime + seconds);
  const maxPosition = (Date.now() - currentBuffer.startTime) / 1000;
  
  // Don't allow seeking beyond buffer
  if (newPosition > maxPosition) {
    log(`Cannot seek forward beyond live point`);
    currentPlaybackTime = maxPosition;
    return { success: false, error: 'Cannot seek beyond live point', position: currentPlaybackTime };
  }
  
  // Find the nearest segment in our buffer for accurate seeking
  if (currentBuffer && currentBuffer.segments.length > 0) {
    // Look for a segment close to the requested position
    const targetPosition = newPosition;
    const closestSegment = currentBuffer.segments.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.position - targetPosition);
      const currDiff = Math.abs(curr.position - targetPosition);
      return currDiff < prevDiff ? curr : prev;
    });
    
    log(`Found segment at position ${closestSegment.position} for target seek to ${targetPosition}`);
    currentPlaybackTime = closestSegment.position;
  } else {
    log(`Seeking ${seconds > 0 ? 'forward' : 'backward'} ${Math.abs(seconds)} seconds`);
    currentPlaybackTime = newPosition;
  }
  
  // If we were playing in real-time, we're now behind
  if (!currentBuffer.isPaused) {
    const behindLive = maxPosition - currentPlaybackTime;
    log(`Now playing ${behindLive.toFixed(1)} seconds behind live`);
  }
  
  return { 
    success: true,
    newPosition: currentPlaybackTime,
    behindLive: maxPosition - currentPlaybackTime
  };
}

/**
 * Get current playback information including quality, bitrate and codec details
 * Used by the metadata overlay UI component
 * @returns {Object} Object with playback metadata
 */
function getPlaybackInfo() {
  // Check if a channel is playing
  if (!currentChannel) {
    return { success: false, error: 'No channel playing' };
  }
  
  try {
    // Define info object with defaults - explicitly using safe values
    const info = {
      success: true,
      channel: currentChannel.title || 'Unknown',
      quality: 'Unknown',
      bitrate: 0,
      codec: 'Unknown',
      isLive: false
    };
    
    // Handle timeshift status if buffer exists
    if (timeShiftActive && currentBuffer && currentBuffer.startTime) {
      info.isLive = currentPlaybackTime >= (Date.now() - currentBuffer.startTime) / 1000;
    }
    
    // Check if we have valid stream info before trying to use it
    if (!currentStreamInfo) {
      log('currentStreamInfo is not defined, returning safe default', 'warn');
      return info;
    }
    
    // Use a local variable for safety and readability
    const streamInfo = currentStreamInfo;
    
    // Try to estimate quality from HLS manifest if available
    if (streamInfo && streamInfo.resolution) {
      info.quality = streamInfo.resolution;
    } else if (playbackQuality && playbackQuality.resolution) {
      // Fall back to playbackQuality if available
      info.quality = playbackQuality.resolution;
    }
    
    // Get bitrate if available
    if (streamInfo && streamInfo.bandwidth) {
      info.bitrate = streamInfo.bandwidth;
    } else if (playbackQuality && playbackQuality.bitrate) {
      // Fall back to playbackQuality if available
      info.bitrate = playbackQuality.bitrate;
    }
    
    // Get codec info if available
    if (streamInfo && streamInfo.codecs) {
      info.codec = streamInfo.codecs;
    } else if (playbackQuality && playbackQuality.codec) {
      // Fall back to playbackQuality if available
      info.codec = playbackQuality.codec;
    }
    
    return info;
  } catch (error) {
    log(`Error getting playback info: ${error.message}`, 'error');
    return { 
      success: false, 
      error: error.message,
      quality: 'Unknown',
      bitrate: 0,
      codec: 'Unknown'
    };
  }
}

/**
 * Update playback quality information
 * @param {Object} quality - Quality information
 */
function updatePlaybackQuality(quality) {
  playbackQuality = {
    ...playbackQuality,
    ...quality
  };
  
  log(`Updated playback quality: ${JSON.stringify(playbackQuality)}`);
  
  return { success: true };
}

/**
 * Filter channels by criteria
 * @param {Object} filters - Filter criteria
 * @param {string} filters.query - Text search query
 * @param {string} filters.group - Group to filter by
 */
function filterChannels(filters = {}) {
  let filtered = [...channels];
  
  // Apply text search filter
  if (filters.query) {
    const query = filters.query.toLowerCase();
    filtered = filtered.filter(channel => 
      channel.title.toLowerCase().includes(query) ||
      channel.id.toLowerCase().includes(query) ||
      (channel.attributes && channel.attributes['tvg-name'] && 
        channel.attributes['tvg-name'].toLowerCase().includes(query))
    );
  }
  
  // Apply group filter
  if (filters.group) {
    filtered = filtered.filter(channel => 
      channel.group === filters.group
    );
  }
  
  return filtered;
}

/**
 * Get all available channel groups
 */
function getChannelGroups() {
  const groups = new Set();
  
  channels.forEach(channel => {
    if (channel.group) {
      groups.add(channel.group);
    }
  });
  
  return Array.from(groups);
}

/**
 * Get EPG (Electronic Program Guide) data for a channel
 * @param {string} channelId - The ID of the channel
 */
async function getEPG(channelId) {
  const channel = getChannelById(channelId);
  
  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }
  
  // EPG data fetching from epg-manager.js
  try {
    const epgManager = require('./epg-manager');
    return epgManager.getChannelProgram(channelId);
  } catch (error) {
    log(`Error fetching EPG data: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
  log(`Fetching EPG data for channel ${channel.title}`);
  
  return {
    success: true,
    channel: channelId,
    programs: [] // List of program objects
  };
}

/**
 * Get the current playback state
 */
function getPlaybackState() {
  return {
    isPlaying,
    currentChannel: currentChannel ? {
      id: currentChannel.id,
      title: currentChannel.title,
      url: currentChannel.url
    } : null,
    currentPlaybackTime,
    timeShiftActive,
    buffer: currentBuffer ? {
      size: currentBuffer.maxSize,
      currentPosition: currentBuffer.currentPosition,
      segments: currentBuffer.segments.length
    } : null,
    playbackQuality
  };
}

/**
 * Get the current recording state
 */
function getRecordingState() {
  return {
    isRecording,
    currentChannel: currentChannel ? {
      id: currentChannel.id,
      title: currentChannel.title
    } : null,
    outputPath: currentRecordingPath
  };
}

/**
 * Get the version of the player engine
 */
function getVersion() {
  return '1.0.0';
}

/**
 * Check for updates for the player engine
 */
async function checkForUpdates() {
  // Check for updates using the updater module
  try {
    const updater = require('./updater');
    return updater.checkForUpdates();
  } catch (error) {
    log(`Error checking for updates: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
  log('Checking for updates');
  
  return {
    success: true,
    updateAvailable: false
  };
}

/**
 * Perform a software update
 */
async function performUpdate() {
  // Install updates using the updater module
  try {
    const updater = require('./updater');
    return updater.installUpdate();
  } catch (error) {
    log(`Error installing update: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
  log('Performing software update');
  
  return {
    success: true,
    message: 'Update installed successfully'
  };
}

/**
 * Reset the player engine state
 */
function resetState() {
  log('Resetting player engine state');
  
  // Stop playback and recording
  stopPlayback();
  stopRecording();
  
  // Clear channels and buffer
  channels = [];
  currentChannel = null;
  currentPlaybackTime = 0;
  currentBuffer = null;
  timeShiftActive = false;
  
  log('Player engine state reset');
  
  return { success: true };
}

/**
 * Exit the player application
 */
function exit() {
  log('Exiting player application');
  
  // Perform any necessary cleanup
  stopPlayback();
  stopRecording();
  
  log('Player application exited');
  
  // Exit the process
  process.exit(0);
}

/**
 * Get information about the currently playing channel
 * @returns {Object|null} Current channel information or null if no channel is playing
 */
function getCurrentChannel() {
  return currentChannel;
}

/**
 * Adds a test channel to the channels array
 * Used for testing error handling scenarios
 * @param {Object} channel - Channel object to add
 */
function addTestChannel(channel) {
  if (!channel || !channel.id) {
    log('Cannot add test channel: Invalid channel object', 'error');
    return false;
  }
  
  log(`Adding test channel: ${channel.id} - ${channel.title}`);
  
  // Check if channel with this ID already exists
  const existingIndex = channels.findIndex(c => c.id === channel.id);
  if (existingIndex >= 0) {
    // Replace the existing channel
    channels[existingIndex] = channel;
    log(`Replaced existing channel with ID ${channel.id}`, 'info');
  } else {
    // Add as a new channel
    channels.push(channel);
    log(`Added new test channel with ID ${channel.id}`, 'info');
  }
  
  return true;
}

module.exports = {
  // Make initialized a getter to ensure we're accessing the up-to-date value
  get initialized() { return initialized; },
  initialize,
  getChannels,
  getChannelById,
  playChannel,
  stopPlayback,
  startRecording,
  stopRecording,
  scheduleRecording,
  pausePlayback,
  resumePlayback,
  seekBuffer,
  getPlaybackInfo,
  updatePlaybackQuality,
  filterChannels,
  getChannelGroups,
  getEPG,
  getPlaybackState,
  getRecordingState,
  getVersion,
  checkForUpdates,
  performUpdate,
  resetState,
  exit,
  getCurrentChannel,
  validateStream,
  parseM3U8Playlist,
  addTestChannel
};

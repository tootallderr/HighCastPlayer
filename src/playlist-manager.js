/**
 * Playlist Manager for IPTV Player
 * 
 * This module handles loading, merging, and managing m3u8 playlist files from
 * multiple sources (remote URLs and local files).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const platform = require('./platform');

// Define paths
const PLAYLISTS_DIR = path.join(__dirname, '..', 'data', 'playlists');
const MERGED_PLAYLIST = path.join(__dirname, '..', 'data', 'merged-playlist.m3u8');
const SOURCES_JSON = path.join(__dirname, '..', 'data', 'sources.json');
const LOG_FILE = path.join(__dirname, '..', 'tests', 'playlist_update.log');

// Ensure directories exist
if (!fs.existsSync(PLAYLISTS_DIR)) {
    fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
}

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Log function for playlist operations
 */
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(LOG_FILE, formattedMessage);
    
    // Also console log if not in production
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Playlist] ${message}`);
    }
}

/**
 * Load playlist sources from sources.json
 */
function loadSources() {
    try {
        if (fs.existsSync(SOURCES_JSON)) {
            const sourcesData = fs.readFileSync(SOURCES_JSON, 'utf8');
            return JSON.parse(sourcesData);
        }
    } catch (error) {
        log(`Error loading sources: ${error.message}`, 'error');
    }
    
    // Return default empty sources if file doesn't exist or has an error
    return { 
        remote: [], 
        local: [] 
    };
}

/**
 * Save playlist sources to sources.json
 */
function saveSources(sources) {
    try {
        fs.writeFileSync(
            SOURCES_JSON,
            JSON.stringify(sources, null, 2),
            'utf8'
        );
        log(`Saved ${sources.remote.length} remote and ${sources.local.length} local sources`);
        return true;
    } catch (error) {
        log(`Error saving sources: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Download a remote m3u8 playlist file
 */
function downloadPlaylist(url, filename) {
    return new Promise((resolve, reject) => {
        // Validate URL
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (error) {
            reject(new Error(`Invalid URL: ${url}`));
            return;
        }
        
        const outputPath = path.join(PLAYLISTS_DIR, filename);
        const fileStream = fs.createWriteStream(outputPath);
        
        // Choose http or https based on URL protocol
        const client = parsedUrl.protocol === 'https:' ? https : http;
        
        log(`Downloading playlist from ${url} to ${filename}`);
        
        const request = client.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                log(`Redirected to ${redirectUrl}`, 'info');
                fileStream.close();
                resolve(downloadPlaylist(redirectUrl, filename));
                return;
            }
            
            // Check for successful response
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                return;
            }
            
            // Write data to file
            response.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                log(`Successfully downloaded ${filename}`);
                resolve(outputPath);
            });
        });
        
        // Handle errors
        request.on('error', (error) => {
            fs.unlink(outputPath, () => {}); // Remove partial file
            log(`Download error: ${error.message}`, 'error');
            reject(error);
        });
        
        fileStream.on('error', (error) => {
            fs.unlink(outputPath, () => {}); // Remove partial file
            log(`File write error: ${error.message}`, 'error');
            reject(error);
        });
    });
}

/**
 * Copy a local m3u8 file to the playlists directory
 */
function copyLocalPlaylist(sourcePath, filename) {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(sourcePath)) {
                reject(new Error(`Local file not found: ${sourcePath}`));
                return;
            }
            
            const destPath = path.join(PLAYLISTS_DIR, filename);
            
            fs.copyFileSync(sourcePath, destPath);
            log(`Copied local playlist from ${sourcePath} to ${filename}`);
            resolve(destPath);
        } catch (error) {
            log(`Error copying local playlist: ${error.message}`, 'error');
            reject(error);
        }
    });
}

/**
 * Parse a m3u8 playlist file and extract channels
 */
function parsePlaylist(filePath, sourceId) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        const channels = [];
        
        let currentChannel = null;
        
        // Debug the content
        log(`Parsing playlist ${path.basename(filePath)}, length: ${content.length} bytes, ${lines.length} lines`);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            // Check for EXTM3U header (required for m3u8 format)
            if (i === 0 && line !== '#EXTM3U') {
                log(`Warning: File ${path.basename(filePath)} missing #EXTM3U header`, 'warn');
            }
            
            // Handle channel info line
            if (line.startsWith('#EXTINF:')) {
                try {
                    // Extract channel name and attributes from EXTINF line
                    const infoData = line.substring(8); // Remove #EXTINF: prefix
                    
                    // More robust regex that handles various EXTINF formats
                    const infoMatch = infoData.match(/(-?\d+\.?\d*)\s*(,\s*(.+))?/);
                    
                    if (infoMatch) {
                        const duration = infoMatch[1];
                        const title = infoMatch[3] || 'Unnamed Channel';
                        
                        // Extract attributes like tvg-logo, group-title, etc.
                        const attributes = {};
                        const attrMatches = Array.from(infoData.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g));
                        for (const match of attrMatches) {
                            attributes[match[1]] = match[2];
                        }
                        
                        currentChannel = {
                            title: title,
                            duration: duration,
                            attributes: attributes,
                            sourceId: sourceId
                        };
                    }
                } catch (err) {
                    log(`Error parsing EXTINF line "${line}": ${err.message}`, 'error');
                }
            } 
            // Handle channel URL (the next non-comment line after EXTINF)
            else if (currentChannel && !line.startsWith('#')) {
                currentChannel.url = line;
                channels.push(currentChannel);
                currentChannel = null;
            }
        }
        
        log(`Parsed ${channels.length} channels from ${path.basename(filePath)}`);
        return channels;
    } catch (error) {
        log(`Error parsing playlist ${path.basename(filePath)}: ${error.message}`, 'error');
        return [];
    }
}

/**
 * Merge multiple playlists into a single m3u8 file
 */
function mergePlaylistsToFile(playlists, outputPath) {
    try {
        // Combine all channels from all playlists
        const allChannels = [];
        
        playlists.forEach(playlist => {
            allChannels.push(...playlist.channels);
        });
        
        // Check for duplicates based on URL
        const uniqueUrls = new Set();
        const uniqueChannels = allChannels.filter(channel => {
            // Skip channels without URLs
            if (!channel.url) return false;
            
            // Keep only channels with unique URLs
            if (uniqueUrls.has(channel.url)) {
                return false;
            }
            uniqueUrls.add(channel.url);
            return true;
        });
        
        // Generate merged playlist content
        let content = '#EXTM3U\n';
        content += `#PLAYLIST: IPTV Player Merged Playlist\n`;
        content += `#CREATED: ${new Date().toISOString()}\n`;
        content += `#SOURCES: ${playlists.length}\n\n`;
        
        uniqueChannels.forEach(channel => {
            // Build EXTINF line with attributes
            let extinf = `#EXTINF:${channel.duration},${channel.title}`;
            
            // Add all attributes
            if (channel.attributes) {
                Object.entries(channel.attributes).forEach(([key, value]) => {
                    extinf += ` ${key}="${value}"`;
                });
            }
            
            content += extinf + '\n';
            content += channel.url + '\n\n';
        });
        
        // Write merged playlist to file
        fs.writeFileSync(outputPath, content, 'utf8');
        
        log(`Merged ${uniqueChannels.length} unique channels (from ${allChannels.length} total) into ${path.basename(outputPath)}`);
        return {
            totalChannels: allChannels.length,
            uniqueChannels: uniqueChannels.length,
            path: outputPath
        };
    } catch (error) {
        log(`Error merging playlists: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Update all playlists from sources
 */
async function updateAllPlaylists() {
    log('Starting playlist update');
    
    const sources = loadSources();
    const playlists = [];
    const errors = [];
    
    // Process remote playlists
    for (let i = 0; i < sources.remote.length; i++) {
        const source = sources.remote[i];
        const filename = `remote_${i + 1}_${new Date().getTime()}.m3u8`;
        
        try {
            // Download the remote playlist
            const filePath = await downloadPlaylist(source.url, filename);
            
            // Parse the playlist
            const channels = parsePlaylist(filePath, `remote_${i + 1}`);
            
            playlists.push({
                id: `remote_${i + 1}`,
                name: source.name || `Remote Playlist ${i + 1}`,
                type: 'remote',
                url: source.url,
                file: filePath,
                channels: channels
            });
        } catch (error) {
            log(`Error processing remote playlist ${source.name || source.url}: ${error.message}`, 'error');
            errors.push({
                source: source,
                error: error.message
            });
        }
    }
    
    // Process local playlists
    for (let i = 0; i < sources.local.length; i++) {
        const source = sources.local[i];
        const filename = `local_${i + 1}_${new Date().getTime()}.m3u8`;
        
        try {
            // Copy the local playlist
            const filePath = await copyLocalPlaylist(source.path, filename);
            
            // Parse the playlist
            const channels = parsePlaylist(filePath, `local_${i + 1}`);
            
            playlists.push({
                id: `local_${i + 1}`,
                name: source.name || `Local Playlist ${i + 1}`,
                type: 'local',
                path: source.path,
                file: filePath,
                channels: channels
            });
        } catch (error) {
            log(`Error processing local playlist ${source.name || source.path}: ${error.message}`, 'error');
            errors.push({
                source: source,
                error: error.message
            });
        }
    }
    
    // Merge all playlists
    if (playlists.length > 0) {
        try {
            const mergeResult = mergePlaylistsToFile(playlists, MERGED_PLAYLIST);
            log(`Playlist update completed: ${mergeResult.uniqueChannels} unique channels from ${playlists.length} sources`);
            
            return {
                success: true,
                playlistCount: playlists.length,
                channels: mergeResult.uniqueChannels,
                errors: errors
            };
        } catch (error) {
            log(`Failed to merge playlists: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message,
                errors: errors
            };
        }
    } else {
        log('No playlists to merge', 'warn');
        return {
            success: false,
            error: 'No playlists to merge',
            errors: errors
        };
    }
}

/**
 * Schedule automatic playlist updates
 */
function scheduleUpdates(intervalMinutes = 60) {
    const intervalMs = intervalMinutes * 60 * 1000;
    
    log(`Scheduling automatic playlist updates every ${intervalMinutes} minutes`);
    
    // Run first update
    updateAllPlaylists();
    
    // Schedule recurring updates
    const intervalId = setInterval(() => {
        updateAllPlaylists();
    }, intervalMs);
    
    return intervalId;
}

/**
 * Add a new remote playlist source
 */
function addRemoteSource(url, name = '') {
    const sources = loadSources();
    
    // Validate URL format
    try {
        new URL(url);
    } catch (error) {
        log(`Invalid URL format: ${url}`, 'error');
        return { success: false, error: 'Invalid URL format' };
    }
    
    // Check if URL already exists
    if (sources.remote.some(source => source.url === url)) {
        log(`Remote source already exists: ${url}`, 'warn');
        return { success: false, error: 'Source already exists' };
    }
    
    // Add new source
    sources.remote.push({ 
        url: url, 
        name: name || `Remote Playlist ${sources.remote.length + 1}`,
        added: new Date().toISOString() 
    });
    
    // Save updated sources
    if (saveSources(sources)) {
        log(`Added new remote playlist source: ${url}`);
        return { success: true };
    } else {
        return { success: false, error: 'Failed to save sources' };
    }
}

/**
 * Add a new local playlist source
 */
function addLocalSource(filePath, name = '') {
    const sources = loadSources();
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
        log(`Local file not found: ${filePath}`, 'error');
        return { success: false, error: 'File not found' };
    }
    
    // Check if file has .m3u or .m3u8 extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.m3u' && ext !== '.m3u8') {
        log(`Invalid file extension: ${ext}. Must be .m3u or .m3u8`, 'error');
        return { success: false, error: 'Invalid file extension' };
    }
    
    // Check if file path already exists
    if (sources.local.some(source => source.path === filePath)) {
        log(`Local source already exists: ${filePath}`, 'warn');
        return { success: false, error: 'Source already exists' };
    }
    
    // Add new source
    sources.local.push({ 
        path: filePath, 
        name: name || `Local Playlist ${sources.local.length + 1}`,
        added: new Date().toISOString() 
    });
    
    // Save updated sources
    if (saveSources(sources)) {
        log(`Added new local playlist source: ${filePath}`);
        return { success: true };
    } else {
        return { success: false, error: 'Failed to save sources' };
    }
}

/**
 * Remove a playlist source
 */
function removeSource(type, identifier) {
    const sources = loadSources();
    
    if (type === 'remote') {
        // For remote sources, identifier is the URL
        const initialLength = sources.remote.length;
        sources.remote = sources.remote.filter(source => source.url !== identifier);
        
        if (sources.remote.length < initialLength) {
            if (saveSources(sources)) {
                log(`Removed remote playlist source: ${identifier}`);
                return { success: true };
            }
        } else {
            log(`Remote source not found: ${identifier}`, 'warn');
            return { success: false, error: 'Source not found' };
        }
    } else if (type === 'local') {
        // For local sources, identifier is the file path
        const initialLength = sources.local.length;
        sources.local = sources.local.filter(source => source.path !== identifier);
        
        if (sources.local.length < initialLength) {
            if (saveSources(sources)) {
                log(`Removed local playlist source: ${identifier}`);
                return { success: true };
            }
        } else {
            log(`Local source not found: ${identifier}`, 'warn');
            return { success: false, error: 'Source not found' };
        }
    } else {
        log(`Invalid source type: ${type}`, 'error');
        return { success: false, error: 'Invalid source type' };
    }
    
    return { success: false, error: 'Failed to save sources' };
}

/**
 * Get list of all playlist sources
 */
function getSources() {
    return loadSources();
}

/**
 * Get merged playlist file path
 */
function getMergedPlaylistPath() {
    return MERGED_PLAYLIST;
}

/**
 * Clean up old playlist files to save disk space
 */
function cleanupOldPlaylists(maxAge = 86400000) { // Default: 24 hours
    try {
        const files = fs.readdirSync(PLAYLISTS_DIR);
        const now = new Date().getTime();
        let deletedCount = 0;
        
        files.forEach(file => {
            // Skip merged playlist
            if (file === path.basename(MERGED_PLAYLIST)) {
                return;
            }
            
            const filePath = path.join(PLAYLISTS_DIR, file);
            const stats = fs.statSync(filePath);
            const fileAge = now - stats.mtimeMs;
            
            // Delete file if it's older than maxAge
            if (fileAge > maxAge) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });
        
        log(`Cleaned up ${deletedCount} old playlist files`);
        return { success: true, deletedCount };
    } catch (error) {
        log(`Error during playlist cleanup: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// Export module functions
const exportedModule = {
    updateAllPlaylists,
    scheduleUpdates,
    addRemoteSource,
    addLocalSource,
    removeSource,
    getSources,
    getMergedPlaylistPath,
    cleanupOldPlaylists
};

// Log export to debug
console.log("Exporting functions:", Object.keys(exportedModule));

module.exports = exportedModule;

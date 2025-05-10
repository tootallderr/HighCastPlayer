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
const { app } = require('electron');
const pathManager = require('./path-manager'); // Import centralized path manager

// Define paths
const DATA_DIR = pathManager.getDataDir();
const PLAYLISTS_DIR = pathManager.getPlaylistsDir();
const MERGED_PLAYLIST = pathManager.getMergedPlaylistPath();
const SOURCES_JSON = pathManager.getSourcesPath();
const LOGS_DIR = pathManager.getLogsDir();
const LOG_FILE = pathManager.getLogPath('playlist_update.log');

// The path manager handles directory creation, no need for explicit checks here

/**
 * Log function for playlist operations
 */
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Also log to console for visibility
    console.log(`[PlaylistManager] ${level.toUpperCase()}: ${message}`);
    
    // Append to log file
    try {
        fs.appendFileSync(LOG_FILE, formattedMessage);
    } catch (err) {
        // Use electron-log if available for better error reporting
        try {
            const electronLog = require('electron-log');
            electronLog.error(`[PlaylistManager] Failed to write to log file: ${err.message}`);
        } catch (electronLogError) {
            console.error(`[PlaylistManager] Failed to write to log file: ${err.message}`);
        }
    }
}

/**
 * Load playlist sources from sources.json
 */
function loadSources() {
    try {
        if (!fs.existsSync(SOURCES_JSON)) {
            log('Sources file not found, creating empty sources file', 'warn');
            saveSources({ remote: [], local: [] });
            return { remote: [], local: [] };
        }
        
        const sourcesData = fs.readFileSync(SOURCES_JSON, 'utf8');
        return JSON.parse(sourcesData);
    } catch (error) {
        log(`Error loading sources: ${error.message}`, 'error');
        return { remote: [], local: [] };
    }
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
    
    let sources;
    try {
        sources = loadSources();
        log(`Loaded ${sources.remote.length} remote sources and ${sources.local.length} local sources`);
    } catch (error) {
        log(`Error loading playlist sources: ${error.message}. Creating empty sources file.`, 'error');
        sources = { remote: [], local: [] };
        try {
            saveSources(sources);
        } catch (saveError) {
            log(`Failed to create empty sources file: ${saveError.message}`, 'error');
        }
    }
    
    const playlists = [];
    const errors = [];
    
    // Process remote playlists
    log(`Processing ${sources.remote.length} remote sources`);
    for (let i = 0; i < sources.remote.length; i++) {
        const source = sources.remote[i];
        // Skip disabled sources
        if (source.enabled === false) {
            log(`Skipping disabled remote source: ${source.name || source.url}`, 'info');
            continue;
        }
        
        const filename = `remote_${i + 1}_${new Date().getTime()}.m3u8`;
        
        try {
            log(`Downloading playlist from ${source.url}`);
            const filePath = await downloadPlaylist(source.url, filename);
            
            try {
                const channels = parsePlaylist(filePath, `remote_${i}`);
                playlists.push({
                    id: `remote_${i}`,
                    name: source.name || source.url,
                    source: source.url,
                    filePath: filePath,
                    channels: channels
                });
                
                // Update source metadata with last update time
                sources.remote[i].updated = new Date().toISOString();
                
                log(`Successfully processed remote playlist: ${source.name || source.url} with ${channels.length} channels`);
            } catch (parseError) {
                log(`Error parsing remote playlist ${source.url}: ${parseError.message}`, 'error');
                errors.push({
                    source: source.url,
                    error: parseError.message
                });
            }
        } catch (downloadError) {
            log(`Error downloading remote playlist ${source.url}: ${downloadError.message}`, 'error');
            errors.push({
                source: source.url,
                error: downloadError.message
            });
        }
    }
    
    // Process local playlists
    log(`Processing ${sources.local.length} local sources`);
    for (let i = 0; i < sources.local.length; i++) {
        const source = sources.local[i];
        // Skip disabled sources
        if (source.enabled === false) {
            log(`Skipping disabled local source: ${source.name || source.path}`, 'info');
            continue;
        }
        
        if (!source.path || !fs.existsSync(source.path)) {
            log(`Local playlist path does not exist: ${source.path}`, 'error');
            errors.push({
                source: source.path,
                error: 'File not found'
            });
            continue;
        }
        
        const filename = `local_${i + 1}_${new Date().getTime()}.m3u8`;
        
        try {
            log(`Copying local playlist from ${source.path}`);
            const filePath = await copyLocalPlaylist(source.path, filename);
            
            try {
                const channels = parsePlaylist(filePath, `local_${i}`);
                playlists.push({
                    id: `local_${i}`,
                    name: source.name || source.path,
                    source: source.path,
                    filePath: filePath,
                    channels: channels
                });
                
                // Update source metadata with last update time
                sources.local[i].updated = new Date().toISOString();
                
                log(`Successfully processed local playlist: ${source.name || source.path} with ${channels.length} channels`);
            } catch (parseError) {
                log(`Error parsing local playlist ${source.path}: ${parseError.message}`, 'error');
                errors.push({
                    source: source.path,
                    error: parseError.message
                });
            }
        } catch (copyError) {
            log(`Error copying local playlist ${source.path}: ${copyError.message}`, 'error');
            errors.push({
                source: source.path,
                error: copyError.message
            });
        }
    }
    
    // Save updated sources with last update timestamps
    try {
        saveSources(sources);
        log('Updated sources with latest timestamps');
    } catch (error) {
        log(`Error saving sources: ${error.message}`, 'error');
    }
    
    // Merge playlists if there are any successful ones
    if (playlists.length > 0) {
        try {
            log(`Merging ${playlists.length} playlists`);
            const mergeResult = mergePlaylistsToFile(playlists, MERGED_PLAYLIST);
            log(`Successfully merged ${mergeResult.uniqueChannels} unique channels from ${playlists.length} playlists`);
            
            return {
                success: true,
                playlists: playlists.length,
                channels: mergeResult.uniqueChannels,
                errors: errors
            };
        } catch (mergeError) {
            log(`Error merging playlists: ${mergeError.message}`, 'error');
            
            // Create a minimal valid playlist file to avoid breaking the player
            try {
                const minimalContent = '#EXTM3U\n#PLAYLIST: IPTV Player Merged Playlist (Error Recovery)\n';
                fs.writeFileSync(MERGED_PLAYLIST, minimalContent, 'utf8');
                log('Created minimal valid playlist file after merge error', 'warn');
            } catch (writeError) {
                log(`Failed to create minimal playlist: ${writeError.message}`, 'error');
            }
            
            return {
                success: false,
                error: mergeError.message,
                errors: [...errors, { source: 'merge', error: mergeError.message }]
            };
        }
    } else {
        log('No playlists were successfully processed, cannot merge', 'error');
        
        // Create a minimal valid playlist file to avoid breaking the player
        try {
            const minimalContent = '#EXTM3U\n#PLAYLIST: IPTV Player Merged Playlist (No Sources)\n';
            fs.writeFileSync(MERGED_PLAYLIST, minimalContent, 'utf8');
            log('Created minimal valid playlist file due to no sources', 'warn');
        } catch (writeError) {
            log(`Failed to create minimal playlist: ${writeError.message}`, 'error');
        }
        
        return {
            success: false,
            error: 'No playlists available to merge',
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
        return { 
            success: false, 
            error: 'Source already exists',
            exists: true,
            url: url
        };
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

/**
 * Update or add a remote playlist source
 * If the source already exists, it will be updated with the new name
 */
function updateOrAddRemoteSource(url, name = '') {
    const sources = loadSources();
    
    // Validate URL format
    try {
        new URL(url);
    } catch (error) {
        log(`Invalid URL format: ${url}`, 'error');
        return { success: false, error: 'Invalid URL format' };
    }
    
    // Check if URL already exists
    const existingIndex = sources.remote.findIndex(source => source.url === url);
    if (existingIndex >= 0) {
        // Update existing source
        sources.remote[existingIndex].name = name || sources.remote[existingIndex].name;
        sources.remote[existingIndex].updated = new Date().toISOString();
        
        // Save updated sources
        if (saveSources(sources)) {
            log(`Updated existing remote playlist source: ${url}`);
            return { success: true, updated: true };
        } else {
            return { success: false, error: 'Failed to save sources' };
        }
    } else {
        // Add new source
        sources.remote.push({ 
            url: url, 
            name: name || `Remote Playlist ${sources.remote.length + 1}`,
            added: new Date().toISOString() 
        });
        
        // Save updated sources
        if (saveSources(sources)) {
            log(`Added new remote playlist source: ${url}`);
            return { success: true, updated: false };
        } else {
            return { success: false, error: 'Failed to save sources' };
        }
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
    cleanupOldPlaylists,
    updateOrAddRemoteSource
};

// Log export to debug
console.log("Exporting functions:", Object.keys(exportedModule));

module.exports = exportedModule;

/**
 * IPTV Playlist Validator
 * 
 * This module validates m3u8 playlists by checking their format
 * and attempting to resolve streams to ensure they are valid.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const { logSourceChange } = require('./settings-logger');

/**
 * Check if a URL is reachable
 * @param {string} urlToCheck - The URL to check
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} - Promise that resolves to true if reachable
 */
function isUrlReachable(urlToCheck, timeout = 5000) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(urlToCheck);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const req = protocol.get(urlToCheck, { timeout }, (res) => {
                // Consider any response a success (even 404, etc.)
                // Just checking if the host is reachable
                resolve(true);
            });
            
            req.on('error', () => {
                resolve(false);
            });
            
            req.on('timeout', () => {
                req.abort();
                resolve(false);
            });
        } catch (error) {
            // Invalid URL or other issues
            resolve(false);
        }
    });
}

/**
 * Validate a playlist file
 * @param {string} filePath - Path to the playlist file
 * @returns {Promise<Object>} - Validation results
 */
async function validatePlaylistFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'File does not exist' };
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        return await validatePlaylistContent(content);
    } catch (error) {
        logSourceChange(`Error validating playlist file ${filePath}: ${error.message}`, 'error');
        return { valid: false, error: error.message };
    }
}

/**
 * Validate a playlist URL
 * @param {string} playlistUrl - URL to the playlist
 * @returns {Promise<Object>} - Validation results
 */
async function validatePlaylistUrl(playlistUrl) {
    try {
        // First check if the URL is reachable
        const isReachable = await isUrlReachable(playlistUrl);
        if (!isReachable) {
            return { valid: false, error: 'URL is not reachable' };
        }

        // Fetch the playlist content
        const content = await fetchPlaylistContent(playlistUrl);
        return await validatePlaylistContent(content);
    } catch (error) {
        logSourceChange(`Error validating playlist URL ${playlistUrl}: ${error.message}`, 'error');
        return { valid: false, error: error.message };
    }
}

/**
 * Fetch playlist content from a URL
 * @param {string} playlistUrl - URL to the playlist
 * @returns {Promise<string>} - Playlist content
 */
function fetchPlaylistContent(playlistUrl) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(playlistUrl);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            protocol.get(playlistUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP status code ${res.statusCode}`));
                    return;
                }
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve(data);
                });
            }).on('error', (err) => {
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Validate playlist content
 * @param {string} content - Playlist content
 * @returns {Promise<Object>} - Validation results
 */
async function validatePlaylistContent(content) {
    try {
        // Check if it's a valid m3u8 file
        if (!content.trim().startsWith('#EXTM3U')) {
            return { valid: false, error: 'Invalid M3U8 format - missing #EXTM3U header' };
        }
        
        // Count the number of channels/streams
        const lines = content.split('\n');
        let channelCount = 0;
        let validStreamCount = 0;
        let sampleStreamUrl = null;
        
        // Basic parsing to count streams and check a sample
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                channelCount++;
                
                // Get the next non-comment line which should be the stream URL
                let j = i + 1;
                while (j < lines.length && lines[j].trim().startsWith('#')) {
                    j++;
                }
                
                if (j < lines.length) {
                    const streamUrl = lines[j].trim();
                    
                    // Keep track of a sample stream for validation
                    if (!sampleStreamUrl && streamUrl) {
                        sampleStreamUrl = streamUrl;
                    }
                    
                    // Count valid-looking streams (must be a URL or path)
                    if (streamUrl && (streamUrl.startsWith('http') || !streamUrl.startsWith('#'))) {
                        validStreamCount++;
                    }
                }
            }
        }
        
        // If no channels found, it's invalid
        if (channelCount === 0) {
            return { valid: false, error: 'No channels found in playlist' };
        }
        
        // Check if at least some streams look valid
        if (validStreamCount === 0) {
            return { valid: false, error: 'No valid streams found in playlist' };
        }
        
        // Try to verify a sample stream if one was found
        let sampleStreamValid = true;
        if (sampleStreamUrl && sampleStreamUrl.startsWith('http')) {
            sampleStreamValid = await isUrlReachable(sampleStreamUrl);
        }
        
        return {
            valid: true,
            channelCount,
            validStreamCount,
            sampleTested: !!sampleStreamUrl,
            sampleValid: sampleStreamValid
        };
    } catch (error) {
        logSourceChange(`Error validating playlist content: ${error.message}`, 'error');
        return { valid: false, error: error.message };
    }
}

module.exports = {
    validatePlaylistFile,
    validatePlaylistUrl,
    validatePlaylistContent
};

/**
 * IPTV Player Preload Script
 * 
 * This script runs in the renderer process before the web page loads.
 * It provides safe access to node modules and IPC for the renderer process.
 */

const { ipcRenderer, contextBridge } = require('electron');
const path = require('path');
const os = require('os');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Channel navigation
    getChannels: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('channels-loaded', (_, channels) => resolve(channels));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('load-channels');
      });
    },
    
    // Playback control
    playChannel: (channelId) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('channel-playing', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('play-channel', channelId);
      });
    },
      stopPlayback: () => ipcRenderer.send('player-stop'),
    togglePlay: () => ipcRenderer.send('player-toggle-play'),
    toggleFullscreen: () => ipcRenderer.send('player-toggle-fullscreen'),
    
    // Time-shifting controls
    pausePlayback: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playback-paused', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('pause-playback');
      });
    },
    
    resumePlayback: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playback-resumed', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('resume-playback');
      });
    },
    
    seekBackward: (seconds) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playback-seeked', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('seek-playback', -seconds);
      });
    },
    
    seekForward: (seconds) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playback-seeked', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('seek-playback', seconds);
      });
    },
    
    getPlaybackInfo: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playback-info', (_, info) => resolve(info));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-playback-info');
      });
    },
    
    // Caption functions
    loadCaptions: (channelId, streamUrl) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('captions-loaded', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('load-captions', { channelId, streamUrl });
      });
    },
    
    toggleCaptions: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('captions-toggled', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('toggle-captions');
      });
    },
    
    getCaptionSettings: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('caption-settings', (_, settings) => resolve(settings));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-caption-settings');
      });
    },
    
    updateCaptionSettings: (settings) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('caption-settings-updated', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('update-caption-settings', settings);
      });
    },
    
    enhanceCaptionWithAI: (text, mode) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('caption-enhanced', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('enhance-caption', { text, mode });
      });
    },
    
    // Recording
    startRecording: (channelId) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('recording-started', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('start-channel-recording', channelId);
      });
    },
      stopRecording: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('recording-stopped', () => resolve());
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('stop-recording');
      });
    },
    
    // EPG (Electronic Program Guide)
    getEpgConfig: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('epg-config', (_, config) => resolve(config));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-epg-config');
      });
    },
    
    addEpgSource: (url, name = '') => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('epg-source-added', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('add-epg-source', { url, name });
      });
    },
    
    removeEpgSource: (url) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('epg-source-removed', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('remove-epg-source', url);
      });
    },
    
    toggleEpgSource: (data) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('epg-source-toggled', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('toggle-epg-source', data);
      });
    },
    
    updateEpg: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('epg-updated', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('update-epg');
      });
    },
    
    getChannelPrograms: (channelId, count) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('channel-programs', (_, programs) => resolve(programs));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-channel-programs', { channelId, count });
      });
    },
    
    getCurrentProgram: (channelId) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('current-program', (_, program) => resolve(program));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-current-program', channelId);
      });
    },
    
    searchPrograms: (query, options) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('program-search-results', (_, results) => resolve(results));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('search-programs', { query, options });
      });
    },
    
    // Scheduled recording
    scheduleRecording: (channelId, startTime, durationMinutes, title) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('recording-scheduled', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('schedule-recording', {
          channelId,
          startTime,
          durationMinutes,
          title
        });
      });
    },
    
    cancelScheduledRecording: (recordingId) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('recording-cancelled', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('cancel-scheduled-recording', recordingId);
      });
    },
    
    getScheduledRecordings: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('scheduled-recordings', (_, recordings) => resolve(recordings));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-scheduled-recordings');
      });
    },
    
    // Settings management
    getSettings: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('settings-loaded', (_, settings) => resolve(settings));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-settings');
      });
    },
    
    saveSettings: (settings) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('settings-saved', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('save-settings', settings);
      });
    },
    
    resetSettings: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('settings-reset', (_, result) => resolve(result));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('reset-settings');
      });
    },
    
    // Playlist source management
    getPlaylistSources: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playlist-sources-loaded', (_, sources) => resolve(sources));
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('get-playlist-sources');
      });
    },
    
    addPlaylistSource: (source) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playlist-source-added', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('add-playlist-source', source);
      });
    },
    
    removePlaylistSource: (source) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playlist-source-removed', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('remove-playlist-source', source);
      });
    },
    
    togglePlaylistSource: (source) => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playlist-source-toggled', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('toggle-playlist-source', source);
      });
    },
    
    updatePlaylists: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playlists-updated', (_, result) => {
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('update-playlists');
      });
    },
    
    // File system operations
    browseForPlaylist: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('playlist-file-selected', (_, result) => {
          if (result.success) {
            resolve(result.filePath);
          } else {
            resolve(null); // User canceled
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('browse-playlist-file');
      });
    },
    
    browseForFolder: () => {
      return new Promise((resolve, reject) => {
        ipcRenderer.once('folder-selected', (_, result) => {
          if (result.success) {
            resolve(result.folderPath);
          } else {
            resolve(null); // User canceled
          }
        });
        ipcRenderer.once('error', (_, error) => reject(error));
        ipcRenderer.send('browse-folder');
      });
    },
    
    // UI event handling
    on: (channel, callback) => {
      const validChannels = [
        'show-add-playlist-dialog',
        'show-settings',
        'player-toggle-play',
        'player-stop',
        'player-toggle-fullscreen',
        'start-recording',
        'stop-recording',
        'schedule-recording',
        'error'
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      }
    },
    
    // System information
    getSystemInfo: () => {
      return {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        hostname: os.hostname(),
        homedir: os.homedir(),
        userDataPath: path.join(os.homedir(), '.iptv-player')
      };
    }
  }
);

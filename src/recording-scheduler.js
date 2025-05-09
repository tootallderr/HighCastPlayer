/**
 * Recording Scheduler
 * 
 * This module manages scheduling of recordings, storing scheduled tasks, and
 * integrating with platform-specific task schedulers.
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const platform = require('./platform');
const playerEngine = require('./player-engine');
const config = require('./config-manager');

// Define paths
const DATA_DIR = platform.getAppDataPath();
const SCHEDULE_FILE = path.join(DATA_DIR, 'recording-schedule.json');
const LOG_FILE = path.join(__dirname, '..', 'tests', 'recording.log');

// Initialize event emitter
const emitter = new EventEmitter();

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Scheduler state
let scheduledRecordings = [];
let activeTimers = {};

/**
 * Logger function for recording events
 */
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Append to log file
    fs.appendFileSync(LOG_FILE, formattedMessage);
    
    // Also output to console if not in production
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Scheduler] ${message}`);
    }
}

/**
 * Load scheduled recordings from file
 */
function loadSchedule() {
    try {
        if (fs.existsSync(SCHEDULE_FILE)) {
            const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
            scheduledRecordings = JSON.parse(data);
            log(`Loaded ${scheduledRecordings.length} scheduled recordings`);
        } else {
            scheduledRecordings = [];
            log('No recording schedule file found, creating empty schedule');
            saveSchedule();
        }
    } catch (error) {
        log(`Error loading recording schedule: ${error.message}`, 'error');
        scheduledRecordings = [];
    }
    
    return scheduledRecordings;
}

/**
 * Save scheduled recordings to file
 */
function saveSchedule() {
    try {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(scheduledRecordings, null, 2));
        log(`Saved ${scheduledRecordings.length} scheduled recordings`);
    } catch (error) {
        log(`Error saving recording schedule: ${error.message}`, 'error');
    }
}

/**
 * Generate a unique ID for a recording
 */
function generateRecordingId() {
    return `rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * Schedule a recording
 */
function scheduleRecording(channelId, startTime, durationMinutes, title = null) {
    return new Promise((resolve, reject) => {
        try {
            // Validate inputs
            if (!channelId) {
                return reject(new Error('Channel ID is required'));
            }
            
            if (!startTime || !(startTime instanceof Date)) {
                return reject(new Error('Valid start time is required'));
            }
            
            if (!durationMinutes || durationMinutes <= 0) {
                return reject(new Error('Duration must be greater than 0'));
            }
            
            const now = new Date();
            if (startTime < now) {
                return reject(new Error('Cannot schedule recordings in the past'));
            }
            
            const recordingId = generateRecordingId();
            
            // Create new scheduled recording
            const newRecording = {
                id: recordingId,
                channelId,
                title: title || `Recording ${recordingId}`,
                startTime: startTime.toISOString(),
                durationMinutes,
                status: 'scheduled',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            };
            
            // Add to list and save
            scheduledRecordings.push(newRecording);
            saveSchedule();
            
            // Set up timer for the recording
            setupRecordingTimer(newRecording);
            
            log(`Scheduled recording ${recordingId} for channel ${channelId} at ${startTime}`);
            
            resolve(newRecording);
        } catch (error) {
            log(`Error scheduling recording: ${error.message}`, 'error');
            reject(error);
        }
    });
}

/**
 * Set up a timer for a scheduled recording
 */
function setupRecordingTimer(recording) {
    const startTime = new Date(recording.startTime);
    const now = new Date();
    
    // Calculate milliseconds until recording should start
    const msUntilStart = startTime.getTime() - now.getTime();
    
    if (msUntilStart <= 0) {
        // Recording should have started already, ignore it
        log(`Recording ${recording.id} was scheduled for the past, ignoring`, 'warn');
        return;
    }
    
    // Set up timer to start the recording
    log(`Setting up timer for recording ${recording.id}, will start in ${Math.round(msUntilStart / 1000 / 60)} minutes`);
    
    activeTimers[recording.id] = setTimeout(() => {
        startScheduledRecording(recording);
    }, msUntilStart);
}

/**
 * Start a scheduled recording
 */
async function startScheduledRecording(recording) {
    try {
        log(`Starting scheduled recording ${recording.id} for channel ${recording.channelId}`);
        
        // Update recording status
        const index = scheduledRecordings.findIndex(r => r.id === recording.id);
        if (index >= 0) {
            scheduledRecordings[index].status = 'recording';
            scheduledRecordings[index].updatedAt = new Date().toISOString();
            scheduledRecordings[index].recordingStartedAt = new Date().toISOString();
            saveSchedule();
        }
        
        // Start the recording using player engine
        const result = await playerEngine.startRecording(recording.channelId);
        
        // Set up timer to stop recording after duration
        const durationMs = recording.durationMinutes * 60 * 1000;
        
        log(`Recording started, will continue for ${recording.durationMinutes} minutes`);
        
        // Set timeout to stop recording
        activeTimers[`${recording.id}_stop`] = setTimeout(() => {
            stopScheduledRecording(recording);
        }, durationMs);
        
        // Emit event that recording started
        emitter.emit('recording-started', { recording, result });
    } catch (error) {
        log(`Error starting scheduled recording: ${error.message}`, 'error');
        
        // Update recording status
        const index = scheduledRecordings.findIndex(r => r.id === recording.id);
        if (index >= 0) {
            scheduledRecordings[index].status = 'failed';
            scheduledRecordings[index].error = error.message;
            scheduledRecordings[index].updatedAt = new Date().toISOString();
            saveSchedule();
        }
        
        // Emit error event
        emitter.emit('recording-error', { recording, error });
    }
}

/**
 * Stop a scheduled recording
 */
async function stopScheduledRecording(recording) {
    try {
        log(`Stopping scheduled recording ${recording.id}`);
        
        // Stop the recording using player engine
        const result = await playerEngine.stopRecording();
        
        // Update recording status
        const index = scheduledRecordings.findIndex(r => r.id === recording.id);
        if (index >= 0) {
            scheduledRecordings[index].status = 'completed';
            scheduledRecordings[index].updatedAt = new Date().toISOString();
            scheduledRecordings[index].recordingEndedAt = new Date().toISOString();
            
            if (result && result.outputPath) {
                scheduledRecordings[index].outputPath = result.outputPath;
            }
            
            saveSchedule();
        }
        
        // Emit event that recording completed
        emitter.emit('recording-completed', { recording, result });
    } catch (error) {
        log(`Error stopping scheduled recording: ${error.message}`, 'error');
        
        // Update recording status
        const index = scheduledRecordings.findIndex(r => r.id === recording.id);
        if (index >= 0) {
            scheduledRecordings[index].status = 'failed';
            scheduledRecordings[index].error = error.message;
            scheduledRecordings[index].updatedAt = new Date().toISOString();
            saveSchedule();
        }
        
        // Emit error event
        emitter.emit('recording-error', { recording, error });
    }
}

/**
 * Cancel a scheduled recording
 */
function cancelRecording(recordingId) {
    const index = scheduledRecordings.findIndex(r => r.id === recordingId);
    
    if (index === -1) {
        log(`Recording ${recordingId} not found`, 'warn');
        return false;
    }
    
    const recording = scheduledRecordings[index];
    
    // Clear any active timers
    if (activeTimers[recordingId]) {
        clearTimeout(activeTimers[recordingId]);
        delete activeTimers[recordingId];
    }
    
    if (activeTimers[`${recordingId}_stop`]) {
        clearTimeout(activeTimers[`${recordingId}_stop`]);
        delete activeTimers[`${recordingId}_stop`];
    }
    
    // If recording is in progress, stop it
    if (recording.status === 'recording') {
        playerEngine.stopRecording().catch(error => {
            log(`Error stopping recording ${recordingId}: ${error.message}`, 'error');
        });
    }
    
    // Update status
    scheduledRecordings[index].status = 'cancelled';
    scheduledRecordings[index].updatedAt = new Date().toISOString();
    saveSchedule();
    
    log(`Cancelled recording ${recordingId}`);
    
    // Emit event
    emitter.emit('recording-cancelled', { recording });
    
    return true;
}

/**
 * Get all scheduled recordings
 */
function getAllScheduledRecordings() {
    return scheduledRecordings;
}

/**
 * Get recordings by status
 */
function getRecordingsByStatus(status) {
    return scheduledRecordings.filter(r => r.status === status);
}

/**
 * Initialize the recording scheduler
 */
function initialize() {
    log('Initializing recording scheduler');
    
    // Load schedule from file
    loadSchedule();
    
    // Set up timers for all pending recordings
    const pendingRecordings = scheduledRecordings.filter(
        r => r.status === 'scheduled'
    );
    
    log(`Setting up timers for ${pendingRecordings.length} pending recordings`);
    
    pendingRecordings.forEach(recording => {
        setupRecordingTimer(recording);
    });
    
    log('Recording scheduler initialized');
    
    return { success: true };
}

/**
 * Clean up scheduler on shutdown
 */
function shutdown() {
    log('Shutting down recording scheduler');
    
    // Clear all active timers
    Object.keys(activeTimers).forEach(key => {
        clearTimeout(activeTimers[key]);
    });
    
    activeTimers = {};
    
    log('Recording scheduler shut down');
}

// Export methods
module.exports = {
    initialize,
    shutdown,
    scheduleRecording,
    cancelRecording,
    getAllScheduledRecordings,
    getRecordingsByStatus,
    on: (event, listener) => emitter.on(event, listener),
    off: (event, listener) => emitter.off(event, listener)
};

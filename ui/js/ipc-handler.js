/**
 * IPC Handler
 * 
 * This module handles IPC communication between the renderer and main processes
 */

class IpcHandler {
    constructor() {
        // Set up status message event listener
        if (window.api.onStatusMessage) {
            window.api.onStatusMessage(this.handleStatusMessage.bind(this));
        }
        
        // Set up playlists updated event listener
        if (window.api.onPlaylistsUpdated) {
            window.api.onPlaylistsUpdated(this.handlePlaylistsUpdated.bind(this));
        }
        
        console.log('IPC Handler initialized');
    }
    
    /**
     * Handle status message from main process
     * @param {Object} message - Message object
     * @param {string} message.text - Message text
     * @param {string} message.type - Message type (info, success, warning, error)
     */
    handleStatusMessage(message) {
        console.log('Status message received:', message);
        this.showMessage(message.text, message.type || 'info');
    }
    
    /**
     * Handle playlists updated event from main process
     * @param {Object} result - Update result
     */
    handlePlaylistsUpdated(result) {
        console.log('Playlists updated notification received:', result);
        
        if (result.success) {
            // Show notification
            this.showMessage(`Playlists updated with ${result.channels} channels. Refreshing...`, 'success');
            
            // Reload channels after a short delay
            setTimeout(() => {
                if (typeof window.loadChannels === 'function') {
                    window.loadChannels();
                } else {
                    console.error('loadChannels function not found');
                    location.reload(); // Fallback to reload the page
                }
            }, 1000);
        } else {
            this.showMessage(`Failed to update playlists: ${result.error}`, 'error');
        }
    }
    
    /**
     * Show a message notification
     * @param {string} message - Message text
     * @param {string} type - Message type (info, success, warning, error)
     * @param {number} duration - Duration in milliseconds
     */
    showMessage(message, type = 'info', duration = 5000) {
        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) {
            console.error('Message container not found');
            return;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        messageElement.textContent = message;
        
        messageContainer.appendChild(messageElement);
        
        // Add animation classes
        setTimeout(() => {
            messageElement.classList.add('visible');
        }, 10);
        
        // Auto-remove after duration
        setTimeout(() => {
            messageElement.classList.remove('visible');
            setTimeout(() => {
                if (messageElement.parentNode === messageContainer) {
                    messageContainer.removeChild(messageElement);
                }
            }, 300);
        }, duration);
        
        // Add close button
        const closeBtn = document.createElement('span');
        closeBtn.className = 'message-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            messageElement.classList.remove('visible');
            setTimeout(() => {
                if (messageElement.parentNode === messageContainer) {
                    messageContainer.removeChild(messageElement);
                }
            }, 300);
        });
        
        messageElement.appendChild(closeBtn);
    }
}

// Initialize the IPC handler when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.ipcHandler = new IpcHandler();
});

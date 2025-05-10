/**
 * UI Modernization - Casting and Recommendations
 * 
 * This file handles the UI interactions for the casting and recommendations features.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const castBtn = document.getElementById('cast-btn');
    const castingPanel = document.getElementById('casting-panel');
    const castingClose = document.getElementById('casting-close');
    const deviceList = document.getElementById('device-list');
    const refreshDevicesBtn = document.getElementById('refresh-devices');
    const castingActiveSection = document.getElementById('casting-active');
    const castingNotActiveSection = document.getElementById('casting-not-active');
    const activeDeviceName = document.getElementById('active-device-name');
    const castingPlayPause = document.getElementById('casting-play-pause');
    const castingStop = document.getElementById('casting-stop');
    
    const recommendationsToggle = document.getElementById('recommendations-toggle');
    const recommendationsPanel = document.getElementById('recommendations-panel');
    const recommendationsClose = document.getElementById('recommendations-close');
    const recommendationsContent = document.getElementById('recommendations-content');
    
    const helpPanel = document.getElementById('modernization-help');
    const helpClose = document.getElementById('help-close');
    const dontShowAgain = document.getElementById('dont-show-again');
    const helpGotIt = document.getElementById('help-got-it');
    
    let currentChannel = null;
    let castingDevices = [];
    let activeCastingDevice = null;
    let castingMedia = null;
    let isCurrentlyCasting = false;
    
    // Initial setup
    setupCastingUI();
    setupRecommendationsUI();
    setupHelpPanel();
    
    // Periodically update casting status and recommendations
    setInterval(updateCastingStatus, 5000);
    setInterval(updateRecommendations, 60000);  // Update recommendations every minute
    
    /**
     * Set up the casting UI elements and event listeners
     */
    function setupCastingUI() {
        // Hide active casting section initially
        castingActiveSection.style.display = 'none';
        castingNotActiveSection.style.display = 'block';
        
        // Cast button click handler
        castBtn.addEventListener('click', toggleCastingPanel);
        
        // Close button click handler
        castingClose.addEventListener('click', () => {
            castingPanel.classList.remove('visible');
        });
        
        // Refresh devices button click handler
        refreshDevicesBtn.addEventListener('click', refreshDevices);
        
        // Casting control buttons
        castingPlayPause.addEventListener('click', toggleCastPlayback);
        castingStop.addEventListener('click', stopCasting);
        
        // Load devices initially
        refreshDevices();
        
        // Update casting status
        updateCastingStatus();
    }
    
    /**
     * Set up the recommendations UI elements and event listeners
     */
    function setupRecommendationsUI() {
        // Recommendations toggle button click handler
        recommendationsToggle.addEventListener('click', toggleRecommendationsPanel);
        
        // Close button click handler
        recommendationsClose.addEventListener('click', () => {
            recommendationsPanel.classList.remove('visible');
        });
        
        // Load initial recommendations
        updateRecommendations();
    }
    
    /**
     * Set up the help panel
     */
    function setupHelpPanel() {
        // Check if we should show the help panel
        const helpShown = localStorage.getItem('modernization-help-shown');
        
        if (!helpShown) {
            // Show the help panel after a short delay
            setTimeout(() => {
                helpPanel.classList.add('visible');
            }, 2000);
        }
        
        // Help panel close button
        helpClose.addEventListener('click', () => {
            closeHelpPanel();
        });
        
        // Got it button
        helpGotIt.addEventListener('click', () => {
            closeHelpPanel();
        });
    }
    
    /**
     * Toggle the casting panel visibility
     */
    function toggleCastingPanel() {
        castingPanel.classList.toggle('visible');
        if (castingPanel.classList.contains('visible')) {
            refreshDevices();
        }
    }
    
    /**
     * Toggle the recommendations panel visibility
     */
    function toggleRecommendationsPanel() {
        recommendationsPanel.classList.toggle('visible');
        if (recommendationsPanel.classList.contains('visible')) {
            updateRecommendations();
        }
    }
    
    /**
     * Handle errors gracefully
     * @param {string} component - The component that had an error (casting, recommendations)
     * @param {Error} error - The error object
     * @param {Element} container - The container element to update with error message
     * @param {string} defaultMessage - Default message to show
     */
    function handleError(component, error, container, defaultMessage) {
        console.error(`[${component}] Error:`, error);
        
        // Show error message in UI
        if (container) {
            container.innerHTML = `<div class="error-message">
                <div class="error-icon">⚠️</div>
                <div class="error-text">${defaultMessage}</div>
                <div class="error-details">${error.message}</div>
            </div>`;
        }
        
        // Show notification to user
        showMessage(defaultMessage + ': ' + error.message, 'error');
    }

    /**
     * Check if a feature is available
     * @param {string} feature - The feature to check (casting, recommendations)
     * @returns {boolean} - Whether the feature is available
     */
    function isFeatureAvailable(feature) {
        // Check if the feature is enabled in user preferences
        const preferencesJson = localStorage.getItem('modernization-preferences');
        if (preferencesJson) {
            try {
                const preferences = JSON.parse(preferencesJson);
                if (feature === 'casting' && preferences.castingEnabled === false) {
                    return false;
                }
                if (feature === 'recommendations' && preferences.recommendationsEnabled === false) {
                    return false;
                }
            } catch (error) {
                console.error('Error parsing preferences:', error);
            }
        }
        
        return true;
    }

    /**
     * Refresh the list of available casting devices with improved error handling
     */
    async function refreshDevices() {
        if (!isFeatureAvailable('casting')) {
            return;
        }

        deviceList.innerHTML = '<div class="searching-devices">Searching for devices...</div>';
        
        try {
            const result = await window.api.refreshCastingDevices();
            
            if (result.success && result.devices && result.devices.length > 0) {
                castingDevices = result.devices;
                renderDeviceList(castingDevices);
                
                // Show success message
                showMessage('Found ' + result.count + ' casting device(s)', 'success');
                
                // Update the cast button to show devices are available
                castBtn.classList.add('devices-available');
            } else {
                deviceList.innerHTML = '<div class="no-devices-found">No casting devices found.<br>Make sure your devices are on the same network.</div>';
                showMessage('No casting devices found', 'info');
                castBtn.classList.remove('devices-available');
            }
        } catch (error) {
            handleError('casting', error, deviceList, 'Error finding devices');
            castBtn.classList.remove('devices-available');
        }
    }
    
    /**
     * Update the recommendations with improved error handling
     */
    async function updateRecommendations() {
        if (!isFeatureAvailable('recommendations')) {
            return;
        }

        try {
            // Set loading state
            recommendationsContent.innerHTML = '<div class="loading-indicator">Loading recommendations...</div>';
            
            // Get current channel ID if applicable
            const currentChannelId = currentChannel ? currentChannel.id : null;
            
            const recommendations = await window.api.getRecommendations(currentChannelId);
            
            if (recommendations && recommendations.length > 0) {
                renderRecommendations(recommendations);
                
                // Update the toggle button to show there are recommendations
                recommendationsToggle.classList.add('has-recommendations');
                recommendationsToggle.setAttribute('title', `${recommendations.length} Recommended Channels`);
            } else {
                recommendationsContent.innerHTML = '<div class="recommendations-empty">No recommendations available yet.<br>Watch more content to get personalized suggestions.</div>';
                recommendationsToggle.classList.remove('has-recommendations');
                recommendationsToggle.setAttribute('title', 'No Recommendations Yet');
            }
        } catch (error) {
            handleError('recommendations', error, recommendationsContent, 'Could not load recommendations');
            recommendationsToggle.classList.remove('has-recommendations');
        }
    }
    
    /**
     * Set up the casting UI elements and event listeners
     */
    function setupCastingUI() {
        // Hide active casting section initially
        castingActiveSection.style.display = 'none';
        castingNotActiveSection.style.display = 'block';
        
        // Cast button click handler
        castBtn.addEventListener('click', toggleCastingPanel);
        
        // Close button click handler
        castingClose.addEventListener('click', () => {
            castingPanel.classList.remove('visible');
        });
        
        // Refresh devices button click handler
        refreshDevicesBtn.addEventListener('click', refreshDevices);
        
        // Casting control buttons
        castingPlayPause.addEventListener('click', toggleCastPlayback);
        castingStop.addEventListener('click', stopCasting);
        
        // Load devices initially
        refreshDevices();
        
        // Update casting status
        updateCastingStatus();
    }
    
    /**
     * Set up the recommendations UI elements and event listeners
     */
    function setupRecommendationsUI() {
        // Recommendations toggle button click handler
        recommendationsToggle.addEventListener('click', toggleRecommendationsPanel);
        
        // Close button click handler
        recommendationsClose.addEventListener('click', () => {
            recommendationsPanel.classList.remove('visible');
        });
        
        // Load initial recommendations
        updateRecommendations();
    }
    
    /**
     * Set up the help panel
     */
    function setupHelpPanel() {
        // Check if we should show the help panel
        const helpShown = localStorage.getItem('modernization-help-shown');
        
        if (!helpShown) {
            // Show the help panel after a short delay
            setTimeout(() => {
                helpPanel.classList.add('visible');
            }, 2000);
        }
        
        // Help panel close button
        helpClose.addEventListener('click', () => {
            closeHelpPanel();
        });
        
        // Got it button
        helpGotIt.addEventListener('click', () => {
            closeHelpPanel();
        });
    }
    
    /**
     * Toggle the casting panel visibility
     */
    function toggleCastingPanel() {
        castingPanel.classList.toggle('visible');
        if (castingPanel.classList.contains('visible')) {
            refreshDevices();
        }
    }
    
    /**
     * Toggle the recommendations panel visibility
     */
    function toggleRecommendationsPanel() {
        recommendationsPanel.classList.toggle('visible');
        if (recommendationsPanel.classList.contains('visible')) {
            updateRecommendations();
        }
    }
    
    /**
     * Show a message to the user
     * @param {string} message - The message to display
     * @param {string} type - The type of message (success, error, info, warning)
     */
    function showMessage(message, type = 'info') {
        // Check if status-message element exists
        let messageContainer = document.getElementById('status-message');
        
        if (!messageContainer) {
            // Create message container if it doesn't exist
            messageContainer = document.createElement('div');
            messageContainer.id = 'status-message';
            document.body.appendChild(messageContainer);
        }
        
        const msgElement = document.createElement('div');
        msgElement.className = `message message-${type}`;
        msgElement.textContent = message;
        
        messageContainer.appendChild(msgElement);
        
        // Remove the message after 5 seconds
        setTimeout(() => {
            msgElement.classList.add('fade-out');
            setTimeout(() => {
                messageContainer.removeChild(msgElement);
            }, 500);
        }, 5000);
    }
    
    /**
     * Close the help panel and save preference if selected
     */
    function closeHelpPanel() {
        helpPanel.classList.remove('visible');
        
        if (dontShowAgain.checked) {
            localStorage.setItem('modernization-help-shown', 'true');
        }
    }
    
    /**
     * Save user preferences 
     */
    function saveUserPreferences() {
        const preferences = {
            recommendationsEnabled: true,
            castingEnabled: true,
            lastCastingDevice: activeCastingDevice ? activeCastingDevice.id : null,
            helpShown: localStorage.getItem('modernization-help-shown') === 'true'
        };
        
        // Store preferences in localStorage
        localStorage.setItem('modernization-preferences', JSON.stringify(preferences));
    }
    
    /**
     * Load user preferences
     */
    function loadUserPreferences() {
        const preferencesJson = localStorage.getItem('modernization-preferences');
        
        if (preferencesJson) {
            try {
                const preferences = JSON.parse(preferencesJson);
                
                // Apply preferences if they exist
                if (preferences.recommendationsEnabled === false) {
                    // Hide recommendations button
                    recommendationsToggle.style.display = 'none';
                }
                
                if (preferences.castingEnabled === false) {
                    // Hide casting button
                    castBtn.style.display = 'none';
                }
            } catch (error) {
                console.error('Error parsing preferences:', error);
            }
        }
    }
    
    // Load user preferences on startup
    loadUserPreferences();
    
    // Save preferences when closing the app
    window.addEventListener('beforeunload', () => {
        saveUserPreferences();
    });
    
    /**
     * Update current channel reference when a channel is played
     */
    document.addEventListener('channel-played', (event) => {
        if (event.detail && event.detail.channel) {
            currentChannel = event.detail.channel;
        }
    });
});

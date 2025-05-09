// Metadata overlay functionality
function loadMetadata() {
    if (!currentChannel) return;
    
    // Update metadata fields
    metadataTitle.textContent = currentChannel.title || 'Unknown';
    
    // Get detailed metadata from player (quality and bitrate)
    window.api.getPlaybackInfo()
        .then(info => {
            if (info && info.quality) {
                metadataQuality.textContent = info.quality;
                statusQuality.textContent = info.quality;
            } else {
                metadataQuality.textContent = 'Unknown';
            }
            
            if (info && info.bitrate) {
                metadataBitrate.textContent = `${Math.round(info.bitrate / 1024)} Kbps`;
            } else {
                metadataBitrate.textContent = 'Unknown';
            }
            
            if (info && info.codec) {
                metadataCodec.textContent = info.codec;
            } else {
                metadataCodec.textContent = 'Unknown';
            }
        })
        .catch(error => {
            console.error('Error getting playback info:', error);
        });
    
    // Get current program info from EPG
    if (currentChannel.epgId) {
        window.api.getCurrentProgram(currentChannel.epgId)
            .then(program => {
                currentProgram = program;
                if (program) {
                    // Update the metadata with program info
                    metadataTitle.textContent = `${currentChannel.title}: ${program.title}`;
                }
            })
            .catch(error => {
                console.error('Error getting program info:', error);
            });
    }
}

function setupMetadataUpdater() {
    // Clear any existing interval
    if (metadataUpdateInterval) {
        clearInterval(metadataUpdateInterval);
    }
    
    // Update metadata every 30 seconds
    loadMetadata();
    metadataUpdateInterval = setInterval(loadMetadata, 30000);
}

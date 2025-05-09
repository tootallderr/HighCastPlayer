// EPG Panel functionality
function showEpg() {
    if (!currentChannel) return;
    
    epgVisible = true;
    epgPanel.classList.add('visible');
    epgLoading.style.display = 'flex';
    epgTimeline.innerHTML = '';
    
    // Load EPG data for current channel
    const channelId = currentChannel.epgId || currentChannel.id;
    
    window.api.getChannelPrograms(channelId, 10)
        .then(programs => {
            epgLoading.style.display = 'none';
            
            if (programs && programs.length > 0) {
                // Populate timeline with program data
                programs.forEach(program => {
                    const programEl = document.createElement('div');
                    programEl.className = 'epg-program';
                    
                    // If this is the current program, add the 'current' class
                    if (currentProgram && program.start === currentProgram.start) {
                        programEl.classList.add('current');
                    }
                    
                    // Format start and end time
                    const startTime = program.start ? new Date(program.start) : null;
                    const endTime = program.end ? new Date(program.end) : null;
                    
                    let timeText = 'Unknown time';
                    if (startTime && endTime) {
                        const startFormat = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const endFormat = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        timeText = `${startFormat} - ${endFormat}`;
                    }
                    
                    const timeEl = document.createElement('div');
                    timeEl.className = 'epg-time';
                    timeEl.textContent = timeText;
                    
                    const titleEl = document.createElement('div');
                    titleEl.className = 'epg-program-title';
                    titleEl.textContent = program.title || 'Unknown Program';
                    
                    const descEl = document.createElement('div');
                    descEl.className = 'epg-description';
                    descEl.textContent = program.description || 'No description available';
                    
                    programEl.appendChild(timeEl);
                    programEl.appendChild(titleEl);
                    programEl.appendChild(descEl);
                    epgTimeline.appendChild(programEl);
                });
            } else {
                // No program data available
                const noDataEl = document.createElement('div');
                noDataEl.className = 'epg-no-data';
                noDataEl.textContent = 'No program guide data available for this channel.';
                epgTimeline.appendChild(noDataEl);
            }
        })
        .catch(error => {
            console.error('Error loading EPG data:', error);
            epgLoading.style.display = 'none';
            
            const errorEl = document.createElement('div');
            errorEl.className = 'epg-error';
            errorEl.textContent = 'Failed to load program guide.';
            epgTimeline.appendChild(errorEl);
        });
}

function hideEpg() {
    epgVisible = false;
    epgPanel.classList.remove('visible');
}

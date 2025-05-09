// Filter channels when search input changes
searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    let matchCount = 0;
    searchResults.innerHTML = '';
    
    // If query is empty, hide results and reset status
    if (query === '') {
        searchResults.classList.remove('visible');
        statusChannel.textContent = currentChannel ? currentChannel.title : 'No channel selected';
        return;
    }
    
    // Filter channels based on search query
    const normalizedQuery = query.toLowerCase();
    const matches = allChannels.filter(channel => {
        return channel.title.toLowerCase().includes(normalizedQuery) || 
               channel.group.toLowerCase().includes(normalizedQuery);
    });
    
    // Check if we have any results
    if (matches.length > 0) {
        matchCount = matches.length;
        
        // Display results in the search results dropdown
        matches.slice(0, 15).forEach(channel => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.dataset.id = channel.id;
            
            const resultTitle = document.createElement('div');
            resultTitle.className = 'search-result-title';
            resultTitle.textContent = channel.title;
            
            const resultInfo = document.createElement('div');
            resultInfo.className = 'search-result-info';
            resultInfo.textContent = channel.group;
            
            resultItem.appendChild(resultTitle);
            resultItem.appendChild(resultInfo);
            searchResults.appendChild(resultItem);
            
            // Add click event to play channel
            resultItem.addEventListener('click', () => {
                const foundChannel = allChannels.find(ch => ch.id === channel.id);
                if (foundChannel) {
                    playChannel(foundChannel);
                    searchResults.classList.remove('visible');
                    searchInput.value = '';
                }
            });
        });
        
        searchResults.classList.add('visible');
    } else {
        searchResults.classList.remove('visible');
    }
    
    // Update status
    statusChannel.textContent = `Found ${matchCount} channels matching "${query}"`;
});

// Handle clicks outside search results to close dropdown
document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
        searchResults.classList.remove('visible');
    }
});

// Setup filter tags
filterTags.forEach(tag => {
    tag.addEventListener('click', () => {
        const filter = tag.dataset.filter;
        applyChannelFilter(filter);
    });
});

function applyChannelFilter(filter) {
    activeFilter = filter;
    
    // Update active filter UI
    filterTags.forEach(tag => {
        if (tag.dataset.filter === filter) {
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });
    
    // Get channels based on filter
    let filteredChannels = [];
    
    switch (filter) {
        case 'favorites':
            filteredChannels = allChannels.filter(channel => 
                favoriteChannels.includes(channel.id)
            );
            break;
            
        case 'recent':
            filteredChannels = allChannels.filter(channel => 
                recentChannels.includes(channel.id)
            );
            break;
            
        case 'all':
        default:
            filteredChannels = allChannels;
            break;
    }
    
    // Update channel list with filtered channels
    setupChannelGroups(filteredChannels);
}

// Add channel to recent list
function addToRecentChannels(channelId) {
    // Remove if already exists
    recentChannels = recentChannels.filter(id => id !== channelId);
    
    // Add to beginning of array
    recentChannels.unshift(channelId);
    
    // Limit to 10 items
    if (recentChannels.length > 10) {
        recentChannels.pop();
    }
    
    // Save to localStorage
    localStorage.setItem('recentChannels', JSON.stringify(recentChannels));
}

// Toggle favorite status for a channel
function toggleFavorite(channelId) {
    const index = favoriteChannels.indexOf(channelId);
    
    if (index === -1) {
        // Add to favorites
        favoriteChannels.push(channelId);
    } else {
        // Remove from favorites
        favoriteChannels.splice(index, 1);
    }
    
    // Save to localStorage
    localStorage.setItem('favoriteChannels', JSON.stringify(favoriteChannels));
    
    // Update UI if we're on the favorites filter
    if (activeFilter === 'favorites') {
        applyChannelFilter('favorites');
    }
}

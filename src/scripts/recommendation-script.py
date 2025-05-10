#!/usr/bin/env python3
# recommendation-script.py
# Script for generating recommendations using Python

import sys
import json
import os
from datetime import datetime

# Check arguments
if len(sys.argv) < 2:
    print(json.dumps({
        "error": "Missing arguments",
        "recommendations": []
    }))
    sys.exit(1)

try:
    # Parse input data
    input_file = sys.argv[1]
    with open(input_file, 'r', encoding='utf-8') as f:
        input_data = json.load(f)
    
    # Extract data
    history = input_data.get('history', [])
    channels = input_data.get('channels', [])
    current_channel = input_data.get('currentChannel')
    settings = input_data.get('settings', {})
    
    # Calculate scores based on viewing history
    channel_scores = {}
    
    # Skip current channel from recommendations
    channels = [c for c in channels if c.get('id') != current_channel]
    
    # If we have history data
    if history:
        # Get categories/genres from history
        watched_categories = {}
        
        for entry in history:
            channel_id = entry.get('channelId')
            view_time = entry.get('viewTimeSeconds', 0)
            timestamp = entry.get('timestamp', 0)
            
            # Find the channel
            channel = next((c for c in channels if c.get('id') == channel_id), None)
            
            if channel:
                category = channel.get('category', '').lower()
                if category:
                    if category not in watched_categories:
                        watched_categories[category] = 0
                    watched_categories[category] += view_time
        
        # Calculate recommendations
        max_score = 1
        for channel in channels:
            score = 0
            channel_id = channel.get('id')
            category = channel.get('category', '').lower()
            
            # Category match
            if category in watched_categories:
                cat_weight = settings.get('recommendationFactors', {}).get('genre', 0.5)
                score += watched_categories[category] * cat_weight
            
            # Store score
            channel_scores[channel_id] = score
            if score > max_score:
                max_score = score
        
        # Normalize scores
        for channel_id in channel_scores:
            channel_scores[channel_id] /= max_score
    
    # Create result
    recommendations = []
    for channel in channels:
        channel_id = channel.get('id')
        score = channel_scores.get(channel_id, 0)
        
        recommendations.append({
            'channel': channel,
            'score': score
        })
    
    # Sort by score
    recommendations.sort(key=lambda x: x['score'], reverse=True)
    
    # Limit to max recommendations
    max_recommendations = settings.get('maxRecommendations', 10)
    recommendations = recommendations[:max_recommendations]
    
    # Output result
    result = {
        'timestamp': datetime.now().isoformat(),
        'recommendations': recommendations,
        'method': 'python-ml'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({
        "error": str(e),
        "recommendations": []
    }))
    sys.exit(1)

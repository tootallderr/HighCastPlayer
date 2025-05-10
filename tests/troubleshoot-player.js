/**
 * IPTV Player Error Troubleshooter
 * 
 * This script analyzes the player.log file to find instances of 
 * "currentStreamInfo is not defined" errors and provides detailed
 * information about when and how they occur.
 */

const fs = require('fs');
const path = require('path');
const pathManager = require('../src/path-manager');

// Get paths
const logsDir = pathManager.getLogsDir();
const playerLogPath = path.join(logsDir, 'player.log');
const outputPath = path.join(logsDir, 'troubleshoot-report.log');

console.log('IPTV Player Error Troubleshooter');
console.log('================================\n');
console.log(`Analyzing player log: ${playerLogPath}`);

// Read the player log file
try {
  const log = fs.readFileSync(playerLogPath, 'utf8');
  const lines = log.split('\n');
  
  // Find all instances of the error
  const errorPattern = /currentStreamInfo is not defined/i;
  const contextLines = 10; // Number of lines before and after error to include
  let errorInstances = [];
  let errorCount = 0;
  
  console.log('Searching for "currentStreamInfo is not defined" errors...');
  
  for (let i = 0; i < lines.length; i++) {
    if (errorPattern.test(lines[i])) {
      errorCount++;
      
      // Get context around the error
      const startLine = Math.max(0, i - contextLines);
      const endLine = Math.min(lines.length - 1, i + contextLines);
      const context = lines.slice(startLine, endLine + 1);
      
      // Find relevant info in context
      const timestamp = extractTimestamp(lines[i]);
      const channelInfo = findChannelInfo(context);
      const playerState = findPlayerState(context);
      
      errorInstances.push({
        lineNumber: i + 1,
        timestamp,
        error: lines[i].trim(),
        channelInfo,
        playerState,
        context
      });
    }
  }
  
  // Generate report
  let report = `IPTV Player Error Analysis Report - ${new Date().toISOString()}\n`;
  report += '==============================================================\n\n';
  report += `Found ${errorCount} instances of "currentStreamInfo is not defined" errors.\n\n`;
  
  if (errorCount > 0) {
    report += 'ANALYSIS:\n';
    report += '---------\n';
    report += 'The "currentStreamInfo is not defined" error typically occurs when trying\n';
    report += 'to access playback information before a stream is fully initialized or\n';
    report += 'after it has been closed.\n\n';
    
    report += 'ERROR DETAILS:\n';
    report += '-------------\n\n';
    
    errorInstances.forEach((instance, index) => {
      report += `ERROR #${index + 1} (Line ${instance.lineNumber})\n`;
      report += `Timestamp: ${instance.timestamp}\n`;
      if (instance.channelInfo) {
        report += `Channel: ${instance.channelInfo}\n`;
      }
      if (instance.playerState) {
        report += `Player State: ${instance.playerState}\n`;
      }
      report += '\nContext:\n';
      report += instance.context.map(line => `  ${line}`).join('\n');
      report += '\n\n';
    });
    
    report += 'RECOMMENDATION:\n';
    report += '--------------\n';
    report += '1. Add checks for null/undefined currentStreamInfo in player-engine.js\n';
    report += '2. Update getPlaybackInfo() to return a safe default when no stream is active\n';
    report += '3. Ensure stream initialization is complete before accessing stream properties\n';
    report += '4. Add proper state management for player lifecycle events\n\n';
    
    report += 'SUGGESTED CODE FIX:\n';
    report += '-----------------\n';
    report += 'In player-engine.js, update the getPlaybackInfo function:\n\n';
    report += '```javascript\n';
    report += 'function getPlaybackInfo() {\n';
    report += '  if (!currentStreamInfo) {\n';
    report += '    // Return safe default when no stream is active\n';
    report += '    return {\n';
    report += '      isPlaying: false,\n';
    report += '      isPaused: false,\n';
    report += '      channel: null,\n';
    report += '      position: 0,\n';
    report += '      duration: 0,\n';
    report += '      bufferLength: 0\n';
    report += '    };\n';
    report += '  }\n';
    report += '  \n';
    report += '  return {\n';
    report += '    isPlaying: isPlaying,\n';
    report += '    isPaused: isPaused,\n';
    report += '    channel: currentStreamInfo.channel,\n';
    report += '    position: currentPlayer ? currentPlayer.currentTime() : 0,\n';
    report += '    duration: currentPlayer ? currentPlayer.duration() : 0,\n';
    report += '    bufferLength: getBufferLength()\n';
    report += '  };\n';
    report += '}\n';
    report += '```\n';
  } else {
    report += 'No instances of this error found. The error may have been resolved\n';
    report += 'or might be occurring in a different log file.\n';
  }
  
  // Write report to file
  fs.writeFileSync(outputPath, report);
  console.log(`\nAnalysis complete. Found ${errorCount} errors.`);
  console.log(`Report saved to: ${outputPath}`);
  console.log('\nSummary of recommendations:');
  console.log('1. Add null checks for currentStreamInfo');
  console.log('2. Implement safe default returns for player information');
  console.log('3. Review player state management in player-engine.js');
  
} catch (error) {
  console.error(`Error analyzing log file: ${error.message}`);
}

/**
 * Extract timestamp from log line
 */
function extractTimestamp(line) {
  const match = line.match(/\[(.*?)\]/);
  return match ? match[1] : 'Unknown';
}

/**
 * Find channel information in context lines
 */
function findChannelInfo(contextLines) {
  for (const line of contextLines) {
    if (line.includes('channel:') || line.includes('channelId:')) {
      const match = line.match(/channel(?:Id)?:\s*['"](.*?)['"]/);
      if (match) return match[1];
      
      const objectMatch = line.match(/channel(?:Id)?:\s*([^,\s]+)/);
      if (objectMatch) return objectMatch[1];
    }
  }
  return null;
}

/**
 * Find player state information in context lines
 */
function findPlayerState(contextLines) {
  const states = [];
  
  for (const line of contextLines) {
    if (line.includes('isPlaying:')) {
      const match = line.match(/isPlaying:\s*(true|false)/);
      if (match) states.push(`isPlaying: ${match[1]}`);
    }
    
    if (line.includes('isPaused:')) {
      const match = line.match(/isPaused:\s*(true|false)/);
      if (match) states.push(`isPaused: ${match[1]}`);
    }
    
    if (line.includes('player state:') || line.includes('playerState:')) {
      const match = line.match(/player(?:\s+)?state:?\s*['"](.*?)['"]/i);
      if (match) states.push(`state: ${match[1]}`);
    }
  }
  
  return states.length > 0 ? states.join(', ') : null;
}

// If this file is run directly, execute the analysis
if (require.main === module) {
  // Already running the analysis
}

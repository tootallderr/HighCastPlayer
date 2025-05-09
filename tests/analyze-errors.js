/**
 * IPTV Player Error Analyzer
 * 
 * This tool analyzes error logs from the IPTV Player to identify patterns,
 * common issues, and potential solutions. It scans all log files in the
 * tests directory and generates an error analysis report.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Define paths
const LOG_DIR = path.join(__dirname);
const ERROR_ANALYSIS_LOG = path.join(LOG_DIR, 'error_analysis.log');

// Error categories for classification
const ERROR_CATEGORIES = {
  NETWORK: ['network', 'connection', 'timeout', 'unreachable', 'dns', 'connect econnrefused', 'fetch'],
  CODEC: ['codec', 'unsupported format', 'media error', 'video', 'audio'],
  PERMISSION: ['permission', 'access denied', 'eacces'],
  PLAYLIST: ['playlist', 'm3u', 'parse', 'invalid format'],
  SYSTEM: ['system', 'disk', 'memory', 'cpu', 'resource'],
  UI: ['rendering', 'display', 'interface', 'electron'],
  FFMPEG: ['ffmpeg', 'recording', 'transcode'],
  CONFIG: ['config', 'settings', 'preference']
};

// Clear the error analysis log file
fs.writeFileSync(ERROR_ANALYSIS_LOG, '');

// Log function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(ERROR_ANALYSIS_LOG, formattedMessage);
  
  // Also output to console
  console.log(`[${level}] ${message}`);
}

// Write a report section
function writeReportSection(title, content) {
  const separator = '='.repeat(title.length + 4);
  fs.appendFileSync(ERROR_ANALYSIS_LOG, `\n${separator}\n  ${title}  \n${separator}\n\n`);
  fs.appendFileSync(ERROR_ANALYSIS_LOG, content + '\n');
}

// Find all log files in directory
function findLogFiles(dir) {
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.log'))
    .map(file => path.join(dir, file));
}

// Extract errors from a log file
async function extractErrors(logFile) {
  const errors = [];
  const fileStream = fs.createReadStream(logFile);
  
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    // Look for error patterns
    if (line.toLowerCase().includes('error') || 
        line.toLowerCase().includes('fatal') ||
        line.toLowerCase().includes('failed') ||
        line.toLowerCase().includes('exception') ||
        line.includes('ERR') ||
        line.includes('[ERROR]')) {
      errors.push({
        file: path.basename(logFile),
        line: line
      });
    }
  }
  
  return errors;
}

// Classify an error into categories
function classifyError(errorLine) {
  const categories = [];
  const lowerCaseLine = errorLine.toLowerCase();
  
  for (const [category, keywords] of Object.entries(ERROR_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lowerCaseLine.includes(keyword.toLowerCase())) {
        categories.push(category);
        break;
      }
    }
  }
  
  return categories.length > 0 ? categories : ['UNKNOWN'];
}

// Count occurrences of errors by category
function countErrorsByCategory(errors) {
  const counts = {};
  
  for (const error of errors) {
    const categories = classifyError(error.line);
    
    for (const category of categories) {
      if (!counts[category]) counts[category] = 0;
      counts[category]++;
    }
  }
  
  return counts;
}

// Get the most common errors
function getMostCommonErrors(errors, limit = 10) {
  const errorCounts = {};
  
  for (const error of errors) {
    // Create a simplified version of the error message by removing timestamps, etc.
    const simplifiedError = error.line
      .replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/g, '') // Remove ISO timestamps
      .replace(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/g, '')        // Remove other timestamps
      .replace(/\[\w+\]/g, '')                                        // Remove [INFO], [ERROR], etc.
      .replace(/\s+/g, ' ')                                           // Normalize whitespace
      .trim();
    
    if (!errorCounts[simplifiedError]) errorCounts[simplifiedError] = 0;
    errorCounts[simplifiedError]++;
  }
  
  // Sort by count and take top 'limit'
  return Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// Generate suggestions for common errors
function generateSuggestions(categories) {
  const suggestions = [];
  
  if (categories.NETWORK) {
    suggestions.push('- Check network connectivity and firewall settings');
    suggestions.push('- Verify stream URLs are still valid and accessible');
    suggestions.push('- Consider increasing network timeouts in settings');
  }
  
  if (categories.CODEC) {
    suggestions.push('- Ensure FFMPEG is properly installed with all codecs');
    suggestions.push('- Check if streams require specific codecs not available');
    suggestions.push('- Update media libraries to latest versions');
  }
  
  if (categories.PERMISSION) {
    suggestions.push('- Check file permissions for data directory');
    suggestions.push('- Run application with appropriate permissions');
    suggestions.push('- Verify folder access rights for recordings');
  }
  
  if (categories.PLAYLIST) {
    suggestions.push('- Validate playlist format and structure');
    suggestions.push('- Check for special characters or encoding issues in playlists');
    suggestions.push('- Verify playlist sources are still available');
  }
  
  if (categories.SYSTEM) {
    suggestions.push('- Check available disk space and memory');
    suggestions.push('- Monitor system resource usage during playback');
    suggestions.push('- Consider reducing buffer size if memory is limited');
  }
  
  if (categories.UI) {
    suggestions.push('- Check Electron and renderer compatibility');
    suggestions.push('- Verify UI dependencies are correctly installed');
    suggestions.push('- Update to latest Electron version');
  }
  
  if (categories.FFMPEG) {
    suggestions.push('- Verify FFMPEG installation path is correct');
    suggestions.push('- Test FFMPEG command-line functionality');
    suggestions.push('- Check FFMPEG version compatibility');
  }
  
  if (categories.CONFIG) {
    suggestions.push('- Reset settings to default and reconfigure');
    suggestions.push('- Check for malformed JSON in settings files');
    suggestions.push('- Verify configuration paths are correct for platform');
  }
  
  if (categories.UNKNOWN) {
    suggestions.push('- Review application logs for more context');
    suggestions.push('- Check application version and update if necessary');
    suggestions.push('- Verify all dependencies are correctly installed');
  }
  
  return suggestions;
}

// Main function
async function main() {
  log('Starting error analysis');
  writeReportSection('IPTV Player Error Analysis Report', `Generated: ${new Date().toISOString()}`);
  
  try {
    // Find all log files
    const logFiles = findLogFiles(LOG_DIR);
    log(`Found ${logFiles.length} log files to analyze`);
    
    // Extract errors from all logs
    let allErrors = [];
    for (const logFile of logFiles) {
      const errors = await extractErrors(logFile);
      log(`Found ${errors.length} errors in ${path.basename(logFile)}`);
      allErrors = allErrors.concat(errors);
    }
    
    log(`Total errors found: ${allErrors.length}`);
    
    // Analyze errors by category
    const categoryCounts = countErrorsByCategory(allErrors);
    
    // Generate category report
    let categoryReport = 'Error breakdown by category:\n\n';
    for (const [category, count] of Object.entries(categoryCounts)) {
      categoryReport += `${category}: ${count} occurrences (${Math.round(count / allErrors.length * 100)}%)\n`;
    }
    writeReportSection('Error Categories', categoryReport);
    
    // Get most common errors
    const commonErrors = getMostCommonErrors(allErrors);
    
    // Generate common errors report
    let commonErrorsReport = 'Most common errors:\n\n';
    commonErrors.forEach(([error, count], index) => {
      commonErrorsReport += `${index + 1}. Occurred ${count} times:\n   "${error}"\n\n`;
    });
    writeReportSection('Common Errors', commonErrorsReport);
    
    // Generate suggestions
    const suggestions = generateSuggestions(categoryCounts);
    writeReportSection('Recommendations', suggestions.join('\n'));
    
    log('Error analysis completed successfully');
    log(`Full report written to: ${ERROR_ANALYSIS_LOG}`);
  } catch (error) {
    log(`Error during analysis: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run the main function
main();
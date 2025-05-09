/**
 * IPTV Player Performance Monitor
 * 
 * This tool monitors system and application performance metrics during
 * IPTV Player usage, tracking CPU, memory, network usage, and playback statistics.
 * It generates reports to help identify performance bottlenecks and optimization opportunities.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { createInterface } = require('readline');
const platform = require('../src/platform');

// Define paths
const PERF_LOGS_DIR = path.join(__dirname, 'performance-logs');
const LOG_FILE = path.join(PERF_LOGS_DIR, `performance-${new Date().toISOString().replace(/:/g, '-')}.log`);

// Ensure performance logs directory exists
if (!fs.existsSync(PERF_LOGS_DIR)) {
  fs.mkdirSync(PERF_LOGS_DIR, { recursive: true });
}

// Performance metrics to collect
const metrics = {
  cpu: {
    total: 0,
    cores: []
  },
  memory: {
    total: 0,
    free: 0,
    used: 0,
    usedPercentage: 0
  },
  network: {
    bytesIn: 0,
    bytesOut: 0,
    connections: 0
  },
  playback: {
    bufferingEvents: 0,
    bufferingTime: 0,
    quality: 'Unknown',
    droppedFrames: 0,
    currentStream: ''
  },
  system: {
    platform: os.platform(),
    release: os.release(),
    uptime: 0,
    loadAvg: []
  }
};

let isRunning = false;
let samplingInterval = 1000; // 1 second by default
let dataPoints = [];
let startTime = null;
let playerProcessPid = null;

/**
 * Log function
 * @param {string} message - Message to log
 * @param {string} level - Log level (INFO, WARNING, ERROR)
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, formattedMessage);
  
  // Also output to console
  console.log(`[${level}] ${message}`);
}

/**
 * Generate ASCII chart from data points
 * @param {Array} data - Array of numeric values
 * @param {number} width - Chart width
 * @param {number} height - Chart height
 * @returns {string} - ASCII chart string
 */
function generateAsciiChart(data, width = 60, height = 10) {
  if (data.length === 0) return 'No data';
  
  // Find min and max values
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  // Scale data to fit in height
  const scaledData = data.map(val => Math.floor(((val - min) / range) * (height - 1)));
  
  // Generate chart
  let chart = '';
  
  // Add y-axis labels
  chart += `${max.toFixed(1)} ┐\n`;
  
  // Generate chart rows
  for (let y = height - 1; y >= 0; y--) {
    chart += y === 0 ? `${min.toFixed(1)} └` : '      │';
    
    // Add data points
    for (let x = 0; x < data.length && x < width; x++) {
      const dataIndex = Math.floor((x / width) * data.length);
      chart += scaledData[dataIndex] === y ? '█' : ' ';
    }
    
    chart += '\n';
  }
  
  // Add x-axis
  chart += '      ';
  for (let i = 0; i < width; i++) {
    chart += '─';
  }
  chart += '\n      ';
  chart += `0${' '.repeat(width - 2)}${data.length}s`;
  
  return chart;
}

/**
 * Collect system metrics
 */
function collectSystemMetrics() {
  try {
    // CPU usage
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    
    // Get total CPU usage (platform-specific)
    let totalCpuUsage = 0;
    if (platform.isWindows) {
      const output = execSync('wmic cpu get LoadPercentage').toString();
      const matches = output.match(/\d+/);
      totalCpuUsage = matches ? parseInt(matches[0], 10) : 0;
    } else {
      // Use average of all cores for Unix systems
      totalCpuUsage = os.loadavg()[0] * 100 / cpuCount;
    }
    
    metrics.cpu.total = totalCpuUsage;
    metrics.cpu.cores = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
      const idle = cpu.times.idle;
      return 100 - (idle / total * 100);
    });
    
    // Memory usage
    metrics.memory.total = os.totalmem();
    metrics.memory.free = os.freemem();
    metrics.memory.used = metrics.memory.total - metrics.memory.free;
    metrics.memory.usedPercentage = (metrics.memory.used / metrics.memory.total) * 100;
    
    // System info
    metrics.system.uptime = os.uptime();
    metrics.system.loadAvg = os.loadavg();
    
    // Network connections (simplified)
    if (platform.isWindows) {
      const output = execSync('netstat -an | find "ESTABLISHED" /c').toString();
      metrics.network.connections = parseInt(output.trim(), 10);
    } else {
      const output = execSync('netstat -an | grep ESTABLISHED | wc -l').toString();
      metrics.network.connections = parseInt(output.trim(), 10);
    }
    
    // Collect player-specific metrics if we have a player process
    if (playerProcessPid) {
      collectPlayerMetrics();
    }
    
    return metrics;
  } catch (error) {
    log(`Error collecting system metrics: ${error.message}`, 'ERROR');
    return metrics;
  }
}

/**
 * Collect player-specific metrics
 */
function collectPlayerMetrics() {
  try {
    // This would require integration with the player process to get these metrics
    // For now, we'll simulate some data for testing purposes
    metrics.playback.bufferingEvents = Math.floor(Math.random() * 5);
    metrics.playback.quality = ['480p', '720p', '1080p'][Math.floor(Math.random() * 3)];
    metrics.playback.droppedFrames = Math.floor(Math.random() * 10);
  } catch (error) {
    log(`Error collecting player metrics: ${error.message}`, 'ERROR');
  }
}

/**
 * Start monitoring performance
 * @param {number} duration - Duration in seconds (0 for indefinite)
 * @param {number} interval - Sampling interval in milliseconds
 * @param {number} pid - Process ID of the player (optional)
 */
function startMonitoring(duration = 0, interval = 1000, pid = null) {
  if (isRunning) {
    log('Monitoring is already running', 'WARNING');
    return;
  }
  
  // Initialize
  isRunning = true;
  samplingInterval = interval;
  startTime = Date.now();
  playerProcessPid = pid;
  dataPoints = [];
  
  log(`Starting performance monitoring${duration > 0 ? ` for ${duration} seconds` : ''} with interval ${interval}ms`);
  
  // Create a monitoring interval
  const monitoringInterval = setInterval(() => {
    const currentMetrics = collectSystemMetrics();
    dataPoints.push({
      timestamp: Date.now(),
      metrics: JSON.parse(JSON.stringify(currentMetrics)) // Deep clone
    });
    
    // Log key metrics for visualization
    log(`CPU: ${currentMetrics.cpu.total.toFixed(1)}% | Memory: ${(currentMetrics.memory.used / 1024 / 1024).toFixed(0)}MB (${currentMetrics.memory.usedPercentage.toFixed(1)}%) | Connections: ${currentMetrics.network.connections}`);
    
    // Stop if duration is reached
    if (duration > 0 && (Date.now() - startTime) / 1000 >= duration) {
      clearInterval(monitoringInterval);
      stopMonitoring();
    }
  }, samplingInterval);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(monitoringInterval);
    stopMonitoring();
    process.exit(0);
  });
}

/**
 * Stop monitoring and generate report
 */
function stopMonitoring() {
  if (!isRunning) {
    log('Monitoring is not running', 'WARNING');
    return;
  }
  
  isRunning = false;
  const duration = (Date.now() - startTime) / 1000;
  
  log(`Performance monitoring stopped after ${duration.toFixed(1)} seconds`);
  
  // Generate report
  generateReport();
}

/**
 * Generate performance report
 */
function generateReport() {
  if (dataPoints.length === 0) {
    log('No data points collected', 'WARNING');
    return;
  }
  
  log('Generating performance report...');
  
  try {
    // Calculate averages and peaks
    const cpuValues = dataPoints.map(dp => dp.metrics.cpu.total);
    const memValues = dataPoints.map(dp => dp.metrics.memory.usedPercentage);
    
    const avgCpu = cpuValues.reduce((acc, val) => acc + val, 0) / cpuValues.length;
    const maxCpu = Math.max(...cpuValues);
    const avgMem = memValues.reduce((acc, val) => acc + val, 0) / memValues.length;
    const maxMem = Math.max(...memValues);
    
    // Generate report
    let report = '\n';
    report += '='.repeat(80) + '\n';
    report += `IPTV PLAYER PERFORMANCE REPORT - ${new Date().toISOString()}\n`;
    report += '='.repeat(80) + '\n\n';
    
    report += `Duration: ${((dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp) / 1000).toFixed(1)} seconds\n`;
    report += `Samples: ${dataPoints.length}\n\n`;
    
    report += 'SYSTEM INFORMATION\n';
    report += '-'.repeat(80) + '\n';
    report += `Platform: ${metrics.system.platform} ${metrics.system.release}\n`;
    report += `CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)\n`;
    report += `Memory: ${(metrics.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB\n\n`;
    
    report += 'PERFORMANCE SUMMARY\n';
    report += '-'.repeat(80) + '\n';
    report += `CPU Usage:     Avg: ${avgCpu.toFixed(1)}%  Max: ${maxCpu.toFixed(1)}%\n`;
    report += `Memory Usage:  Avg: ${avgMem.toFixed(1)}%  Max: ${maxMem.toFixed(1)}%\n`;
    report += `Network:       Max Connections: ${Math.max(...dataPoints.map(dp => dp.metrics.network.connections))}\n\n`;
    
    if (playerProcessPid) {
      const bufferingEvents = dataPoints.reduce((acc, dp) => acc + dp.metrics.playback.bufferingEvents, 0);
      const droppedFrames = dataPoints.reduce((acc, dp) => acc + dp.metrics.playback.droppedFrames, 0);
      
      report += 'PLAYBACK STATISTICS\n';
      report += '-'.repeat(80) + '\n';
      report += `Buffering Events: ${bufferingEvents}\n`;
      report += `Dropped Frames:   ${droppedFrames}\n`;
      report += `Quality:          ${dataPoints[dataPoints.length - 1].metrics.playback.quality}\n\n`;
    }
    
    report += 'CPU USAGE CHART\n';
    report += '-'.repeat(80) + '\n';
    report += generateAsciiChart(cpuValues) + '\n\n';
    
    report += 'MEMORY USAGE CHART\n';
    report += '-'.repeat(80) + '\n';
    report += generateAsciiChart(memValues) + '\n\n';
    
    // Write report to log file
    fs.appendFileSync(LOG_FILE, report);
    
    // Show summary to console
    console.log(report);
    
    log(`Performance report generated: ${LOG_FILE}`);
  } catch (error) {
    log(`Error generating report: ${error.message}`, 'ERROR');
  }
}

// If this script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let duration = 30; // Default 30 seconds
  let interval = 1000; // Default 1 second
  let pid = null;
  
  // Parse command line arguments
  args.forEach((arg, index) => {
    if (arg === '--duration' && args[index + 1]) {
      duration = parseInt(args[index + 1], 10);
    } else if (arg === '--interval' && args[index + 1]) {
      interval = parseInt(args[index + 1], 10);
    } else if (arg === '--pid' && args[index + 1]) {
      pid = parseInt(args[index + 1], 10);
    }
  });
  
  startMonitoring(duration, interval, pid);
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  generateReport
};
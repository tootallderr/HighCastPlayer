/**
 * IPTV Player System Diagnostic Tool
 * 
 * This tool performs a comprehensive diagnostic check of the entire IPTV Player system,
 * examining both frontend and backend components for issues.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { app } = require('electron');

// Try to import modules, handle failures gracefully for standalone execution
let pathManager, config;
try {
    pathManager = require('../src/path-manager');
} catch (error) {
    console.warn('Could not load path-manager, using fallback paths');
}

// Define paths
function getAppDataPath() {
    try {
        if (app) {
            return app.getPath('userData');
        }
    } catch (error) {
        // If running outside Electron context
    }
    
    // Fallback to standard paths
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA, 'iptv-player');
    } else if (process.platform === 'darwin') {
        return path.join(process.env.HOME, 'Library', 'Application Support', 'iptv-player');
    } else {
        return path.join(process.env.HOME, '.iptv-player');
    }
}

// Path definitions
const APP_ROOT = path.join(__dirname, '..');
const USER_DATA = getAppDataPath();
const LOGS_DIR = pathManager ? pathManager.getLogsDir() : path.join(USER_DATA, 'logs');
const DATA_DIR = pathManager ? pathManager.getDataDir() : path.join(USER_DATA, 'data');

// Output file
const DIAGNOSTIC_REPORT = path.join(USER_DATA, 'diagnostic-report.md');

// Main diagnostics function
async function runDiagnostics() {
    const startTime = new Date();
    console.log('Starting IPTV Player System Diagnostics...');
    
    let report = `# IPTV Player System Diagnostic Report\n\n`;
    report += `Generated: ${startTime.toISOString()}\n\n`;
    
    // System information
    report += `## System Information\n\n`;
    report += `- OS: ${process.platform} ${process.arch}\n`;
    report += `- Node.js: ${process.version}\n`;
    report += `- User data path: ${USER_DATA}\n`;
    
    try {
        // Collect system info
        if (process.platform === 'win32') {
            const windowsVersion = execSync('ver', { encoding: 'utf8' }).trim();
            report += `- Windows version: ${windowsVersion}\n`;
        } else {
            const unixVersion = execSync('uname -a', { encoding: 'utf8' }).trim();
            report += `- System version: ${unixVersion}\n`;
        }
    } catch (error) {
        report += `- Error collecting system version: ${error.message}\n`;
    }
    
    // Check dependencies
    report += `\n## Dependency Check\n\n`;
    
    // Check for FFmpeg
    try {
        const ffmpegOutput = execSync('ffmpeg -version', { encoding: 'utf8' });
        const ffmpegVersion = ffmpegOutput.split('\n')[0];
        report += `- ✅ FFmpeg: ${ffmpegVersion}\n`;
    } catch (error) {
        report += `- ❌ FFmpeg: Not found or not working. Error: ${error.message}\n`;
    }
    
    // Check for Python
    try {
        let pythonVersion;
        try {
            pythonVersion = execSync('python3 --version', { encoding: 'utf8' }).trim();
        } catch (e) {
            pythonVersion = execSync('python --version', { encoding: 'utf8' }).trim();
        }
        report += `- ✅ Python: ${pythonVersion}\n`;
    } catch (error) {
        report += `- ⚠️ Python: Not found (optional). Error: ${error.message}\n`;
    }
    
    // Check for .NET (if applicable)
    try {
        const dotnetVersion = execSync('dotnet --version', { encoding: 'utf8' }).trim();
        report += `- ✅ .NET Runtime: ${dotnetVersion}\n`;
    } catch (error) {
        report += `- ⚠️ .NET Runtime: Not found (optional). Error: ${error.message}\n`;
    }
    
    // File structure checks
    report += `\n## File Structure Check\n\n`;
    
    // Critical directories
    const criticalDirs = [
        { path: USER_DATA, name: 'User Data Directory' },
        { path: LOGS_DIR, name: 'Logs Directory' },
        { path: DATA_DIR, name: 'Data Directory' },
        { path: path.join(DATA_DIR, 'playlists'), name: 'Playlists Directory' },
        { path: path.join(DATA_DIR, 'recordings'), name: 'Recordings Directory' }
    ];
    
    for (const dir of criticalDirs) {
        if (fs.existsSync(dir.path)) {
            report += `- ✅ ${dir.name}: Exists at ${dir.path}\n`;
            
            // Check write permissions
            try {
                const testFile = path.join(dir.path, '.diagnostic-test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                report += `  - ✅ Write permissions: OK\n`;
            } catch (error) {
                report += `  - ❌ Write permissions: FAILED - ${error.message}\n`;
            }
        } else {
            report += `- ❌ ${dir.name}: MISSING - ${dir.path}\n`;
        }
    }
    
    // Critical files
    const criticalFiles = [
        { path: path.join(DATA_DIR, 'settings.json'), name: 'Settings File' },
        { path: path.join(DATA_DIR, 'sources.json'), name: 'Playlist Sources File' },
        { path: path.join(DATA_DIR, 'merged-playlist.m3u8'), name: 'Merged Playlist File' }
    ];
    
    for (const file of criticalFiles) {
        if (fs.existsSync(file.path)) {
            report += `- ✅ ${file.name}: Exists\n`;
            
            // Check if valid JSON for JSON files
            if (file.path.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(file.path, 'utf8');
                    JSON.parse(content);
                    report += `  - ✅ Valid JSON format\n`;
                } catch (error) {
                    report += `  - ❌ INVALID JSON format: ${error.message}\n`;
                }
            }
            
            // Check if valid M3U8 for playlist files
            if (file.path.endsWith('.m3u8')) {
                try {
                    const content = fs.readFileSync(file.path, 'utf8');
                    if (!content.includes('#EXTM3U')) {
                        report += `  - ⚠️ Warning: May not be a valid M3U8 file (missing #EXTM3U header)\n`;
                    } else {
                        const channelCount = (content.match(/#EXTINF/g) || []).length;
                        report += `  - ✅ Valid M3U8 format with ${channelCount} channels\n`;
                    }
                } catch (error) {
                    report += `  - ❌ Error reading playlist: ${error.message}\n`;
                }
            }
        } else {
            report += `- ❌ ${file.name}: MISSING\n`;
        }
    }
    
    // Log file analysis
    report += `\n## Log Analysis\n\n`;
    
    // Check both test logs and app logs
    const logDirectories = [
        { path: LOGS_DIR, name: 'Application Logs' },
        { path: path.join(APP_ROOT, 'tests'), name: 'Test Logs' }
    ];
    
    for (const logDir of logDirectories) {
        if (fs.existsSync(logDir.path)) {
            report += `### ${logDir.name}\n\n`;
            
            try {
                const logFiles = fs.readdirSync(logDir.path).filter(file => file.endsWith('.log'));
                report += `Found ${logFiles.length} log files:\n\n`;
                
                for (const logFile of logFiles) {
                    const logPath = path.join(logDir.path, logFile);
                    const logStats = fs.statSync(logPath);
                    const fileSizeKB = (logStats.size / 1024).toFixed(2);
                    
                    report += `#### ${logFile} (${fileSizeKB} KB)\n\n`;
                    
                    try {
                        const content = fs.readFileSync(logPath, 'utf8');
                        const lines = content.split('\n');
                        
                        // Error analysis
                        const errorLines = lines.filter(line => 
                            line.toLowerCase().includes('error') || 
                            line.toLowerCase().includes('exception') ||
                            line.toLowerCase().includes('failed')
                        );
                        
                        if (errorLines.length > 0) {
                            report += `- ⚠️ Contains ${errorLines.length} errors/exceptions\n`;
                            
                            // Show the most recent errors (up to 5)
                            report += `- Recent errors:\n`;
                            
                            const recentErrors = errorLines.slice(-5);
                            recentErrors.forEach(line => {
                                report += `  - \`${line.trim()}\`\n`;
                            });
                            
                            // Error categorization
                            const pathErrors = errorLines.filter(line => 
                                line.includes('ENOENT') || 
                                line.includes('not found') || 
                                line.includes('path')
                            ).length;
                            
                            const networkErrors = errorLines.filter(line => 
                                line.includes('network') || 
                                line.includes('connection') || 
                                line.includes('http')
                            ).length;
                            
                            report += `- Error categories:\n`;
                            report += `  - Path/File errors: ${pathErrors}\n`;
                            report += `  - Network errors: ${networkErrors}\n`;
                            report += `  - Other errors: ${errorLines.length - pathErrors - networkErrors}\n`;
                        } else {
                            report += `- ✅ No errors found\n`;
                        }
                        
                        // Last activity timestamp
                        if (lines.length > 0) {
                            // Look for timestamp patterns in the last few lines
                            const timestampPattern = /\[(.*?)\]/;
                            let lastTimestamp = "Unknown";
                            
                            for (let i = lines.length - 1; i >= 0; i--) {
                                const match = lines[i].match(timestampPattern);
                                if (match && match[1]) {
                                    lastTimestamp = match[1];
                                    break;
                                }
                            }
                            
                            report += `- Last activity: ${lastTimestamp}\n`;
                        }
                        
                    } catch (error) {
                        report += `- ❌ Error reading log: ${error.message}\n`;
                    }
                    
                    report += '\n';
                }
            } catch (error) {
                report += `❌ Error accessing log directory: ${error.message}\n\n`;
            }
        } else {
            report += `### ${logDir.name}\n\n`;
            report += `❌ Directory does not exist: ${logDir.path}\n\n`;
        }
    }
    
    // Module integrity checks
    report += `\n## Module Integrity Check\n\n`;
    
    const criticalModules = [
        { name: 'path-manager.js', path: path.join(APP_ROOT, 'src', 'path-manager.js') },
        { name: 'player-engine.js', path: path.join(APP_ROOT, 'src', 'player-engine.js') },
        { name: 'playlist-manager.js', path: path.join(APP_ROOT, 'src', 'playlist-manager.js') },
        { name: 'index.js', path: path.join(APP_ROOT, 'src', 'index.js') },
        { name: 'preload.js', path: path.join(APP_ROOT, 'src', 'preload.js') }
    ];
    
    for (const module of criticalModules) {
        if (fs.existsSync(module.path)) {
            report += `- ✅ ${module.name}: Found\n`;
            
            // Check for potential issues in file
            try {
                const content = fs.readFileSync(module.path, 'utf8');
                
                // Check for console.error calls as potential issues
                const errorCalls = (content.match(/console\.error/g) || []).length;
                if (errorCalls > 0) {
                    report += `  - ⚠️ Contains ${errorCalls} console.error calls\n`;
                }
                
                // Check for TODO or FIXME comments
                const todos = (content.match(/TODO|FIXME/g) || []).length;
                if (todos > 0) {
                    report += `  - ⚠️ Contains ${todos} TODO/FIXME comments\n`;
                }
                
                // Look for key functions that might be missing
                if (module.name === 'path-manager.js') {
                    if (!content.includes('getDataDir')) {
                        report += `  - ❌ Missing critical function: getDataDir\n`;
                    }
                    if (!content.includes('getLogsDir')) {
                        report += `  - ❌ Missing critical function: getLogsDir\n`;
                    }
                } else if (module.name === 'player-engine.js') {
                    if (!content.includes('currentStreamInfo')) {
                        report += `  - ⚠️ Warning: Missing variable definition: currentStreamInfo\n`;
                    }
                    if (!content.includes('getPlaybackInfo')) {
                        report += `  - ❌ Missing critical function: getPlaybackInfo\n`;
                    }
                }
            } catch (error) {
                report += `  - ❌ Error reading file: ${error.message}\n`;
            }
        } else {
            report += `- ❌ ${module.name}: MISSING\n`;
        }
    }
    
    // UI integrity check
    report += `\n## UI Integrity Check\n\n`;
    
    const uiFiles = [
        { name: 'index.html', path: path.join(APP_ROOT, 'ui', 'index.html') },
        { name: 'settings.html', path: path.join(APP_ROOT, 'ui', 'settings.html') },
        { name: 'splash.html', path: path.join(APP_ROOT, 'ui', 'splash.html') }
    ];
    
    for (const file of uiFiles) {
        if (fs.existsSync(file.path)) {
            report += `- ✅ ${file.name}: Found\n`;
            
            // Check for required elements in HTML files
            try {
                const content = fs.readFileSync(file.path, 'utf8');
                
                // Check for proper HTML structure
                if (!content.includes('<!DOCTYPE html>')) {
                    report += `  - ⚠️ Warning: Missing DOCTYPE declaration\n`;
                }
                
                // Check for API references
                const apiCalls = (content.match(/window\.api\./g) || []).length;
                report += `  - Contains ${apiCalls} references to window.api\n`;
                
                // Check for script loading
                if (file.name === 'index.html') {
                    if (!content.includes('preload.js')) {
                        report += `  - ⚠️ Warning: No reference to preload.js\n`;
                    }
                }
            } catch (error) {
                report += `  - ❌ Error reading file: ${error.message}\n`;
            }
        } else {
            report += `- ❌ ${file.name}: MISSING\n`;
        }
    }
    
    // Package checks
    report += `\n## Package.json Check\n\n`;
    
    const packagePath = path.join(APP_ROOT, 'package.json');
    if (fs.existsSync(packagePath)) {
        report += `- ✅ package.json: Found\n`;
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Check for required dependencies
            const deps = {...packageJson.dependencies, ...packageJson.devDependencies};
            const requiredDeps = ['electron', 'fluent-ffmpeg', 'electron-log'];
            
            for (const dep of requiredDeps) {
                if (deps[dep]) {
                    report += `  - ✅ ${dep}: ${deps[dep]}\n`;
                } else {
                    report += `  - ❌ Missing dependency: ${dep}\n`;
                }
            }
            
            // Check for start script
            if (packageJson.scripts && packageJson.scripts.start) {
                report += `  - ✅ start script: ${packageJson.scripts.start}\n`;
            } else {
                report += `  - ❌ Missing start script\n`;
            }
            
        } catch (error) {
            report += `  - ❌ Error parsing package.json: ${error.message}\n`;
        }
    } else {
        report += `- ❌ package.json: MISSING\n`;
    }
    
    // Final recommendations
    report += `\n## Recommended Actions\n\n`;
    
    // We'll add recommendations based on findings above
    const recommendations = [];
    
    // Finish report
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    report += `\n\n---\n\nDiagnostic completed in ${duration.toFixed(2)} seconds at ${endTime.toISOString()}\n`;
    
    // Write report to file
    fs.writeFileSync(DIAGNOSTIC_REPORT, report);
    console.log(`Diagnostics completed. Report saved to ${DIAGNOSTIC_REPORT}`);
    console.log(`Open ${DIAGNOSTIC_REPORT} to view the detailed results.`);
    
    return report;
}

// Run diagnostics if executed directly
if (require.main === module) {
    runDiagnostics().catch(error => {
        console.error('Error running diagnostics:', error);
    });
}

module.exports = { runDiagnostics };

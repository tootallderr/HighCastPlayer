# IPTV Player - Testing & Diagnostics

This directory contains test scripts and diagnostic tools for the IPTV Player application. These tools help verify functionality, diagnose issues, and ensure cross-platform compatibility.

## Running Tests

### Quick Start

To run all tests at once, use:

```bash
# On Windows
node tests/run-diagnostics.js --all

# On macOS/Linux
node tests/run-diagnostics.js --all
```

### Individual Tests

Each test can be run individually to focus on specific functionality:

```bash
# Test player engine
node tests/test-player-engine.js

# Test playlist manager
node tests/test-playlist-manager.js

# Test DVR features
node tests/test-dvr-features.js

# Test recording scheduler
node tests/test-recording-scheduler.js

# Test settings functionality
node tests/test-settings.js

# Test UI enhancements
node tests/test-ui-enhancements.js

# Verify cross-platform functionality
node tests/check-cross-platform.js

# Generate sample channels playlist
node tests/generate-sample-channels.js
```

### Diagnostic Tools

The following diagnostic tools are available for troubleshooting:

```bash
# Analyze application errors
node tests/analyze-errors.js

# Monitor application performance
node tests/monitor-performance.js

# Test crash handling
node tests/crash-handler.js
```

## Log Files

Test results and application logs are stored in the following files:

- `player.log` - Player engine operations
- `player_test.log` - Player engine test results
- `playlist_update.log` - Playlist update operations
- `playlist_test.log` - Playlist functionality tests
- `settings.log` - Settings changes
- `sources.log` - Playlist source management
- `settings_test.log` - Settings functionality tests
- `verification.log` - Cross-platform verification tests
- `sample_channels.log` - Sample channels generation log
- `diagnostic_run.log` - Comprehensive diagnostic run results
- `error_analysis.log` - Error analysis results
- `performance-logs/` - Performance monitoring logs

## Sample Channels

The application includes a set of sample channels for testing:

- Valid channels for testing normal playback
- Invalid channels for testing error handling
- Slow-loading channels for testing timeouts
- Channels with various stream formats

To generate or update the sample channels playlist:

```bash
node tests/generate-sample-channels.js
```

## Cross-Platform Testing

To verify functionality across platforms:

1. Run the verification script:
   ```bash
   node tests/verification.js
   ```

2. Check the output in `verification.log`

3. For comprehensive testing, run tests on each supported platform:
   - Windows
   - macOS
   - Linux

## Interpreting Test Results

Each test script outputs results in a structured format:
- ✅ PASSED - Test passed successfully
- ❌ FAILED - Test failed (with details)
- ⚠️ WARNING - Test passed with warnings

For detailed analysis of errors:
```bash
node tests/analyze-errors.js
```

## Adding New Tests

When adding new functionality to the application:

1. Create a new test file in the `tests/` directory
2. Follow the existing pattern with appropriate logging
3. Add the test to `run-diagnostics.js`
4. Document the test in this README
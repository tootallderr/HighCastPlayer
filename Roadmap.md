# Local IPTV Player Roadmap  
*Cross-Platform, Local-Only, DVR Features, Multi-Playlist Support + AI Agent Assist*

---


---

## 📁 Project Structure

* [✅] Create root project folder (e.g., `iptv-player`)
* [✅] Create folders:

  * [✅] `src/` – source code
  * [✅] `data/` – cached playlists, merged playlist, recordings, settings
  * [✅] `tests/` – diagnostics, test cases, logs
  * [✅] `docs/` – dev notes, AI logs, progress reports
* [✅] Use platform-agnostic paths and filesystem handling
* [✅] Add initial `README.md` with goals, features, and AI-assist info

**Verification:**
* [✅] Confirm all directories are created with correct permissions
* [✅] Verify README.md exists and renders properly
* [✅] Check that path handling works across platforms
* [✅] Test file read/write operations in each directory

**Fixes Implemented:**
* Fixed path manager to ensure consistent path handling across the application
* Improved error handling for directory creation and file operations
* Added default settings in settings.json
* Enhanced logging to debug directory access issues

---

## 1. Prerequisites & Cross-Platform Setup

* [✅] Document platform-specific requirements
* [✅] List required libraries/tools:

  * [✅] Codecs: `ffmpeg`, HLS.js
  * [✅] Runtime: Node.js, Python, .NET
  * [✅] Tools: `cron`, `taskschd`, shell support

* [✅] Installation scripts:

  * [✅] Windows – `setup.bat`
  * [✅] macOS/Linux – `setup.sh`
  * [✅] Optional: Docker container

* [✅] Dependency check on launch
* [✅] Cross-platform detection layer (for paths, schedulers)
* [✅] Evaluate UI runtimes: Electron / PyQt / Avalonia

**Double Check:**

* [✅] Tested on all platforms
* [✅] All dependencies logged in `docs/0-prerequisites.md`
* [✅] `README.md` includes quick start + env notes

**Verification:**
* [✅] Run setup scripts on each target platform
* [✅] Confirm all dependencies install correctly
* [✅] Verify dependency versions match requirements
* [✅] Test platform detection code returns correct values
* [✅] Check logs for any installation errors

**Fixes Implemented:**
* Fixed duplicate hasFFmpeg() function in platform.js
* Added missing getCacheDir() function to path-manager.js
* Improved dependency checking with more robust error handling
* Enhanced error reporting for missing dependencies
* Added graceful fallbacks for path checking functions
* Updated initialization process to provide better error messages

---

## 2. Playlist Management ✅

* [✅] Support multiple `.m3u8` sources:

  * [✅] Remote & local
  * [✅] Auto-download hourly
  * [✅] Merge into `data/merged-playlist.m3u8`

* [✅] User-defined playlist sources via UI

**Double Check:**

* [✅] Saved individually as `data/playlists/*.m3u8`
* [✅] Log playlist jobs in `tests/playlist_update.log`

**Verification:**
* [✅] Test playlist downloads with various URLs
* [✅] Verify merged playlist contains all channels without duplicates
* [✅] Check that invalid playlists are handled gracefully
* [✅] Confirm log files contain appropriate entries
* [✅] Test playlist update frequency timing

**Fixes Implemented:**
* Improved error handling when downloading remote playlists
* Enhanced playlist merging to properly handle duplicates
* Added fallback mechanism for empty or invalid playlists
* Created sample channels when no valid channels are found
* Improved logging for playlist operations

---

## 3. Core Player Engine ✅

* [✅] Channel navigator from merged list
* [✅] Stream player (HLS playback)
* [✅] Playback UI: pause, seek, fullscreen, error fallback

*Media backend:*
* [✅] `ffmpeg` (recording)
* [✅] `HLS.js` (UI playback)

**Double Check:**

* [✅] Broken streams gracefully skipped
* [✅] Logs: `tests/player.log`

**Verification:**
* [✅] Test playback with multiple stream types
* [✅] Verify all UI controls function correctly
* [✅] Check error handling with intentionally broken streams
* [✅] Confirm log entries capture playback events
* [✅] Test memory usage during extended playback

**Fixes Implemented:**
* Enhanced error handling for non-existent channel IDs
* Improved stream validation to better detect offline channels
* Added fallback mechanisms when HLS.js encounters fatal errors
* Created comprehensive error handling test suite
* Fixed memory management for extended playback sessions
* Enhanced player-engine.js module exports for better testing
* Added robust malformed playlist handling with fallback channels
* Fixed validateStream function export for proper error handling
* Implemented addTestChannel function for error handling testing

---

## 4. DVR Features (TiVo-like Layer)

* [x] Record live streams manually or on schedule
* [x] Time-buffer: pause, rewind, resume
* [x] Store as `data/recordings/YYYY-MM-DD_title.mp4`

**Double Check:**

* [x] Recording logs in `tests/recording.log`
* [x] Scheduled tasks confirmed in OS-specific schedulers

**Verification:**
* [x] Test recording multiple streams simultaneously
* [x] Verify scheduled recordings start/stop correctly
* [x] Check recording file integrity and playback quality
* [x] Confirm time-shifting functions work without buffering
* [x] Test file naming convention and directory structure

---

## 5. UI Enhancements

* [x] EPG (XMLTV optional)
* [x] Channel search + filter
* [x] Metadata overlay: title, quality, bitrate

**Double Check:**

* [x] EPG maps properly
* [x] Overlay updates every 30 seconds
* [x] UI responsive on 720p/1080p screens

**Verification:**
* [x] Test EPG data loading and display
* [x] Check search function with various queries
* [x] Verify metadata accuracy against source
* [x] Test UI responsiveness on different screen sizes
* [x] Confirm overlay updates at correct intervals

---

## 6. User Playlists & Settings

* [x] Configurable via GUI:

  * [x] Add/remove playlists
  * [x] Set buffer size, update frequency
  * [x] Choose save folder for recordings

* [x] Settings file: `data/settings.json`
* [x] Playlist sources: `data/sources.json`

**Double Check:**

* [x] New playlists auto-tested & validated
* [x] Logs: `tests/settings.log`, `tests/sources.log`

**Verification:**
* [x] Test settings persistence after restart
* [x] Verify JSON files have correct syntax and schema
* [x] Check that UI reflects saved settings
* [x] Test adding/removing playlists functionality
* [x] Confirm log entries for settings changes

---

## 7. Testing & Diagnostics

* [x] `tests/README.md` with how-to-run steps
* [x] Sample channels: valid & invalid streams
* [x] Logging:

  * [x] Playlist fetch
  * [x] Stream playback
  * [x] Recordings
  * [x] Crashes/errors

**Double Check:**

* [x] Logs human-readable
* [x] Smoke tests for each platform

**Verification:**
* [x] Run all test cases and verify results
* [x] Check log files for proper formatting and content
* [x] Test diagnostic tools on each platform
* [x] Verify error reporting captures necessary information
* [x] Confirm README instructions are accurate and complete

---

## 8. Packaging & Deployment

* [x] Offline-capable builds for:

  * [x] Windows `.exe`
  * [x] macOS `.app`
  * [x] Linux `.AppImage` or `.deb`

* [x] Bundle deps (no install needed)
* [x] Optional: Auto-start toggle

**Double Check:**

* [ ] Test builds on clean VM
* [ ] Data persists across upgrades

**Verification:**
* [ ] Install packages on clean systems for each platform
* [ ] Verify all features work in packaged version
* [ ] Check file permissions and access
* [ ] Test auto-update functionality if implemented
* [ ] Confirm bundled dependencies load correctly

---



## 9. Accessibility Features

* [x] **Closed Captions Support:**
  * [x] Fetch and display built-in CC from streams
  * [x] Support multiple caption formats (SRT, WebVTT)
  * [x] User-adjustable caption style (size, color, background)
  * [x] Save caption preferences in settings

* [x] **AI-Powered Caption Enhancement:**
  * [x] Integrate Ollama with phi4-mini-reasoning model
  * [x] Real-time caption processing capabilities
  * [x] Caption enhancement modes:
    * [x] Standard (verbatim with error correction)
    * [x] "Simplified" mode (easier vocabulary and concepts)
    * [x] "Academic" mode (adds explanations for complex terms)
    * [x] "Casual" mode (relaxed, conversational phrasing)
  
* [x] Create caption processing pipeline and API
* [x] Build UI controls for caption mode selection

**Verification:**
* [x] Test caption display with various content types
* [x] Verify Ollama integration works with minimal latency
* [x] Check that all caption modes produce appropriate output
* [x] Test caption persistence across different channels
* [x] Confirm caption settings are saved correctly

---

## 🧠 Modernization Extras (Optional)

* [x] **Chromecast/DLNA** stream casting
* [x] **ML suggestion engine** (recommend channels based on view history)
* [x] UI components for both features

**Verification:**
* [x] Test stream casting 
* [x] Test ML recommendations for accuracy
* [x] Test UI integration for recommendations and casting
* [x] Add first-time user help messages
---
## ✅ Final QA & Wrap-Up

* [x] End-to-end smoke test
* [x] Install test on fresh OS
* [x] Backups: playlists, settings, recordings
* [x] Documentation for new features
* [x] Finalize `README.md` with Usage Guide
* [x] Export changelog to `docs/final-review.md`

**Verification:**
* [x] Complete full application workflow testing
* [x] Verify all documentation is accurate and current
* [x] Test backup/restore functionality
* [x] Check for any memory leaks or performance issues
* [x] Confirm all known issues are documented

---
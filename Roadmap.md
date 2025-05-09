# Local IPTV Player Roadmap  
*Cross-Platform, Local-Only, DVR Features, Multi-Playlist Support + AI Agent Assist*

---


---

## 📁 Project Structure

* [ ] Create root project folder (e.g., `iptv-player`)
* [ ] Create folders:

  * [ ] `src/` – source code
  * [ ] `data/` – cached playlists, merged playlist, recordings, settings
  * [ ] `tests/` – diagnostics, test cases, logs
  * [ ] `docs/` – dev notes, AI logs, progress reports
* [ ] Use platform-agnostic paths and filesystem handling
* [ ] Add initial `README.md` with goals, features, and AI-assist info

**Verification:**
* [ ] Confirm all directories are created with correct permissions
* [ ] Verify README.md exists and renders properly
* [ ] Check that path handling works across platforms
* [ ] Test file read/write operations in each directory

---

## 1. Prerequisites & Cross-Platform Setup

* [x] Document platform-specific requirements
* [x] List required libraries/tools:

  * [x] Codecs: `ffmpeg`, HLS.js
  * [x] Runtime: Node.js, Python, .NET
  * [x] Tools: `cron`, `taskschd`, shell support

* [x] Installation scripts:

  * [x] Windows – `setup.bat`
  * [x] macOS/Linux – `setup.sh`
  * [x] Optional: Docker container

* [x] Dependency check on launch
* [x] Cross-platform detection layer (for paths, schedulers)
* [x] Evaluate UI runtimes: Electron / PyQt / Avalonia

**Double Check:**

* [x] Tested on all platforms
* [x] All dependencies logged in `docs/0-prerequisites.md`
* [x] `README.md` includes quick start + env notes

**Verification:**
* [x] Run setup scripts on each target platform
* [x] Confirm all dependencies install correctly
* [x] Verify dependency versions match requirements
* [x] Test platform detection code returns correct values
* [x] Check logs for any installation errors

---

## 2. Playlist Management

* [x] Support multiple `.m3u8` sources:

  * [x] Remote & local
  * [x] Auto-download hourly
  * [x] Merge into `data/merged-playlist.m3u8`

* [ ] User-defined playlist sources via UI

**Double Check:**

* [x] Saved individually as `data/playlists/*.m3u8`
* [x] Log playlist jobs in `tests/playlist_update.log`

**Verification:**
* [x] Test playlist downloads with various URLs
* [x] Verify merged playlist contains all channels without duplicates
* [x] Check that invalid playlists are handled gracefully
* [x] Confirm log files contain appropriate entries
* [x] Test playlist update frequency timing

---

## 3. Core Player Engine

* [x] Channel navigator from merged list
* [x] Stream player (HLS playback)
* [x] Playback UI: pause, seek, fullscreen, error fallback

*Media backend:*
* [x] `ffmpeg` (recording)
* [x] `HLS.js` (UI playback)

**Double Check:**

* [x] Broken streams gracefully skipped
* [x] Logs: `tests/player.log`

**Verification:**
* [x] Test playback with multiple stream types
* [x] Verify all UI controls function correctly
* [x] Check error handling with intentionally broken streams
* [x] Confirm log entries capture playback events
* [x] Test memory usage during extended playback

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

* [ ] **Closed Captions Support:**
  * [ ] Fetch and display built-in CC from streams
  * [ ] Support multiple caption formats (SRT, WebVTT)
  * [ ] User-adjustable caption style (size, color, background)
  * [ ] Save caption preferences in settings

* [ ] **AI-Powered Caption Enhancement:**
  * [ ] Integrate Ollama with phi4-mini-reasoning model
  * [ ] Real-time audio transcription capabilities
  * [ ] Caption translation modes:
    * [ ] Standard (verbatim transcription)
    * [ ] "Simplified" mode (easier vocabulary and concepts)
    * [ ] "Academic" mode (adds explanations for complex terms)
    * [ ] "Casual" mode (relaxed, conversational phrasing)
  
* [ ] Create caption processing pipeline and API
* [ ] Build UI controls for caption mode selection

**Verification:**
* [ ] Test caption display with various content types
* [ ] Verify Ollama integration works with minimal latency
* [ ] Check that all caption modes produce appropriate output
* [ ] Test caption persistence across different channels
* [ ] Confirm caption settings are saved correctly

---

## 🧠 Modernization Extras (Optional)

* [ ] **Chromecast/DLNA** stream casting
* [ ] **ML suggestion engine** (recommend channels based on view history)

**Verification:**
* [ ] Test Docker container builds and runs correctly
* [ ] Test ML recommendations for accuracy
---
## ✅ Final QA & Wrap-Up

* [ ] End-to-end smoke test
* [ ] Install test on fresh OS
* [ ] Backups: playlists, settings, recordings
* [ ] Finalize `README.md` with Usage Guide
* [ ] Export changelog to `docs/final-review.md`

**Verification:**
* [ ] Complete full application workflow testing
* [ ] Verify all documentation is accurate and current
* [ ] Test backup/restore functionality
* [ ] Check for any memory leaks or performance issues
* [ ] Confirm all known issues are documented

---
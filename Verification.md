Got it! Here's a tailored version of the **Verification Checklist in Markdown**, written specifically **for an AI Agent Assistant** to follow. It includes **clear instructions**, **expectations**, and **structured responses** so the agent can process, execute, and log results effectively.

---

````markdown
# 🤖 AI Agent Verification Checklist – Local IPTV Player

**Purpose:** This checklist is designed for use by the built-in AI Agent to verify the integrity and performance of the IPTV Player system across all key modules. Please follow each step and return structured logs and outcomes.  
**Format for Responses:**  
- ✅ Success: `✅ [Section] - [Task Description]`
- ⚠️ Warning/Error: `⚠️ [Section] - [Issue Summary]`
- 🧠 Note: `🧠 [Contextual Comment or Suggestion]`

---

## 📁 Project Structure Validation

- [ ] Verify all expected directories exist: `src/`, `data/`, `tests/`, `docs/`
- [ ] Confirm correct permissions for each directory
- [ ] Test file creation and deletion in each directory
- [ ] Check `README.md` rendering and content validity
- [ ] Log platform-specific file path handling

---

## ⚙️ Cross-Platform Setup & Runtime Validation

- [ ] Validate platform detection (return platform name)
- [ ] Run dependency checks (list and versions)
- [ ] Confirm tools available: `ffmpeg`, `cron`/`taskschd`, shell access
- [ ] Validate UI runtime availability (Electron/PyQt/Avalonia)

🧠 Return structured report:
```json
{
  "platform": "Windows/macOS/Linux",
  "dependencies": {
    "ffmpeg": "found / missing",
    "node": "version",
    ...
  },
  "ui_runtime": "Electron",
  "status": "ok / issues found"
}
````

---

## 📡 Playlist Management

* [ ] Download all playlists listed in `data/sources.json`
* [ ] Save to `data/playlists/`
* [ ] Merge to `data/merged-playlist.m3u8`
* [ ] Detect and handle malformed or empty `.m3u8` files
* [ ] Log update actions to `tests/playlist_update.log`

✅ Output log summary:

```json
{
  "sources_checked": 4,
  "successful_downloads": 4,
  "invalid_sources": 0,
  "merged_channels": 214
}

---

## 📺 Player Engine Testing

* [ ] Load `merged-playlist.m3u8`
* [ ] Play 3 random streams for 30 seconds
* [ ] Test UI functions: pause, seek, fullscreen
* [ ] Simulate broken stream and check fallback
* [ ] Validate log output to `tests/player.log`

⚠️ Log playback test results per channel.

---

## ⏺ DVR Functionality

* [ ] Initiate manual recording for 60 seconds
* [ ] Schedule a recording (start after 1 min, 2 min duration)
* [ ] Test pause, rewind, and resume
* [ ] Verify `data/recordings/` has proper file structure
* [ ] Log in `tests/recording.log`

✅ Output expected:

```json
{
  "manual_record": "success",
  "scheduled_record": "success",
  "file_check": "YYYY-MM-DD_test.mp4 exists",
  "buffer_test": "pass"
}
```

---

## 🖼️ UI & Metadata Verification

* [ ] Confirm EPG loads (if `epg.xml` provided)
* [ ] Test channel search with 3 sample queries
* [ ] Check overlay data: title, bitrate, resolution
* [ ] Evaluate responsiveness at 720p and 1080p window sizes

🧠 Optional:

> Compare overlay metadata to raw stream info to verify accuracy.

---

## 🧩 Settings + Playlist UX

* [ ] Load and validate `data/settings.json` and `sources.json`
* [ ] Simulate UI actions: add/remove playlist, change buffer settings
* [ ] Confirm changes persist after restart
* [ ] Validate logs: `settings.log`, `sources.log`

✅ Report structure:

```json
{
  "settings_valid": true,
  "ui_reflects_config": true,
  "logs_updated": true
}
```

---

## 🧪 Diagnostics & Logging

* [ ] Run all built-in test cases
* [ ] Check logs for formatting and completeness
* [ ] Simulate a crash or error to verify capture
* [ ] Validate `tests/README.md` instructions are current

---

## 📦 Package Validation

* [ ] Check offline builds on each OS (via VM or container)
* [ ] Confirm persistence of data/settings after version upgrade
* [ ] Validate file permissions, execution, and auto-start toggle
* [ ] Confirm that no external install is required

🧠 If auto-update is enabled, simulate version change and check update pipeline.

---

## ♿ Captioning & AI Pipeline

* [ ] Load stream with built-in captions
* [ ] Test all caption formats: SRT, WebVTT
* [ ] Apply and test each enhancement mode via Ollama:

  * Standard
  * Simplified
  * Academic
  * Casual
* [ ] Log transformation latency and results
* [ ] Validate user preferences saved correctly

🧠 Capture before/after caption samples for verification.

---

## 🌐 Modern Features

* [ ] Cast to local DLNA/Chromecast device (if available)
* [ ] Trigger ML recommendation engine (simulate 10 viewing events)
* [ ] Check UI elements for recommendations and casting
* [ ] Display first-time user help overlays

---

## ✅ Final QA Tasks

* [ ] Run full end-to-end user flow (boot → play → record → cast → settings → exit)
* [ ] Backup and restore all user data
* [ ] Check for memory usage anomalies or leaks
* [ ] Export `docs/final-review.md`
* [ ] Verify `README.md` is complete and reflects all features

🧠 Append unresolved issues (if any) to `docs/issues.md`.

---

## ✅ AI Agent Reporting Format

```json
{
  "status": "Complete / Partial / Failed",
  "verified_sections": [...],
  "issues": [
    {
      "section": "Player Engine",
      "error": "Playback failed on stream index 2",
      "suggested_fix": "Check codec compatibility"
    }
  ],
  "next_steps": [...]
}
```

```

---


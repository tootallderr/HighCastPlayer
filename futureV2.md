---

# 📡 IPTV Player Roadmap – **V2: AI-Enhanced, Smarter, Stream-Ready**

*Smarter Accessibility, Feed Awareness, Stream-to-TV, and Enhanced Closed Captions w/ LLM Assist*

---

# 📡 IPTV Player Roadmap – **V2: AI-Enhanced, Smarter, Stream-Ready**

*Smarter Accessibility, Feed Awareness, Stream-to-TV, and Enhanced Closed Captions w/ LLM Assist*

---

## 🚀 Core Enhancements Overview (New Pillars)

* **Smart Captioning Engine** – Whisper-level, translated, simplified, and context-aware captions
* **LLM Modes** – Multiple AI “understanding” modes like "Decode I'm High", "Academic", "Simplified", "Casual"
* **Feed Intelligence** – Loop detection, live alerting, speaker identification from content
* **TV Casting & Device Streaming** – Native Chromecast, DLNA, and Smart TV mirroring
* **Ollama Integration** – Local LLM processing for captions, translation, and reasoning
* **Contextual Speaker Mapping** – Name-to-voice & phrase correlation to identify speakers

---

## 📁 V2 Project Structure (Updates)

* [ ] Add `ai/` – caption pipeline, LLM prompts, speaker analysis
* [ ] Add `streaming/` – Chromecast/DLNA interfaces, mirroring configs
* [ ] Add `captions/` – CC source ingestion, real-time output, custom styles
* [ ] Update `README.md` with V2 goals and mode examples

---

## 🎙️ Caption Intelligence & AI Dialogue Modes

**New Features:**

* [ ] Real-time whisper-level audio capture & enhancement
* [ ] Ollama-powered audio-to-text & context interpreter
* [ ] LLM modes:

  * [ ] “Decode I'm High” – relaxed, ultra-simplified explanations
  * [ ] “Academic” – definitions and deeper context for technical terms
  * [ ] “Simplified” – easy-to-understand summaries
  * [ ] “Casual” – conversational translation
* [ ] Toggle between modes via UI overlay
* [ ] Translate audio directly from stream (not just CC)
* [ ] Save LLM-processed subtitles separately

**Verification:**

* [ ] Accuracy and latency testing per mode
* [ ] Test on various audio qualities, accents, low-volume speech
* [ ] Validate subtitle preferences save/load properly

---

## 🧠 Speaker Detection & Context Mapping

* [ ] Speaker name detection from dialogue (“Hi, I’m Michael” triggers a map)
* [ ] Combine with audio fingerprinting to refine per speaker
* [ ] Build timeline of speaker participation per stream
* [ ] Optional “who’s talking?” display toggle

**Verification:**

* [ ] Run test audio clips with multiple named speakers
* [ ] Confirm system builds an accurate speaker map
* [ ] Evaluate per-speaker subtitle consistency

---

## 📺 Stream to TV: Mirroring & Device Casting

* [ ] Chromecast / Google Cast support
* [ ] DLNA integration for smart TVs
* [ ] Optional WebRTC mirroring mode (for LAN)
* [ ] Cast both video & real-time captions

**Verification:**

* [ ] Test with multiple TV brands and OSes
* [ ] Verify playback quality and sync of audio/subtitles
* [ ] Confirm device discovery is fast and reliable
* [ ] Evaluate latency on live streams

---

## 📡 Feed Activity Detection & Loop Monitoring

* [ ] Detect looping content (based on repeated frames/audio patterns)
* [ ] Alert if stream transitions from loop to live (or vice versa)
* [ ] Optional push notification or UI alert when:

  * Stream becomes live
  * Previously looped stream changes
* [ ] Audio-based content change detection (e.g., background noise shifts)

**Verification:**

* [ ] Simulate feed transitions and verify alerts trigger
* [ ] Confirm loop detection is accurate with short/long loops
* [ ] Validate system minimizes false positives (e.g., static scenes)

---

## ⚙️ AI Assistant Enhancements

* [ ] Upgrade existing agent to understand user requests like:

  * “Start decode-high captions for this channel”
  * “Record when Michael starts speaking”
* [ ] Allow prompts to modify playback and settings in real-time
* [ ] Include reasoning logs for LLM actions in `ai/logs/`

**Verification:**

* [ ] Run scripted prompts to confirm agent behavior
* [ ] Ensure agent context syncs with stream metadata
* [ ] Validate fallback when LLM is unavailable

---

## 🔧 Advanced Testing & Dev Tools

* [ ] Add audio-focused test suite (`tests/audio/`)
* [ ] Simulate whisper, echoey, and low bitrate audio
* [ ] Include synthetic dialogue clips for LLM behavior testing
* [ ] Update all logs to optionally include transcript snapshots

---

## 📦 Deployment Upgrades

* [ ] LLM and AI captioning available in offline mode via Ollama
* [ ] Ensure network fallback gracefully disables AI features
* [ ] Add settings for enabling/disabling enhanced AI features
* [ ] Package optional speech model assets in separate install bundle

---

## ✅ Final QA (V2)

* [ ] Full end-to-end test across all LLM modes
* [ ] Confirm subtitle readability at all screen sizes
* [ ] Evaluate AI captions vs. human-edited benchmarks
* [ ] Final regression test: playback, recording, overlays, speaker map

---


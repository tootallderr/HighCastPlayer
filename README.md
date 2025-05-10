# IPTV Player

A cross-platform, local-only IPTV player with DVR features, multi-playlist support, and AI agent assistance.

## 🚀 Quick Start

### Prerequisites

- FFmpeg v5.0 or later
- Node.js v16.0.0 or later
- Python v3.9 or later (for specific utilities)
- .NET Runtime v6.0 or later (for Avalonia UI)

### Installation

#### Windows
```cmd
git clone https://github.com/tootallderr/HighCastPlayer
cd iptv-player
setup.bat
```

#### macOS/Linux
```bash
git clone https://github.com/tootallderr/HighCastPlayer
cd iptv-player
chmod +x setup.sh
./setup.sh
```

#### Docker (Optional)
```bash
git clone https://github.com/tootallderr/HighCastPlayer
cd iptv-player
docker-compose up -d
```

## 🔧 Environment Notes

### Supported Platforms
- **Windows 10/11**: Full support with Task Scheduler integration
- **macOS**: Full support with cron and launchd integration
- **Linux**: Full support with cron/systemd integration (Ubuntu, Debian, Fedora, Arch)

### Storage Locations
- **Windows**: `%APPDATA%\iptv-player`
- **macOS**: `~/Library/Application Support/iptv-player`
- **Linux**: `~/.iptv-player`

### Streaming Formats
- HLS (.m3u8) primary support

### Cross-Platform Features
- **Automated dependency checking** on startup
- **Intelligent platform detection** for OS-specific features
- **Path handling abstraction** for consistent file access
- **Auto-updates** compatible with all platforms
- **Automatic scheduler integration** based on the host OS

### Troubleshooting Dependencies
If you encounter issues with missing dependencies:

1. Run the appropriate setup script for your platform:
   - Windows: `setup.bat` (Run as Administrator)
   - macOS/Linux: `./setup.sh`
   
2. Check the logs in:
   - Windows: `%APPDATA%\iptv-player\logs\dependency-check.log`
   - macOS: `~/Library/Application Support/iptv-player/logs/dependency-check.log`
   - Linux: `~/.iptv-player/logs/dependency-check.log`
   
3. For detailed information about prerequisites, see `docs/0-prerequisites.md`
- Additional formats via FFmpeg

### UI Runtimes
The application will automatically select the best available UI runtime from:
- Electron (preferred)
- Avalonia (.NET)
- PyQt

## 🌟 Key Features

- **Multi-Playlist Support**: Load and merge multiple IPTV playlists
- **DVR Features**: Record, pause, and rewind live streams
- **Scheduler**: Set up automatic recordings
- **Local-Only**: No cloud dependencies, works offline
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Modernization Features**:
  - **Chromecast/DLNA Casting**: Stream to your TV or other devices
  - **AI-Powered Recommendations**: Get channel suggestions based on viewing habits

## 📝 Getting Started

1. After installation, run the application
2. Add your IPTV playlist URLs in the Settings
3. Browse the merged channel list
4. Select channels to watch or record

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📚 Documentation

For more detailed information, check the `docs` folder:
- [Prerequisites](docs/0-prerequisites.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Deployment Guide](docs/deployment-guide.md)

## 📦 Packaging and Distribution

### Building Installers

We provide pre-built installers for Windows, macOS, and Linux. If you want to build them yourself:

#### Windows (.exe)
```cmd
npm run dist:win
```

#### macOS (.app/.dmg)
```bash
npm run dist:mac
```

#### Linux (.AppImage, .deb)
```bash
npm run dist:linux
```

### Features

- **Multi-Playlist Support**: Manage multiple M3U/M3U8 playlists
- **DVR Functionality**: Record shows and schedule recordings
- **Time-Shifting**: Pause, rewind, and fast-forward live streams
- **EPG Integration**: View program guide information
- **Multi-Language Support**: Interface available in multiple languages
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Modernization Features**:
  - **Chromecast/DLNA Casting**: Stream to your TV or other devices
  - **AI-Powered Recommendations**: Get channel suggestions based on viewing habits
- **Accessibility Features**:
  - **Advanced Closed Captioning**: Multiple caption formats with customization
  - **AI-Enhanced Captions**: Multiple modes for different audience needs
- **Offline Capability**: All dependencies are bundled, no separate installation required
- **Auto-Start Option**: Configure the app to launch when your system starts
- **Auto-Updates**: The application can check for and install updates automatically

## 📋 Usage Guide

### Getting Started

1. **First Launch**: 
   - When you first launch the application, you'll see a welcome screen
   - Follow the setup wizard to configure your initial settings
   - The app will check for dependencies and install any missing components

2. **Adding Playlists**:
   - Go to Settings → Playlists
   - Click "Add Playlist"
   - Enter a URL for remote playlists or browse for local files
   - Playlists will be automatically validated and merged

3. **Watching Channels**:
   - Use the channel navigator on the left side to browse channels
   - Channels are organized by groups from your playlist
   - Click on a channel to start playback
   - Use the search bar at the top to find specific channels

### DVR Features

1. **Recording a Show**:
   - While watching, click the record button (⚫) to start recording
   - Recordings are saved to the configured recordings folder

2. **Scheduling Recordings**:
   - Click the schedule button (📅) 
   - Select start and end times
   - Recordings will automatically start even when the app is closed

3. **Time-Shifting**:
   - Pause live TV with the pause button
   - Use rewind/forward buttons to navigate through the buffered content
   - Buffer size can be configured in Settings

### Casting to Devices

1. **Discover Devices**:
   - Click the cast button (📱) in the player controls
   - The app will search for Chromecast and DLNA devices on your network

2. **Cast to a Device**:
   - Select a device from the list
   - The current channel will start playing on the selected device
   - Use the controls in the casting panel to manage playback

3. **Troubleshooting**:
   - Ensure all devices are on the same network
   - Check network settings if devices aren't discovered
   - See [modernization-features.md](docs/modernization-features.md) for detailed help

### Personalized Recommendations

1. **View Recommendations**:
   - Click the recommendations button (👁️) near the top-right
   - Recommendations are based on your viewing habits

2. **Managing History**:
   - Go to Settings → Modernization → Recommendations
   - View your viewing history or clear it if desired
   - Adjust settings like minimum view time or history limit

3. **Improving Recommendations**:
   - The more you watch, the better the recommendations become
   - Recommendations update periodically as you use the app

### Accessibility Features

1. **Closed Captions**:
   - Toggle captions with the CC button in the player controls
   - Customize appearance in Settings → Accessibility → Captions

2. **AI-Enhanced Captions**:
   - Choose from different caption modes:
     - Standard: Verbatim with error correction
     - Simplified: Easier vocabulary and concepts
     - Academic: Adds explanations for complex terms
     - Casual: Relaxed, conversational phrasing

For detailed information on specific features, please refer to the documentation in the `docs` folder.
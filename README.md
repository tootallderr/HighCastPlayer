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
- **macOS**: Full support with cron integration
- **Linux**: Full support with cron integration (Ubuntu, Debian, Fedora, Arch)

### Storage Locations
- **Windows**: `%APPDATA%\iptv-player`
- **macOS**: `~/Library/Application Support/iptv-player`
- **Linux**: `~/.iptv-player`

### Streaming Formats
- HLS (.m3u8) primary support
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

- **Offline Capability**: All dependencies are bundled, no separate installation required
- **Auto-Start Option**: Configure the app to launch when your system starts
- **Auto-Updates**: The application can check for and install updates automatically

See the [Deployment Guide](docs/deployment-guide.md) for detailed information about packaging, signing, and distribution.
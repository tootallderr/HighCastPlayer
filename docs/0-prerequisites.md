# Prerequisites for IPTV Player

This document outlines all required dependencies and setup instructions for the IPTV Player application across different platforms.

## Required Tools & Libraries

### Codecs
- **FFmpeg** - Required for video processing and recording functionality
  - Windows: v5.0 or later
  - macOS: v5.0 or later
  - Linux: v5.0 or later
- **HLS.js** - Required for HLS stream playback (included in application bundle)

### Runtime Requirements
- **Node.js** - v16.0.0 or later
- **Python** - v3.9 or later (for specific utilities)
- **.NET Runtime** - v6.0 or later (for cross-platform UI with Avalonia)

### Platform-Specific Tools
- **Windows**:
  - Task Scheduler (`taskschd.msc`) - For scheduled recordings
  - PowerShell v5.1 or later
  - Visual C++ Redistributable 2019 or later
 
- **macOS**:
  - `cron` - For scheduled recordings
  - Xcode Command Line Tools
  - Homebrew (recommended for installing dependencies)

- **Linux**:
  - `cron` - For scheduled recordings
  - `systemd` - For service management
  - Required packages: `build-essential`, `libavcodec-dev`, `libavformat-dev`

## Installation Methods

1. **Automatic Setup Scripts**:
   - Windows: Run `setup.bat` as administrator
   - macOS/Linux: Run `setup.sh` with sudo permissions (`sudo ./setup.sh`)

2. **Docker Container (Optional)**:
   - Requires Docker installed on your system
   - Run `docker-compose up` to launch the containerized version

3. **Manual Installation**:
   - See platform-specific instructions below

## Manual Installation Instructions

### Windows
1. Install FFmpeg:
   - Download from [ffmpeg.org](https://ffmpeg.org/download.html)
   - Add to system PATH
2. Install Node.js from [nodejs.org](https://nodejs.org/)
3. Install .NET 6.0 Runtime from [Microsoft](https://dotnet.microsoft.com/download)
4. Install Visual C++ Redistributable 2019

### macOS
1. Install Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
2. Install FFmpeg: `brew install ffmpeg`
3. Install Node.js: `brew install node`
4. Install .NET: `brew install --cask dotnet`

### Linux (Debian/Ubuntu)
```bash
# Update package lists
sudo apt update

# Install FFmpeg
sudo apt install ffmpeg

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Install .NET
wget https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt update
sudo apt install -y apt-transport-https dotnet-sdk-6.0
```

## Dependency Verification

After installation, run the application once to verify all dependencies are correctly installed. The application will perform a dependency check on launch and inform you of any missing components.

## Troubleshooting

If you encounter issues during setup:
1. Check the log file at `tests/setup.log`
2. Verify system PATH includes all required tools
3. Ensure you have administrative/sudo privileges for installation
4. For Docker setup, verify Docker daemon is running

---

For additional help or to report issues, please refer to the project repository's issue tracker.
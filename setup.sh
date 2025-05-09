#!/bin/bash
#
# IPTV Player Setup Script for macOS and Linux
#

# Print header
echo "IPTV Player Setup - macOS/Linux Installer"
echo "========================================"
echo

# Create log directory
mkdir -p tests
LOGFILE="tests/setup.log"
echo "Setup started at $(date)" > "$LOGFILE"

# Function to detect OS
detect_os() {
    if [ "$(uname)" == "Darwin" ]; then
        echo "macos"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    elif [ -f /etc/redhat-release ]; then
        echo "redhat"
    elif [ -f /etc/arch-release ]; then
        echo "arch"
    else
        echo "unknown"
    fi
}

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Create directories
echo "Creating project directories..."
mkdir -p src data/playlists data/recordings tests docs
if [ $? -ne 0 ]; then
    echo "Error: Failed to create directories. Please check permissions."
    exit 1
fi

# Detect OS type
OS_TYPE=$(detect_os)
echo "Detected OS: $OS_TYPE" | tee -a "$LOGFILE"

# Install dependencies based on OS
case $OS_TYPE in
    macos)
        echo "Installing dependencies for macOS..."
        
        # Check for Homebrew
        if ! command_exists brew; then
            echo "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" >> "$LOGFILE" 2>&1
            if [ $? -ne 0 ]; then
                echo "Error: Failed to install Homebrew." | tee -a "$LOGFILE"
                exit 1
            fi
        fi
        
        # Install FFmpeg
        echo "Installing FFmpeg..."
        brew install ffmpeg >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install FFmpeg." | tee -a "$LOGFILE"
        fi
        
        # Install Node.js
        echo "Installing Node.js..."
        brew install node >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install Node.js." | tee -a "$LOGFILE"
        fi
        
        # Install Python
        echo "Installing Python..."
        brew install python >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install Python." | tee -a "$LOGFILE"
        fi
        
        # Install .NET
        echo "Installing .NET..."
        brew install --cask dotnet >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install .NET." | tee -a "$LOGFILE"
        fi
        
        # Check cron service
        echo "Checking cron service..."
        if ! sudo launchctl list | grep -q com.vix.cron; then
            echo "Warning: cron service not running on this Mac." | tee -a "$LOGFILE"
            echo "You might need to enable it manually for scheduling features."
        fi
        ;;
        
    debian)
        echo "Installing dependencies for Debian/Ubuntu..."
        
        # Update package lists
        echo "Updating package lists..."
        sudo apt update >> "$LOGFILE" 2>&1
        
        # Install FFmpeg
        echo "Installing FFmpeg..."
        sudo apt install -y ffmpeg >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install FFmpeg." | tee -a "$LOGFILE"
        fi
        
        # Install Node.js
        echo "Installing Node.js..."
        if ! command_exists node; then
            curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash - >> "$LOGFILE" 2>&1
            sudo apt install -y nodejs >> "$LOGFILE" 2>&1
            if [ $? -ne 0 ]; then
                echo "Error: Failed to install Node.js." | tee -a "$LOGFILE"
            fi
        fi
        
        # Install Python
        echo "Installing Python..."
        sudo apt install -y python3 python3-pip >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install Python." | tee -a "$LOGFILE"
        fi
        
        # Install .NET
        echo "Installing .NET..."
        wget https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb >> "$LOGFILE" 2>&1
        sudo dpkg -i packages-microsoft-prod.deb >> "$LOGFILE" 2>&1
        sudo apt update >> "$LOGFILE" 2>&1
        sudo apt install -y apt-transport-https >> "$LOGFILE" 2>&1
        sudo apt install -y dotnet-runtime-6.0 >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install .NET." | tee -a "$LOGFILE"
        fi
        ;;
        
    redhat)
        echo "Installing dependencies for RHEL/CentOS/Fedora..."
        
        # Install FFmpeg
        echo "Installing FFmpeg..."
        sudo dnf install -y ffmpeg >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install FFmpeg." | tee -a "$LOGFILE"
        fi
        
        # Install Node.js
        echo "Installing Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash - >> "$LOGFILE" 2>&1
        sudo dnf install -y nodejs >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install Node.js." | tee -a "$LOGFILE"
        fi
        
        # Install Python
        echo "Installing Python..."
        sudo dnf install -y python3 python3-pip >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install Python." | tee -a "$LOGFILE"
        fi
        
        # Install .NET
        echo "Installing .NET..."
        sudo rpm -Uvh https://packages.microsoft.com/config/centos/7/packages-microsoft-prod.rpm >> "$LOGFILE" 2>&1
        sudo dnf install -y dotnet-runtime-6.0 >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install .NET." | tee -a "$LOGFILE"
        fi
        ;;
        
    arch)
        echo "Installing dependencies for Arch Linux..."
        
        # Install FFmpeg
        echo "Installing FFmpeg..."
        sudo pacman -S --noconfirm ffmpeg >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install FFmpeg." | tee -a "$LOGFILE"
        fi
        
        # Install Node.js
        echo "Installing Node.js..."
        sudo pacman -S --noconfirm nodejs npm >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install Node.js." | tee -a "$LOGFILE"
        fi
        
        # Install Python
        echo "Installing Python..."
        sudo pacman -S --noconfirm python python-pip >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install Python." | tee -a "$LOGFILE"
        fi
        
        # Install .NET
        echo "Installing .NET..."
        sudo pacman -S --noconfirm dotnet-runtime >> "$LOGFILE" 2>&1
        if [ $? -ne 0 ]; then
            echo "Error: Failed to install .NET." | tee -a "$LOGFILE"
        fi
        ;;
        
    *)
        echo "Unsupported OS. Please install dependencies manually."
        echo "See docs/0-prerequisites.md for instructions."
        exit 1
        ;;
esac

# Create empty settings files
echo "Creating default configuration files..."
echo "{}" > data/settings.json
echo "[]" > data/sources.json

# Verify dependencies
echo "Performing dependency verification..."

# Check FFmpeg
echo "Checking FFmpeg installation..."
if command_exists ffmpeg; then
    echo "FFmpeg installed: $(ffmpeg -version | head -n 1)" >> "$LOGFILE"
else
    echo "Warning: FFmpeg not found in PATH." | tee -a "$LOGFILE"
fi

# Check Node.js
echo "Checking Node.js installation..."
if command_exists node; then
    echo "Node.js installed: $(node --version)" >> "$LOGFILE"
else
    echo "Warning: Node.js not found in PATH." | tee -a "$LOGFILE"
fi

# Check Python
echo "Checking Python installation..."
if command_exists python3; then
    echo "Python installed: $(python3 --version)" >> "$LOGFILE"
elif command_exists python; then
    echo "Python installed: $(python --version)" >> "$LOGFILE"
else
    echo "Warning: Python not found in PATH." | tee -a "$LOGFILE"
fi

# Check .NET
echo "Checking .NET installation..."
if command_exists dotnet; then
    echo ".NET installed: $(dotnet --version)" >> "$LOGFILE"
else
    echo "Warning: .NET not found in PATH." | tee -a "$LOGFILE"
fi

# Set execute permissions
chmod +x setup.sh

echo "Setup completed at $(date)" >> "$LOGFILE"
echo
echo "Installation completed!"
echo
echo "The IPTV Player has been set up successfully."
echo "Please check the log file at $LOGFILE for any warnings or errors."
echo
echo "Read the documentation at docs/0-prerequisites.md for more information."
echo
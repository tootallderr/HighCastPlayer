#!/bin/bash

echo "==================================================="
echo "IPTV Player Package Build and Test Script"
echo "==================================================="
echo ""

echo "[1/4] Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found! Please install Node.js."
    exit 1
fi

echo "[2/4] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies!"
    exit 1
fi

echo "[3/4] Building packages..."
echo "Which platform would you like to build for?"
echo ""
echo "1) Windows (.exe) - best on Windows"
echo "2) macOS (.app/.dmg) - requires macOS"
echo "3) Linux (.AppImage/.deb) - best on Linux"
echo "4) All platforms (may have limitations on current OS)"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "Building Windows package..."
        npm run dist:win
        ;;
    2)
        echo "Building macOS package..."
        npm run dist:mac
        ;;
    3)
        echo "Building Linux package..."
        npm run dist:linux
        ;;
    4)
        echo "Building packages for all platforms..."
        npm run dist
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

if [ $? -ne 0 ]; then
    echo "ERROR: Package build failed!"
    exit 1
fi

echo ""
echo "[4/4] Build complete!"
echo "Package(s) can be found in the 'dist' directory."

echo ""
echo "==================================================="
echo "Testing checklist:"
echo "==================================================="
echo ""
echo "1. Install the package on a clean system"
echo "2. Verify all features work in the packaged version"
echo "3. Check file permissions and access"
echo "4. Test auto-update functionality"
echo "5. Confirm bundled dependencies load correctly"

echo ""
read -p "Would you like to open the output directory? (y/n): " open

if [[ $open == "y" || $open == "Y" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "dist"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "dist" &> /dev/null || nautilus "dist" &> /dev/null || dolphin "dist" &> /dev/null || nemo "dist" &> /dev/null || thunar "dist" &> /dev/null
    fi
fi

echo ""
echo "Done."
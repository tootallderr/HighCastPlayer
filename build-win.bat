@echo off
echo Building IPTV Player for Windows...

rem Clean up any previous build artifacts
if exist "build-output" rd /s /q "build-output"

rem Build using our Windows-specific config with code signing disabled
npx electron-builder --config electron-builder-win.json --win --dir --publish never

echo Build complete. Check build-output folder for results.
pause

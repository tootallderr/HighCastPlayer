@echo off
echo ===================================================
echo IPTV Player Package Build and Test Script
echo ===================================================
echo.

echo [1/4] Checking prerequisites...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js not found! Please install Node.js.
    exit /b 1
)

echo [2/4] Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install dependencies!
    exit /b 1
)

echo [3/4] Building packages...
echo Which platform would you like to build for?
echo.
echo 1) Windows (.exe)
echo 2) macOS (.app/.dmg) - requires macOS
echo 3) Linux (.AppImage/.deb) - best on Linux
echo 4) All platforms (may have limitations on current OS)
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo Building Windows package...
    call npm run dist:win
) else if "%choice%"=="2" (
    echo Building macOS package...
    call npm run dist:mac
) else if "%choice%"=="3" (
    echo Building Linux package...
    call npm run dist:linux
) else if "%choice%"=="4" (
    echo Building packages for all platforms...
    call npm run dist
) else (
    echo Invalid choice. Exiting.
    exit /b 1
)

if %ERRORLEVEL% neq 0 (
    echo ERROR: Package build failed!
    exit /b 1
)

echo.
echo [4/4] Build complete!
echo Package(s) can be found in the 'dist' directory.

echo.
echo ===================================================
echo Testing checklist:
echo ===================================================
echo.
echo 1. Install the package on a clean system
echo 2. Verify all features work in the packaged version
echo 3. Check file permissions and access
echo 4. Test auto-update functionality
echo 5. Confirm bundled dependencies load correctly

echo.
echo Would you like to open the output directory?
set /p open="Enter Y to open, any other key to exit: "

if /i "%open%"=="Y" (
    start "" "dist"
)

echo.
echo Done.
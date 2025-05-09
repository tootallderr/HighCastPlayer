@echo off
:: IPTV Player Setup Script for Windows
echo IPTV Player Setup - Windows Installer
echo =====================================

:: Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Administrative privileges required.
    echo Please run this script as Administrator.
    pause
    exit /b 1
)

:: Create folders if they don't exist
echo Creating project directories...
if not exist src mkdir src
if not exist data mkdir data
if not exist data\playlists mkdir data\playlists
if not exist data\recordings mkdir data\recordings
if not exist tests mkdir tests
if not exist docs mkdir docs

:: Setup log file
set LOGFILE=tests\setup.log
echo Setup started at %date% %time% > %LOGFILE%

:: Check for Chocolatey (package manager)
where choco >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Chocolatey package manager...
    @"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" >> %LOGFILE% 2>&1
    if %errorlevel% neq 0 (
        echo Error installing Chocolatey. Please check %LOGFILE% for details.
        pause
        exit /b 1
    )
    :: Update PATH to include Chocolatey
    set "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
)

:: Install FFmpeg
echo Installing FFmpeg...
choco install ffmpeg -y >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo Error installing FFmpeg. Please check %LOGFILE% for details.
    pause
    exit /b 1
)

:: Install Node.js
echo Installing Node.js...
choco install nodejs-lts -y >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo Error installing Node.js. Please check %LOGFILE% for details.
    pause
    exit /b 1
)

:: Install Python
echo Installing Python...
choco install python -y >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo Error installing Python. Please check %LOGFILE% for details.
    pause
    exit /b 1
)

:: Install .NET Runtime
echo Installing .NET Runtime...
choco install dotnet-runtime -y >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo Error installing .NET Runtime. Please check %LOGFILE% for details.
    pause
    exit /b 1
)

:: Install Visual C++ Redistributable
echo Installing Visual C++ Redistributable...
choco install vcredist140 -y >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo Error installing Visual C++ Redistributable. Please check %LOGFILE% for details.
    pause
    exit /b 1
)

:: Create empty settings files
echo Creating default configuration files...
echo {} > data\settings.json
echo [] > data\sources.json

:: Check all installed dependencies
echo Performing dependency verification...

echo Checking FFmpeg installation...
ffmpeg -version > nul 2>&1
if %errorlevel% neq 0 (
    echo Warning: FFmpeg installation issue detected. >> %LOGFILE%
    echo Warning: FFmpeg not properly installed.
)

echo Checking Node.js installation...
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Warning: Node.js installation issue detected. >> %LOGFILE%
    echo Warning: Node.js not properly installed.
)

echo Checking Python installation...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Warning: Python installation issue detected. >> %LOGFILE%
    echo Warning: Python not properly installed.
)

echo Checking .NET installation...
dotnet --info > nul 2>&1
if %errorlevel% neq 0 (
    echo Warning: .NET installation issue detected. >> %LOGFILE%
    echo Warning: .NET not properly installed.
)

echo Setup completed at %date% %time% >> %LOGFILE%
echo.
echo Installation completed!
echo.
echo The IPTV Player has been set up successfully.
echo Please check the log file at %LOGFILE% for any warnings or errors.
echo.
echo Read the documentation at docs\0-prerequisites.md for more information.
echo.
pause
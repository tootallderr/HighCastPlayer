# IPTV Player Deployment Guide

This guide covers packaging, signing, distributing, and updating the IPTV Player application.

## Packaging

The IPTV Player uses [Electron Builder](https://www.electron.build/) for creating distributable packages for Windows, macOS, and Linux platforms.

### Prerequisites

- Node.js 16.0.0 or higher
- npm 7.0.0 or higher
- For macOS builds:
  - macOS 10.14 or higher
  - Xcode Command Line Tools
  - Apple Developer account (for signing)
- For Windows builds:
  - Windows 10 or higher
  - [Windows 10 SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-10-sdk/)
- For Linux builds:
  - Ubuntu 18.04 or higher (recommended)
  - rpm and fakeroot packages (`sudo apt-get install rpm fakeroot`)

### Configuration

The build configuration is defined in `electron-builder.json`. Key settings include:

- `appId`: The unique application identifier
- `productName`: The display name of the application
- `directories`: Output and resource directories
- `files`: Files to include in the package
- `extraResources`: Additional resources to bundle
- `asar`: ASAR packaging options
- Platform-specific configuration for Windows, macOS, and Linux

### Building Packages

#### All Platforms
```bash
npm run dist
```

#### Windows Only
```bash
npm run dist:win
```

#### macOS Only
```bash
npm run dist:mac
```

#### Linux Only
```bash
npm run dist:linux
```

## Code Signing

### Windows

1. Obtain a Code Signing Certificate from a trusted Certificate Authority.
2. Configure Electron Builder:

```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "your-password"
}
```

### macOS

1. Enroll in the Apple Developer Program.
2. Create an Apple Developer Certificate.
3. Export the certificate and private key.
4. Configure Electron Builder:

```json
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "identity": "Developer ID Application: Your Name (TEAM_ID)"
}
```

## Distribution

### Windows

- `.exe` installer can be distributed through your website
- Consider using Microsoft Store for wider distribution

### macOS

- `.dmg` files can be distributed through your website
- Consider notarizing apps for better security
- Optionally distribute through Mac App Store

### Linux

- `.AppImage` is a portable format that doesn't require installation
- `.deb` packages can be installed on Debian-based distributions
- Consider setting up a PPA for Ubuntu users

## Auto-Updates

The IPTV Player includes an auto-update system using `electron-updater`. 

### Setup

1. Host the updates on a server (GitHub Releases, AWS S3, or your server)
2. Configure the `publish` section in `electron-builder.json`:

```json
"publish": {
  "provider": "generic",
  "url": "https://your-update-server.com/updates"
}
```

### Update Server Structure

Your update server should have the following structure:

```
/updates
  /win32
    RELEASES
    iptv-player-1.0.0-full.nupkg
  /darwin
    latest-mac.yml
    IPTV Player-1.0.0-mac.zip
  /linux
    latest-linux.yml
    iptv-player-1.0.0-linux.AppImage
```

## Testing

Before distributing, ensure to test:

1. Install the application on clean systems
2. Verify all features work in the packaged version
3. Test auto-update functionality
4. Check file permissions and access
5. Confirm bundled dependencies load correctly

## Troubleshooting

### Common Issues

1. **Missing dependencies**: Ensure all dependencies are correctly specified in `package.json` and bundled through `electron-builder.json`.

2. **Code signing errors**: Verify your certificates are valid and properly configured.

3. **Auto-update failures**: Check server URLs and ensure files on the server are correctly formatted.

4. **Permission issues**: Make sure all executable files have the proper permissions (especially bundled executables like ffmpeg).

## Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [Auto Update Guide](https://www.electron.build/auto-update)
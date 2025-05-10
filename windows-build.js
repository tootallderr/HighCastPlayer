// Windows-specific build script to work around symlink issues
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const builder = require('electron-builder');

console.log('Starting Windows-specific build...');

// Custom build configuration
const config = {
  appId: "com.iptv.player",
  productName: "IPTV Player",
  directories: {
    output: "build-output",
    buildResources: "assets"
  },
  files: [
    "src/**/*",
    "ui/**/*",
    "assets/**/*",
    "node_modules/**/*",
    "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
    "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
    "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}"
  ],
  extraResources: [
    { "from": "assets", "to": "assets" },
    { "from": "data", "to": "data" }
  ],
  asar: true,
  win: {
    target: ["nsis"],
    icon: "assets/icon.png",
    // Skip code signing
    publisherName: "IPTV Player Team",
    verifyUpdateCodeSignature: false,
    signAndEditExecutable: false,
    signDlls: false
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "IPTV Player",
    installerIcon: "assets/icon.png",
    uninstallerIcon: "assets/icon.png"
  }
};

// Run the build with our custom config
builder.build({
  targets: builder.Platform.WINDOWS.createTarget(),
  config: config
})
.then(() => {
  console.log('Build completed successfully!');
})
.catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});

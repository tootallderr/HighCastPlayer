/**
 * Improved Casting Manager
 * 
 * This is an enhanced version of the casting manager that provides
 * better error handling and compatibility with various casting libraries.
 */

const { EventEmitter } = require('events');
const path = require('path');
const os = require('os');
const fs = require('fs');
const log = require('electron-log');
const config = require('./config-manager');
const platform = require('./platform');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

// Define file paths
const DATA_DIR = path.join(platform.getAppDataPath());
const CASTING_LOG_FILE = path.join(__dirname, '..', 'tests', 'casting-test.log');

/**
 * CastingManager class with improved error handling
 */
class CastingManagerFixed extends EventEmitter {
  constructor() {
    super();
    this.chromecastDevices = [];
    this.dlnaDevices = [];
    this.activeDevice = null;
    this.isCasting = false;
    this.currentMedia = null;
    this.chromecastAvailable = false;
    this.dlnaAvailable = false;
    this.settings = this.loadSettings();
    
    // Check if required modules are installed
    this.checkDependencies();
    
    // Initialize discovery clients - defer to allow for proper error handling
    setTimeout(() => {
      this.safeInitialize();
    }, 100);
  }
  
  /**
   * Check if required dependencies are installed
   */
  checkDependencies() {
    try {
      // Try to load the modules without using them
      try {
        require.resolve('chromecast-api');
        this.logInfo('Chromecast API dependency found');
      } catch (err) {
        this.logWarn('Chromecast API dependency not found, will use fallback');
      }
      
      try {
        require.resolve('node-ssdp');
        this.logInfo('DLNA/SSDP dependency found');
      } catch (err) {
        try {
          require.resolve('node-upnp-client');
          this.logInfo('UPNP Client dependency found');
        } catch (err2) {
          this.logWarn('No DLNA dependencies found, will use limited functionality');
        }
      }
      
      return true;
    } catch (error) {
      this.logWarn(`Missing casting dependencies: ${error.message}`);
      this.emit('dependencyError', {
        error: 'Missing dependencies',
        message: `Some casting features may not be available: ${error.message}`
      });
      return false;
    }
  }
  
  /**
   * Initialize casting services safely
   */
  safeInitialize() {
    try {
      this.initializeChromecast();
    } catch (err) {
      this.logError(`Failed to initialize Chromecast: ${err.message}`);
      this.chromecastAvailable = false;
    }
    
    try {
      this.initializeDLNA();
    } catch (err) {
      this.logError(`Failed to initialize DLNA: ${err.message}`);
      this.dlnaAvailable = false;
    }
  }
  
  /**
   * Load casting settings from config
   * @returns {Object} - Casting settings
   */
  loadSettings() {
    try {
      const appSettings = config.getAll();
      if (appSettings && appSettings.casting) {
        return appSettings.casting;
      }
      
      // Default settings
      return {
        enabled: true,
        preferredDevices: [],
        autoConnect: false,
        transcoding: {
          enabled: false,
          format: 'mp4',
          videoBitrate: '2000k',
          audioBitrate: '128k'
        }
      };
    } catch (error) {
      this.logError(`Error loading casting settings: ${error.message}`);
      return {
        enabled: true,
        preferredDevices: [],
        autoConnect: false,
        transcoding: {
          enabled: false
        }
      };
    }
  }
  
  /**
   * Save casting settings to config
   * @param {Object} settings - Casting settings to save
   * @returns {boolean} - Success status
   */
  saveSettings(settings) {
    try {
      const appSettings = config.getAll() || {};
      appSettings.casting = settings || this.settings;
      config.setAll(appSettings);
      this.settings = settings || this.settings;
      this.logInfo('Casting settings saved');
      return true;
    } catch (error) {
      this.logError(`Error saving casting settings: ${error.message}`);
      return false;
    }
  }

  /**
   * Initialize Chromecast discovery and events
   */
  initializeChromecast() {
    if (!this.settings.enabled) return;
    
    try {
      this.logInfo('Initializing Chromecast discovery');
      
      try {
        // Try standard module first
        const ChromecastAPI = require('chromecast-api');
        
        // Create instance if the module is properly typed
        if (typeof ChromecastAPI === 'function') {
          this.chromecastClient = new ChromecastAPI();
          
          // Set up device discovery event
          this.chromecastClient.on('device', (device) => {
            if (!device || !device.name) return;
            
            this.logInfo(`Found Chromecast: ${device.name}`);
            this.chromecastDevices.push(device);
            
            this.emit('deviceDiscovered', {
              id: device.host,
              name: device.name,
              type: 'chromecast',
              device
            });
          });
          
          // Start discovery
          this.chromecastClient.update();
          this.chromecastAvailable = true;
          this.logInfo('Chromecast discovery started');
        } else {
          throw new Error('ChromecastAPI is not a constructor');
        }
      } catch (err) {
        // Fall back to our custom discovery
        this.logWarn(`Standard Chromecast module failed: ${err.message}`);
        this.createSimpleChromecastClient();
      }
    } catch (error) {
      this.logError(`Error initializing Chromecast: ${error.message}`);
      this.chromecastAvailable = false;
    }
  }
  
  /**
   * Create a simple Chromecast client as fallback
   */
  createSimpleChromecastClient() {
    try {
      const EventEmitter = require('events');
      this.chromecastClient = new EventEmitter();
      
      // Most basic functionality - register any manually added devices
      this.chromecastClient.update = () => {
        // This is a placeholder for the update method
        this.logInfo('Manual Chromecast discovery mode active (limited functionality)');
      };
      
      // Start discovery
      this.chromecastClient.update();
      this.chromecastAvailable = true;
      
      this.logInfo('Using simplified Chromecast discovery');
      
      // Let the user know about limited functionality
      this.emit('chromecastWarning', {
        message: 'Using simplified Chromecast discovery mode with limited functionality'
      });
      
    } catch (err) {
      this.logError(`Failed to create simple Chromecast client: ${err.message}`);
      this.chromecastAvailable = false;
    }
  }
  
  /**
   * Initialize DLNA discovery and events
   */
  initializeDLNA() {
    if (!this.settings.enabled) return;
    
    try {
      this.logInfo('Initializing DLNA discovery');
      
      // Try SSDP first (most compatible)
      if (this.tryDLNAWithSSDP()) {
        this.logInfo('DLNA initialized with SSDP');
        return;
      }
      
      // Try UPnP Client next
      if (this.tryDLNAWithUPnPClient()) {
        this.logInfo('DLNA initialized with UPnP');
        return;
      }
      
      // Fall back to simple mode
      this.createSimpleDLNAClient();
      
    } catch (error) {
      this.logError(`Error initializing DLNA: ${error.message}`);
      this.dlnaAvailable = false;
    }
  }
  
  /**
   * Try to initialize DLNA with SSDP
   */
  tryDLNAWithSSDP() {
    try {
      const SSDP = require('node-ssdp');
      
      if (!SSDP || !SSDP.Client || typeof SSDP.Client !== 'function') {
        this.logWarn('Incompatible SSDP module');
        return false;
      }
      
      const client = new SSDP.Client();
      const EventEmitter = require('events');
      this.dlnaClient = new EventEmitter();
      
      const discoveredDevices = new Set();
      
      client.on('response', (headers, statusCode, rinfo) => {
        try {
          // Check if this is a media renderer device
          if (headers.ST && headers.ST.includes('MediaRenderer')) {
            const deviceId = headers.USN || `${rinfo.address}:${rinfo.port}`;
            
            // Skip if already discovered
            if (discoveredDevices.has(deviceId)) return;
            discoveredDevices.add(deviceId);
            
            const device = {
              friendlyName: headers.SERVER || 'DLNA Device',
              udn: headers.USN,
              location: headers.LOCATION,
              host: rinfo.address,
              port: rinfo.port
            };
            
            this.logInfo(`Found DLNA device: ${device.friendlyName}`);
            this.dlnaDevices.push(device);
            
            this.dlnaClient.emit('device', device);
            this.emit('deviceDiscovered', {
              id: device.udn || `${device.host}:${device.port}`,
              name: device.friendlyName,
              type: 'dlna',
              device
            });
          }
        } catch (err) {
          this.logWarn(`Error processing DLNA device: ${err.message}`);
        }
      });
      
      // Add discovery methods to our client wrapper
      this.dlnaClient.startDiscovery = () => {
        client.search('urn:schemas-upnp-org:device:MediaRenderer:1');
      };
      
      this.dlnaClient.stopDiscovery = () => {
        client.stop();
      };
      
      // Start discovery
      this.dlnaClient.startDiscovery();
      this.dlnaAvailable = true;
      
      return true;
    } catch (err) {
      this.logWarn(`SSDP initialization failed: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Try to initialize DLNA with UPnP Client
   */
  tryDLNAWithUPnPClient() {
    try {
      let upnpClient;
      try {
        upnpClient = require('node-upnp-client');
      } catch (err) {
        this.logWarn(`UPnP client module not found: ${err.message}`);
        return false;
      }
      
      if (!upnpClient || !upnpClient.Client || typeof upnpClient.Client !== 'function') {
        this.logWarn('node-upnp-client has an incompatible API');
        return false;
      }
      
      this.dlnaClient = new upnpClient.Client();
      
      // Set up device discovery event if the module supports it
      if (typeof this.dlnaClient.on !== 'function') {
        this.logWarn('UPnP client does not support event registration');
        return false;
      }
      
      this.dlnaClient.on('device', (device) => {
        if (!device || !device.deviceType) return;
        
        // Check if this is a media renderer device
        if (device.deviceType.includes('MediaRenderer')) {
          this.logInfo(`Found DLNA device: ${device.friendlyName || 'Unknown'}`);
          this.dlnaDevices.push(device);
          
          this.emit('deviceDiscovered', {
            id: device.udn || device.location || `dlna-${this.dlnaDevices.length}`,
            name: device.friendlyName || 'DLNA Device',
            type: 'dlna',
            device
          });
        }
      });
      
      // Start discovery if supported
      if (typeof this.dlnaClient.startDiscovery === 'function') {
        this.dlnaClient.startDiscovery();
        this.dlnaAvailable = true;
        this.logInfo('DLNA discovery started');
        return true;
      } else {
        this.logWarn('UPnP client does not support startDiscovery');
        return false;
      }
    } catch (err) {
      this.logWarn(`UPnP client initialization failed: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Create a simple DLNA client as fallback
   */
  createSimpleDLNAClient() {
    try {
      const EventEmitter = require('events');
      this.dlnaClient = new EventEmitter();
      
      // Most basic functionality - register any manually added devices
      this.dlnaClient.startDiscovery = () => {
        this.logInfo('Manual DLNA discovery mode active (limited functionality)');
      };
      
      this.dlnaClient.stopDiscovery = () => {
        // No-op in manual mode
      };
      
      // Start discovery
      this.dlnaClient.startDiscovery();
      this.dlnaAvailable = true;
      
      this.logInfo('Using simplified DLNA discovery');
      
      // Let the user know about limited functionality
      this.emit('dlnaWarning', {
        message: 'Using simplified DLNA discovery mode with limited functionality'
      });
      
      return true;
    } catch (err) {
      this.logError(`Failed to create simple DLNA client: ${err.message}`);
      this.dlnaAvailable = false;
      return false;
    }
  }
  
  /**
   * Get all discovered devices with status information
   * @returns {Array} - Discovered devices with status
   */
  getDevicesWithStatus() {
    return {
      chromecast: {
        devices: this.chromecastDevices.map(device => ({
          id: device.host,
          name: device.name || device.friendlyName || 'Unknown Chromecast',
          active: this.activeDevice && this.activeDevice.host === device.host
        })),
        available: this.chromecastAvailable,
        error: !this.chromecastAvailable ? "Chromecast initialization failed" : null
      },
      dlna: {
        devices: this.dlnaDevices.map(device => ({
          id: device.udn || device.host || `dlna-${this.dlnaDevices.indexOf(device)}`,
          name: device.friendlyName || 'DLNA Device',
          active: this.activeDevice && 
                 (this.activeDevice.udn === device.udn || 
                  this.activeDevice.host === device.host)
        })),
        available: this.dlnaAvailable,
        error: !this.dlnaAvailable ? "DLNA initialization failed" : null
      }
    };
  }
  
  /**
   * Get all discovered devices
   * @returns {Array} - Combined list of all discovered devices
   */
  getDevices() {
    const devices = [];
    
    // Add Chromecast devices
    this.chromecastDevices.forEach(device => {
      devices.push({
        id: device.host,
        name: device.name || device.friendlyName || 'Unknown Chromecast',
        type: 'chromecast',
        device
      });
    });
    
    // Add DLNA devices
    this.dlnaDevices.forEach(device => {
      devices.push({
        id: device.udn || device.host || `dlna-${this.dlnaDevices.indexOf(device)}`,
        name: device.friendlyName || 'DLNA Device',
        type: 'dlna',
        device
      });
    });
    
    return devices;
  }
  
  /**
   * Find a device by ID
   * @param {string} deviceId - Device ID to find
   * @returns {Object|null} - Device if found, null otherwise
   */
  findDevice(deviceId) {
    // Check Chromecast devices
    const chromecastDevice = this.chromecastDevices.find(d => d.host === deviceId);
    if (chromecastDevice) {
      return {
        id: chromecastDevice.host,
        name: chromecastDevice.name || 'Chromecast',
        type: 'chromecast',
        device: chromecastDevice
      };
    }
    
    // Check DLNA devices
    const dlnaDevice = this.dlnaDevices.find(d => 
      d.udn === deviceId || 
      d.host === deviceId ||
      `dlna-${this.dlnaDevices.indexOf(d)}` === deviceId
    );
    
    if (dlnaDevice) {
      return {
        id: dlnaDevice.udn || dlnaDevice.host || `dlna-${this.dlnaDevices.indexOf(dlnaDevice)}`,
        name: dlnaDevice.friendlyName || 'DLNA Device',
        type: 'dlna',
        device: dlnaDevice
      };
    }
    
    return null;
  }
  
  /**
   * Get current casting status
   */
  getStatus() {
    if (!this.isCasting || !this.activeDevice) {
      return {
        casting: false,
        device: null,
        media: null
      };
    }
    
    return {
      casting: true,
      device: {
        id: this.activeDevice.id || this.activeDevice.host || this.activeDevice.udn,
        name: this.activeDevice.name || this.activeDevice.friendlyName || 'Unknown Device',
        type: this.activeDevice.type
      },
      media: this.currentMedia ? {
        title: this.currentMedia.title,
        url: this.currentMedia.url
      } : null
    };
  }
  
  /**
   * Log an info message
   */
  logInfo(message) {
    log.info(`[CastingManager] ${message}`);
  }
  
  /**
   * Log a warning message
   */
  logWarn(message) {
    log.warn(`[CastingManager] ${message}`);
  }
  
  /**
   * Log an error message
   */
  logError(message) {
    log.error(`[CastingManager] ${message}`);
    
    // Also log to casting log file for debugging
    try {
      fs.appendFileSync(CASTING_LOG_FILE, `ERROR: ${new Date().toISOString()} - ${message}\n`);
    } catch (e) {
      // Ignore file write errors
    }
  }
}

// Export singleton instance
module.exports = new CastingManagerFixed();

const application = require('electron');
const version = require('./../package').version;
const BrowserWindow = application.BrowserWindow;
const path = require('path');
const registerEvents = require('./events');
const {logDebug, logInfo, logWarning} = require('./logging');
const config = require('config');
const { autoUpdater } = require('electron-updater');

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * the application main window instance
 *
 * @type Electron.BrowserWindow
 */
let windowInstance = null;

/**
 * initializes the electron-updater auto updater mechanism, using update interval from application config
 */
const initAutoUpdate = () => {
    autoUpdater.checkForUpdatesAndNotify().then((updateInfo) => {
        console.log(updateInfo);
    });

    const autoUpdateInterval = (config.has('app.autoUpdateCheckInterval') ? config.get('app.autoUpdateCheckInterval') : 600);
    setTimeout(initAutoUpdate, autoUpdateInterval * 1000);
    logInfo('application', 'initAutoUpdate', 'auto update started with interval %interval'.replace('%interval', autoUpdateInterval.toString()))
};

/**
 * show the application main window
 *
 * @param applicationBootError an occurred error from application boot
 */
const instantiateApplicationWindow = (applicationBootError) => {
    windowInstance = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, '/../static/assets/logmodmobile-64.png'),
        webPreferences: {
            nodeIntegration: true,
            preload: __dirname + '/preload.js'
        }
    });

    windowInstance.setMenu(null);
    if (applicationBootError) {
        windowInstance.loadFile('static/html/applicationBootError.html', {search: 'error=' + JSON.stringify(applicationBootError.message)});
    } else {
        const startUrl = process.env.ELECTRON_START_URL || config.get('app.url');
        windowInstance.loadURL(startUrl).then(() => {
            windowInstance.setTitle(windowInstance.getTitle() + ' • Client %s'.replace('%s', version));
        });

        initAutoUpdate();
        registerEvents();
    }

    if (isDevelopment) {
        windowInstance.webContents.openDevTools();
    }

    windowInstance.on('closed', function () {
        windowInstance = null
    });
};

/**
 * booting the application
 */
const bootApplication = () => {
    logInfo('application', 'bootApplication', 'start');

    let applicationBootError = null;
    if (!config.has('app.url')) {
        applicationBootError = {message: 'config not found or not valid'};
        logWarning('application', 'bootApplication', 'invalid config');
    }

    instantiateApplicationWindow(applicationBootError);
    logInfo('application', 'bootApplication', 'end');
};

module.exports = {
    bootApplication,
    windowInstance
};
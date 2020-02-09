const application = require('electron');
const version = require('./../package').version;
const BrowserWindow = application.BrowserWindow;
const path = require('path');
const registerEvents = require('./events');
const {logDebug, logInfo, logWarning} = require('./logging');
const config = require('config');
const { initializeAutoUpdateCheck } = require('./autoUpdateCheck');
const shippingHandler = require('./shippingHandler');

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * the application main window instance
 *
 * @type Electron.BrowserWindow
 */
let windowInstance = null;

/**
 * window content loaded successfully
 * show the window itself
 */
const windowOnLoadCompleted = () => {
    logDebug('application', 'windowOnLoadCompleted', 'started');
    windowInstance.setTitle(windowInstance.getTitle() + ' • Client %s'.replace('%s', version));
    if (!windowInstance.isVisible()) {
        windowInstance.show();
    }

    logDebug('application', 'windowOnLoadCompleted', 'done');
};

/**
 * displaying an error page in case of application boot process, or window content load, fails
 *
 * @param error
 */
const showApplicationError = (error) => {
    windowInstance.loadFile(
        'static/html/applicationBootError.html',
        {search: 'error=' + JSON.stringify(error.message)}
    ).then(windowOnLoadCompleted);
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
        show: applicationBootError || !isDevelopment,
        icon: path.join(__dirname, '/../static/assets/logmodmobile-64.png'),
        webPreferences: {
            nodeIntegration: true,
            preload: __dirname + '/preload.js'
        }
    });

    windowInstance.setMenu(null);
    if (applicationBootError) {
        showApplicationError(applicationBootError);
    } else {
        const startUrl = process.env.ELECTRON_START_URL || config.get('app.url');
        windowInstance.loadURL(startUrl).then(windowOnLoadCompleted).catch((err) => {
            showApplicationError(err);
        })
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
    if (!config.has('app.url')) {
        instantiateApplicationWindow({message: 'config not found or not valid'});
        logWarning('application', 'bootApplication', 'invalid config');
        return;
    }

    try {
        initializeAutoUpdateCheck();
        registerEvents();

        shippingHandler.initialize();
    } catch (err) {
        logWarning('application', 'bootApplication', err.message);
        instantiateApplicationWindow(err);
        return;
    }

    instantiateApplicationWindow();
    logInfo('application', 'bootApplication', 'end');
};

const init = (app) => {
    app.on('ready', bootApplication);
    app.on('window-all-closed', function () {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit()
        }
    });

    app.on('activate', function () {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (windowInstance === null) {
            bootApplication()
        }
    });
};

module.exports = init;
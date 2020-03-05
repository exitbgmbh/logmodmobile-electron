const application = require('electron');
const { ipcMain } = require('electron');
const version = require('./../package').version;
const BrowserWindow = application.BrowserWindow;
const path = require('path');
const {logDebug, logInfo, logWarning} = require('./logging');
const config = require('config');
const { initializeAutoUpdateCheck } = require('./autoUpdateCheck');
const shippingHandlerInstance = require('./shipping');
const printingHandlerInstance = require('./printing');
const invoiceHandlerInstance = require('./invoice');
const restClientInstance = require('./restClient');
const { getLogModIdentification } = require('./helper');
const showNotification = require('./notificationHelper');
const webSocketHandler = require('./websocket');
const scaleHandler = require('./scale');
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
    if (!windowInstance.isVisible()) {
        windowInstance.show();
    }

    let windowTitle = windowInstance.getTitle();
    if (windowTitle.indexOf('Client') === -1) {
        windowInstance.setTitle(windowInstance.getTitle() + ' • Client %s'.replace('%s', version));
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
    ).then(() => {

    });
    windowInstance.webContents.on('did-finish-load', windowOnLoadCompleted);
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
        show: applicationBootError || isDevelopment,
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
        windowInstance.loadURL(startUrl).then(() => {

        }).catch((err) => {
            showApplicationError(err);
        });
        windowInstance.webContents.on('did-finish-load', windowOnLoadCompleted);
    }

    if (isDevelopment) {
        windowInstance.webContents.openDevTools();
    }

    ipcMain.on('authentication-succeed', windowOnLoadCompleted);
    windowInstance.on('closed', function () {
        windowInstance = null
    });
};

/**
 * ipc event from logmodmobile
 * this informs us about successful authentication
 * we can now connect to blisstribute websocket
 *
 * @param event
 * @param arguments
 */
const authenticationSucceed = (event, arguments) => {
    logDebug('event', 'authenticationSucceed', 'start ' + JSON.stringify(arguments));
    restClientInstance.setAuthToken(arguments.authenticationToken);
    restClientInstance.parseBaseUrl(arguments.requestUrl);

    const logModMobileIdent = getLogModIdentification();
    restClientInstance.requestWebSocketAccessLink(logModMobileIdent).then((response) => {
        showNotification('LogModMobile wird registriert...');
        const { socketLink } = response.response;

        webSocketHandler.setLogModIdentification(logModMobileIdent).connectToWebSocket(socketLink);
    }).catch((error) => {
        logWarning('event', 'authenticationSucceed', 'call for websocket failed ' + error.message);
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

        ipcMain.on('authentication-succeed', authenticationSucceed);

        shippingHandlerInstance.initialize();
        printingHandlerInstance.initialize();
        invoiceHandlerInstance.initialize();
        scaleHandler.initialize();
        
        setInterval(() => {
            scaleHandler.callScale().then(console.log).catch(console.log);
        }, 1000);
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

    // when application is shut down, we've to remove our temporary files
    app.on('quit', function () {
        printingHandlerInstance.cleanup();
    });
};

module.exports = init;
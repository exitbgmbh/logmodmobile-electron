const application = require('electron');
const { ipcMain, ipcRenderer, shell, dialog } = require('electron');
const menuEventEmitter = require('./menu/eventEmitter');
const version = require('./../package').version;
const BrowserWindow = application.BrowserWindow;
const app = application.app;
const path = require('path');
const {logDebug, logInfo, logWarning} = require('./logging');
const config = require('config');
const { initializeAutoUpdateCheck, autoUpdater, manualCheckForUpdate} = require('./autoUpdateCheck');
const shippingHandlerInstance = require('./shipping');
const printingHandlerInstance = require('./printing');
const invoiceHandlerInstance = require('./invoice');
const restClientInstance = require('./restClient');
const { getLogModIdentification } = require('./helper');
const showNotification = require('./notificationHelper');
const webSocketHandler = require('./websocket');
const scaleHandler = require('./scale');
const isDevelopment = process.env.NODE_ENV === 'development';
const showDevTools = process.env.SHOW_DEV_TOOLS === '1';
const promiseIpc = require('electron-promise-ipc');
const menu = require('./menu');
const { getApplicationConfigFile } = require('./../setupConfig');
const fs = require('fs');
const restSrvInstance = require('./rest');
const {nanoid} = require("nanoid");
const {loadPlugins} = require("../pluginLoader");
const webSocketEventEmitter = require("./websocket/eventEmitter");
const LocalStorage = require('node-localstorage').LocalStorage;

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
 * open system editor
 */
const showApplicationConfig = () => {
    const {name} = config.util.getConfigSources()[0];
    logInfo('application', 'showApplicationConfig', name);
    shell.openPath(name);
};

/**
 * reload application config
 */
const reloadApplicationConfig = () => {
    const sources = config.util.getConfigSources();
    for (const { name } of sources) {
        if (name === '$NODE_CONFIG' || name === '--NODE-CONFIG') {
            continue;
        }

        delete require.cache[name];
    }

    delete require.cache[require.resolve('config')];
};

/**
 * displaying json editor
 */
const showBatchPrint = () => {
    windowInstance.loadFile('static/html/batchPrinting.html').then(() => {});
};

/**
 * show the application main window
 *
 * @param applicationBootError an occurred error from application boot
 */
const instantiateApplicationWindow = (applicationBootError) => {
    windowInstance = new BrowserWindow({
        minWidth: isDevelopment ? 320 : 1024,
        minHeight: 768,
        show: applicationBootError || isDevelopment,
        icon: path.join(__dirname, '/../static/assets/logmodmobile-64.png'),
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInSubFrames: true,
            nodeIntegrationsInWorker: true,
            allowRunningInsecureContent: true,
            enableRemoteModule: true,
            contextIsolation: false,
            preload: __dirname + '/preload.js'
        }
    });

    windowInstance.maximize();
    windowInstance.setMenu(menu);

    if (showDevTools) {
        windowInstance.webContents.openDevTools();
    }

    if (applicationBootError) {
        showApplicationError(applicationBootError);
    } else {
        showLogModMobile(windowInstance);
    }

    windowInstance.on('closed', function () {
        windowInstance = null
    });
};

const showLogModMobile = (windowInstance) => {
    let startUrl = process.env.ELECTRON_START_URL || config.get('app.url');
    startUrl += `?avoidCached=${nanoid(4)}`
    windowInstance.loadURL(startUrl)
        .then(() => {
            showChangeLog();
        })
        .catch((err) => {
            console.log(err)
        });
    windowInstance.webContents.on('did-finish-load', windowOnLoadCompleted);
}

const logout = () => {
    process.exit();
}

const directLog = (ev, arguments) => {
    logInfo('application', 'directLog', JSON.stringify(arguments));
}

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

    if (config.has('app.persistentLogin') && config.get('app.persistentLogin')) {
        restClientInstance.enablePersistentLogin();
    }

    shippingHandlerInstance.initialize();
    printingHandlerInstance.initialize();
    invoiceHandlerInstance.initialize();
    restSrvInstance.initialize(windowInstance);
};

const websocketConnect = () => {
    const logModMobileIdent = getLogModIdentification();
    restClientInstance.requestWebSocketAccessLink(logModMobileIdent).then((response) => {
        const { socketLink } = response.response;
        logInfo('application', 'websocketConnect', 'got connection link ' + socketLink);

        showNotification('LogModMobile wird registriert...');
        webSocketHandler.setLogModIdentification(logModMobileIdent).connectToWebSocket(socketLink);
    }).catch((error) => {
        logWarning('event', 'authenticationSucceed', 'call for websocket failed ' + error.message);
    });
}

const websocketDisconnect = () => {
    webSocketHandler.disconnectFromWebSocket();
}

const notifyForUpdate = () => {
    windowInstance.webContents.send('updateAvailable');
}

const bindIpcEvents = () => {
    // log from renderer
    ipcMain.on('direct-log', directLog);

    // print shipping request package (id) label on demand
    ipcMain.on('package-id-label-print', (event, arg) => {
        if (!config.has('printing.printShippingRequestPackageLabel')
            || !config.get('printing.printShippingRequestPackageLabel')
            || !config.has('printing.shippingRequestPackageLabelRAWTemplate')
        ) {
            return;
        }

        const template = config.get('printing.shippingRequestPackageLabelRAWTemplate');
        const command = template.replaceAll('{%packageId}', arg.packageId);
        printingHandlerInstance.printDirectRaw(config.get('printing.defaultProductLabelPrinter'), command);
    });

    // direct print of invoices on demand
    ipcMain.on('direct-print-invoice', (event, arg) => {
        if (!config.has('invoicing.directPrinting')) {
            return;
        }

        webSocketEventEmitter.emit('requestDocuments', arg);
    });

    // direct print of invoices on pickBox ready
    ipcMain.on('direct-print-pick-box-ready', (event, arg) => {
        if (!config.has('invoicing.directPrinting') || webSocketHandler.pickListNeedsAdditionalDocuments(arg)) {
            return;
        }

        webSocketEventEmitter.emit('pickBoxReady', arg);
    });

    // authentication succeed in renderer
    ipcMain.on('authentication-succeed', (event, arg) => {
        console.log('authentication-succeed', 'authenticationSucceed()');
        authenticationSucceed(event, arg);

        console.log('authentication-succeed', 'windowOnLoadCompleted()');
        windowOnLoadCompleted(event, arg);

        if (config.has('app.dashboardOnlyMode') && config.get('app.dashboardOnlyMode') === true) {
            windowInstance.webContents.send('full-dashboard', {});
        }
    });

    // websocket connected in renderer
    ipcMain.on('websocket-connected', websocketConnect);

    // websocket disconnected in renderer
    ipcMain.on('websocket-disconnected', websocketDisconnect);

    // logout from renderer
    ipcMain.on('logout', logout);

    // print from electron batchPrinting form (directly to Zebra API)
    ipcMain.on('batchPrinting', (event, arg) => {
        printingHandlerInstance.printDirectRaw(arg.printer, arg.command);
    });

    // login form has been loaded in renderer, if configured, send credentials and login automatically
    ipcMain.on('await-authentication', (event, arg) => {
        if (!config.has('app.username') || !config.has('app.password')) {
            return;
        }

        console.debug('got awaiting authentication event');
        windowInstance.webContents.send('auth-request', {
            username: config.get('app.username'),
            password: config.get('app.password')
        });
        console.debug('auth event answered');
    });

    // promiseIpc is an advanced ipc package - it returns promised
    // calling rs232 connected scale
    promiseIpc.on('scale-package', () => {
        return scaleHandler.callScale();
    });

    promiseIpc.on('scale-available', () => {
        return scaleHandler.scaleAvailable();
    });

    // call for electron version
    promiseIpc.on('version-call', () => {
        return version;
    });

    // deprecated - not used anymore
    ipcMain.on('back', () => showLogModMobile(windowInstance));
    // deprecated - not used anymore
    ipcMain.on('saveConfig', (event, arg) => {
        const configFile = getApplicationConfigFile();
        fs.writeFileSync(configFile, arg);
        showLogModMobile(windowInstance);
    });
}

/**
 * booting the application
 */
const bootApplication = () => {
    logInfo('application', 'bootApplication', 'start');
    menuEventEmitter.on('showConfig', () => showApplicationConfig());
    menuEventEmitter.on('reloadConfig', () => reloadApplicationConfig());
    menuEventEmitter.on('showBatchPrint', () => showBatchPrint());
    menuEventEmitter.on('checkForUpdate', () => manualCheckForUpdate());
    menuEventEmitter.on('testNewRelease', () => notifyForUpdate());
    menuEventEmitter.on('showChangeLog', () => showChangeLog(true));

    if (!config.has('app.url')) {
        instantiateApplicationWindow({message: 'config not found or not valid'});
        logWarning('application', 'bootApplication', 'invalid config');
        return;
    }

    try {
        autoUpdater.on('update-downloaded', (updateInfo) => {
            notifyForUpdate();
        });

        initializeAutoUpdateCheck();
        bindIpcEvents();

        scaleHandler.initialize();
    } catch (err) {
        console.log(err);
        logWarning('application', 'bootApplication', err.message);
        instantiateApplicationWindow(err);
        return;
    }

    loadPlugins();
    instantiateApplicationWindow();
    logInfo('application', 'bootApplication', 'end');
};

const showChangeLog = (force = false) => {
    let localStorage = new LocalStorage(path.join(app.getPath('userData'), 'storage.data'));

    let show = false;
    if (localStorage.getItem('LAST_VERSION') !== version) {
        localStorage.setItem('LAST_VERSION', version);
        show = true;
    }

    if (!show && !force) {
        return;
    }

    const releaseNoteBrowserWindow = new BrowserWindow({
        parent: windowInstance,
        modal: true,
        show: false,
        title: 'ChangeLog für Version ' + version
    });

    releaseNoteBrowserWindow.setMenu(null);
    releaseNoteBrowserWindow.loadFile('static/html/changeLog.html');
    releaseNoteBrowserWindow.show();
    releaseNoteBrowserWindow.focus();
}

const init = () => {
    const lock = app.requestSingleInstanceLock();
    if (!lock) {
        logWarning('application', 'init', 'prevent second instance startup. exiting.');
        app.quit();
        return;
    }

    app.on('certificate-error', function(event, webContents, url, error, certificate, callback) {
        event.preventDefault();
        callback(true);
    });

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
            bootApplication(app);
        }
    });

    // when application is shut down, we've to remove our temporary files
    app.on('quit', function () {
        printingHandlerInstance.cleanup();
    });
};

module.exports = init;

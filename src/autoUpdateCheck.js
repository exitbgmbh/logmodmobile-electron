const config = require('config');
const { autoUpdater } = require('electron-updater');
const { logInfo } = require('./logging');

let updateCheckPID = null;

/**
 * initializes the electron-updater auto updater mechanism, using update interval from application config
 */
const initializeAutoUpdateCheck = () => {
    let autoUpdateInterval = 0;
    if (config.has('app.autoUpdateCheckInterval')) {
        autoUpdateInterval = config.get('app.autoUpdateCheckInterval');
    }

    if (config.has('app.autoUpdateAllowPrerelease')) {
        const allowPrereleases = config.get('app.autoUpdateAllowPrerelease') ?? false
        if (!allowPrereleases) {
            logInfo('application', 'initAutoUpdate', `prereleases are not allowed`)
        } else {
            logInfo('application', 'initAutoUpdate', `prereleases are allowed`)
        }

        autoUpdater.allowPrerelease = allowPrereleases
    } else {
        logInfo('application', 'initAutoUpdate', `prereleases are not allowed`)
        autoUpdater.allowPrerelease = false
    }


    if (autoUpdateInterval > 0) {
        _checkForUpdates();
        updateCheckPID = setInterval(_checkForUpdates, autoUpdateInterval * 1000);
        logInfo('application', 'initAutoUpdate', 'auto update started with interval %interval'.replace('%interval', autoUpdateInterval.toString()))
    } else {
        logInfo('application', 'initAutoUpdate', 'auto update disabled')
    }
};

/**
 * disables the auto updater mechanism
 */
const disableAutoUpdateCheck = () => {
    if (!updateCheckPID) {
        return;
    }

    clearInterval(updateCheckPID);
};

const manualCheckForUpdate = () => {
    autoUpdater.checkForUpdates().then((updateInfo) => {
        console.log(updateInfo);
    });
}

/**
 * auto update check mechanism
 *
 * @private
 */
const _checkForUpdates = () => {
    logInfo('checking for updates');
    autoUpdater.checkForUpdatesAndNotify().then((updateInfo) => {
        console.log(updateInfo);
    });
};

module.exports = {
    initializeAutoUpdateCheck,
    disableAutoUpdateCheck,
    manualCheckForUpdate,
    autoUpdater
};

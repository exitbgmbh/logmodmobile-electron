const config = require('config');
const { autoUpdater } = require('electron-updater');
const { logInfo } = require('./logging');

let updateCheckPID = null;

/**
 * initializes the electron-updater auto updater mechanism, using update interval from application config
 */
const initializeAutoUpdateCheck = () => {
    //if (config.has('app.devUpdateServer')) {
    //    autoUpdater.setFeedURL(config.get('app.devUpdateServer'));
    //}

    let autoUpdateInterval = 600;
    if (config.has('app.autoUpdateCheckInterval')) {
        autoUpdateInterval = config.get('app.autoUpdateCheckInterval');
    }

    _checkForUpdates();
    updateCheckPID = setInterval(_checkForUpdates, autoUpdateInterval * 1000);
    logInfo('application', 'initAutoUpdate', 'auto update started with interval %interval'.replace('%interval', autoUpdateInterval.toString()))
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

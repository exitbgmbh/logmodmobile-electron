const config = require('config');
const { autoUpdater } = require('electron-updater');
const { logInfo } = require('./logging');

let updateCheckPID = null;

/**
 * initializes the electron-updater auto updater mechanism, using update interval from application config
 */
const initializeAutoUpdateCheck = () => {
    const autoUpdateInterval = (config.has('app.autoUpdateCheckInterval') ? config.get('app.autoUpdateCheckInterval') : 600);

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

/**
 * auto update check mechanism
 *
 * @private
 */
const _checkForUpdates = () => {
    autoUpdater.checkForUpdatesAndNotify().then((updateInfo) => {
        console.log(updateInfo);
    });
};

module.exports = {
    initializeAutoUpdateCheck,
    disableAutoUpdateCheck,
    autoUpdater
};
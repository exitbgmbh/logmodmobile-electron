const fs = require('fs');
const path = require('path');
const isRunningInAsar = require('electron-is-running-in-asar');
const {logDebug, logInfo} = require('./src/logging');

/**
 * get the default user config path
 *
 * @param app Electron.App
 * @returns {string}
 */
const getApplicationConfigPath = (app) => {
    const appPath = app.getPath('userData');
    if (!fs.existsSync(appPath)) {
        fs.mkdirSync(appPath);
    }

    return appPath;
};

/**
 * get default user config file
 *
 * @param app Electron.App
 * @returns {string}
 */
const getApplicationConfigFile = (app) => {
    return getApplicationConfigPath(app) + path.sep + 'default.json';
};

/**
 * setting up default configuration
 *
 * @param app Electron.App
 */
const setupConfig = (app) => {
    logInfo('preCheckConfig', 'setupConfig', 'start');

    let srcFile, destFile;
    if (isRunningInAsar()) {
        srcFile = path.join(app.getAppPath(), '..', '..', 'config', 'default.dist.json');
    } else {
        srcFile = app.getAppPath() + path.sep + 'config' + path.sep + 'default.dist.json';
    }

    destFile = getApplicationConfigFile(app);

    logDebug('setupConfig', 'setupConfig::fileSource', srcFile);
    logDebug('setupConfig', 'setupConfig::fileDestination', destFile);

    fs.copyFileSync(srcFile, destFile);
};

/**
 * check if default config is available and update config path to user config path
 *
 * @param app Electron.App
 */
const checkConfig = (app) => {
    logDebug('setupConfig', 'checkConfig', 'start');
    if (!fs.existsSync(getApplicationConfigFile(app))) {
        logInfo('preCheckConfig', 'setupConfig', 'could not find configuration path. setting up...');
        setupConfig(app);
    }

    process.env.NODE_CONFIG_DIR = getApplicationConfigPath(app);
    logDebug('setupConfig', 'checkConfig', 'configuration path set ' + process.env.NODE_CONFIG_DIR);
    logDebug('setupConfig', 'checkConfig', 'done');
};

module.exports = {
    checkConfig,
    getApplicationConfigFile
};
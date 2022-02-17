const app = require('electron').app;
const fs = require('fs');
const path = require('path');
const isRunningInAsar = require('electron-is-running-in-asar');
const {logDebug, logInfo} = require('./src/logging');

/**
 * get the default user config path
 *
 * @returns {string}
 */
const getApplicationConfigPath = () => {
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
const getApplicationConfigFile = () => {
    return getApplicationConfigPath() + path.sep + 'default.json';
};

const getPluginPath = () => {
    return getApplicationConfigPath() + path.sep + 'Plugins'
}

/**
 * setting up default configuration
 */
const setupConfig = () => {
    logInfo('preCheckConfig', 'setupConfig', 'start');

    let srcFile, destFile;
    if (isRunningInAsar()) {
        srcFile = path.join(app.getAppPath(), '..', '..', 'config', 'default.dist.json');
    } else {
        srcFile = app.getAppPath() + path.sep + 'config' + path.sep + 'default.dist.json';
    }

    destFile = getApplicationConfigFile();

    logDebug('setupConfig', 'setupConfig::fileSource', srcFile);
    logDebug('setupConfig', 'setupConfig::fileDestination', destFile);

    fs.copyFileSync(srcFile, destFile);
};

/**
 * check if default config is available and update config path to user config path
 */
const checkConfig = () => {
    logDebug('setupConfig', 'checkConfig', 'start');
    if (!fs.existsSync(getApplicationConfigFile())) {
        logInfo('preCheckConfig', 'setupConfig', 'could not find configuration path. setting up...');
        setupConfig();
    }

    process.env.NODE_CONFIG_DIR = getApplicationConfigPath();
    logDebug('setupConfig', 'checkConfig', 'configuration path set ' + process.env.NODE_CONFIG_DIR);
    logDebug('setupConfig', 'checkConfig', 'done');
};

module.exports = {
    checkConfig,
    getApplicationConfigFile,
    getApplicationConfigPath,
    getPluginPath
};
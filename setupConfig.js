const fs = require('fs');
const path = require('path');
const isRunningInAsar = require('electron-is-running-in-asar');
const {logDebug, logInfo} = require('./src/logging');

const getApplicationConfigPath = (app) => {
    return app.getPath('userData');
};

const getApplicationConfigFile = (app) => {
    return getApplicationConfigPath(app) + path.sep + 'default.yaml';
};

const setupConfig = (app) => {
    logInfo('preCheckConfig', 'setupConfig', 'start');

    let srcFile, destFile;
    if (isRunningInAsar()) {
        srcFile = path.join(app.getAppPath(), '..', '..', 'config', 'default.yaml.dist');
    } else {
        srcFile = app.getAppPath() + path.sep + 'config' + path.sep + 'default.yaml.dist';
    }

    destFile = getApplicationConfigFile(app);

    logDebug('setupConfig', 'setupConfig', srcFile);
    logDebug('setupConfig', 'setupConfig', destFile);

    return fs.copyFileSync(srcFile, destFile);
};

const checkConfig = (app) => {
    logDebug('setupConfig', 'checkConfig', 'start');
    const cfgPath = getApplicationConfigPath(app);
    process.env.NODE_CONFIG_DIR = cfgPath;
    logDebug('setupConfig', 'checkConfig', 'configuration path set ' + process.env.NODE_CONFIG_DIR);

    if (!fs.existsSync(getApplicationConfigFile(app))) {
        logInfo('preCheckConfig', 'setupConfig', 'could not find configuration path. setting up...');
        setupConfig(app);
    }

    logDebug('setupConfig', 'checkConfig', 'done');
};

module.exports = checkConfig;
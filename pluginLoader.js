const electronApp = require('electron').app;
const path = require('path');
const {logDebug, logInfo} = require('./src/logging');
const {getApplicationConfigPath} = require('./setupConfig')
const glob = require('glob');

const loadPlugins = (app) => {
    const pluginPath = getApplicationConfigPath(electronApp) + path.sep + 'Plugins';
    logDebug('pluginLoader', 'loadPlugins', pluginPath);

    const plugins = glob.sync(pluginPath + '/*');
    plugins.every((pluginPath) => {
        const relativePath = path.relative(__dirname, pluginPath);
        const pluginData = path.parse(pluginPath);

        if (pluginData.ext === '.dis') {
            return false;
        }

        const loadedPlugin = loadPlugin(pluginData.name, relativePath);
        if (loadedPlugin && loadedPlugin.hasOwnProperty('init')) {
            logDebug(pluginData.name, 'init', 'running init');
            loadedPlugin.init(app);
        }

        return true;
    });
}

const loadPlugin = (pluginName, pluginPath) => {
    logInfo('pluginLoader', 'loadPlugin', pluginName + ' (' + pluginPath + ')');
    try {
        return require(pluginPath);
    } catch (e) {
        console.error(e);
    }
}

module.exports = {
    loadPlugins
};
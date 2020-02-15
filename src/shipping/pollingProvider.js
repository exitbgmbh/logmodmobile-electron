const fs = require('fs');
const chokidar = require('chokidar');
const {logInfo, logDebug, logWarning} = require('./../logging');

class PollingProvider
{
    code = '';
    config = {};

    constructor(code, config) {
        this.code = code;
        this.config = config;

        this._initialize(config);
    }

    _initialize = (config) => {
        if (!config.hasOwnProperty('polling')) {
            throw new Error('shipment provider ' + this.code + ' is not configured properly');
        }

        const { polling: {
            fileExport: {path: pollingFileExportPath = '', pattern: pollingFileExportPattern = ''} = {},
            fileImport: {path: dayClosingFileImportPath = false, pattern: dayClosingFileImportPattern = false} = {}
        } = {} } = config;

        console.log(dayClosingFileImportPath, dayClosingFileImportPattern);

        if (dayClosingFileImportPath && dayClosingFileImportPattern) {
            console.log(dayClosingFileImportPattern, dayClosingFileImportPath);
            this._initializeFileWatcher(dayClosingFileImportPath, dayClosingFileImportPattern);
        }

    };

    _initializeFileWatcher = (directoryToWatch, filePattern) => {
        if (!fs.existsSync(directoryToWatch)) {
            logWarning('pollingProvider', '_initializeFileWatcher', 'import directory ' + directoryToWatch + ' does not exist or is not accessible');
            return;
        }

        logInfo('pollingProvider', '_initializeFileWatcher', 'fileWatcher is active for ' + directoryToWatch + ' with pattern ' + filePattern);
        chokidar.watch(directoryToWatch, {awaitWriteFinish: {stabilityThreshold: 2000, pollInterval: 500}}).on('all', (event, path) => {
            console.log(event, path);
        });
    };

    handlePolling = (pollingFileCounter) => {

    }
}

module.exports = PollingProvider;
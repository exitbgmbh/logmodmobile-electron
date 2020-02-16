const fs = require('fs');
const chokidar = require('chokidar');
const {logInfo, logDebug, logWarning} = require('./../logging');
const encoding = require("encoding");
const path = require('path');

class PollingProvider {
    /**
     * provider code
     * @type {string}
     */
    code = '';

    /**
     * file export configuration
     * @type {{pollingFileExportPath: string, pollingFileExportPattern: string, pollingFileExportEncoding}}
     */
    exportConfig = {};
    
    /**
     * file import configuration
     * @type {{dayClosingFileImportPattern: string, dayClosingFileImportEncoding: string}}
     */
    importConfig = {};
    
    /**
     * @param {string} code
     * @param {{}} config
     */
    constructor(code, config) {
        this.code = code;
        this._initialize(config);
    }
    
    /**
     * initializing the polling provider
     *
     * @param {{}} config
     *
     * @private
     */
    _initialize = (config) => {
        if (!config.hasOwnProperty('polling')) {
            throw new Error('shipment provider ' + this.code + ' is not configured properly');
        }

        const {
            polling: {
                fileExport: {
                    path: pollingFileExportPath = '',
                    pattern: pollingFileExportPattern = 'Poll-{COUNTER}.csv',
                    encoding: pollingFileExportEncoding = 'iso-8859-1'
                } = {},
                fileImport: {
                    path: dayClosingFileImportPath = '',
                    pattern: dayClosingFileImportPattern = 'ELSendEx.*\.csv',
                    encoding: dayClosingFileImportEncoding = 'iso-8859-1'
                } = {}
            } = {}
        } = config;

        logDebug('pollingProvider', '_initialize', 'initializing polling provider ' + this.code);
        logDebug('pollingProvider', '_initialize', 'using config ' + JSON.stringify(config));

        if (dayClosingFileImportPath.trim() !== '' && dayClosingFileImportPattern.trim() !== '') {
            this._initializeFileWatcher(dayClosingFileImportPath, dayClosingFileImportPattern);
        }
        
        this.importConfig = {
            dayClosingFileImportPattern,
            dayClosingFileImportEncoding
        };

        this.exportConfig = {
            pollingFileExportPath,
            pollingFileExportPattern,
            pollingFileExportEncoding
        }
    };

    /**
     * setting up a file watcher for the day closing file import
     *
     * @param {string} directoryToWatch
     * @param {string} filePattern
     *
     * @private
     */
    _initializeFileWatcher = (directoryToWatch, filePattern) => {
        if (!fs.existsSync(directoryToWatch)) {
            logWarning('pollingProvider', '_initializeFileWatcher', 'import directory ' + directoryToWatch + ' does not exist or is not accessible');
            return;
        }

        logInfo('pollingProvider', '_initializeFileWatcher', 'fileWatcher is active for ' + directoryToWatch + ' with pattern ' + filePattern);
        chokidar
            .watch(directoryToWatch, {awaitWriteFinish: {stabilityThreshold: 2000, pollInterval: 500}})
            .on('add', this._fileWatcherGotFile);
    };
    
    /**
     * handling routine for attended files
     *
     * @param {string} file
     *
     * @private
     */
    _fileWatcherGotFile = (file) => {
        fs.readFile(file, (err, data) => {
            logDebug('pollingProvider', '_fileWatcherGotFile', 'got file ' + file);
            if (err) throw err;
            
            const { dayClosingFileImportPattern: filePattern, dayClosingFileImportEncoding: fileEncoding } = this.importConfig;
            
            const fileName = path.basename(file);
            if (!fileName.match(filePattern)) {
                logDebug('pollingProvider', '_fileWatcherGotFile', 'file does not match pattern. skipping.');
                return;
            }
        
            logInfo('pollingProvider', '_fileWatcherGotFile', 'processing file ' + file);
            let dayClosingData = data;
            if (fileEncoding) {
                dayClosingData = encoding.convert(dayClosingData, 'utf-8', fileEncoding);
            }
        
            console.log(dayClosingData.toString());
        });
    };

    /**
     *
     * @param {string} pollingContentBase64Encoded
     * @param {int} pollingFileCounter
     * @param {string} invoiceNumber
     */
    handlePolling = (pollingContentBase64Encoded, pollingFileCounter, invoiceNumber = '') => {
        if (pollingContentBase64Encoded && pollingContentBase64Encoded.trim() === '') {
            logWarning('pollingProvider', 'handlePolling', 'no polling content given');
            return;
        }
        
        const { pollingFileExportPath: exportPath, pollingFileExportEncoding: exportEncoding, pollingFileExportPattern: exportPattern } = this.exportConfig;

        if (this.exportConfig.pollingFileExportPath.trim() === '') {
            logWarning('pollingProvider', 'handlePolling', 'no polling export path configured');
            return;
        }

        let decodedContent = Buffer.from(pollingContentBase64Encoded, 'base64');
        if (exportEncoding) {
            decodedContent = encoding.convert(decodedContent, exportEncoding);
        }
        
        const targetFileName = exportPattern
            .replace('{COUNTER}', pollingFileCounter.toString())
            .replace('{INVOICE_NUMBER}', invoiceNumber);

        const targetFile = path.join(exportPath, targetFileName);

        fs.writeFileSync(targetFile, decodedContent);
    };
}

module.exports = PollingProvider;
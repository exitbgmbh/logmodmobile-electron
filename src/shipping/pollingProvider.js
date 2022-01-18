const {logInfo, logDebug, logWarning} = require('./../logging');
const restClientInstance = require('./../restClient');
const chokidar = require('chokidar');
const encoding = require('encoding');
const path = require('path');
const fs = require('fs');
const async = require('async');

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

    importFileQueue;
    
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

        let importRoutine = this._fileWatcherGotFile;
        this.importFileQueue = async.queue(async function(file) {
            logDebug('pollingProvider', 'importFileQueueProcess', 'handling ' + file);
            importRoutine(file);
        });
        this.importFileQueue.error(function(err, file) {
            logWarning('pollingProvider', 'importFileQueueError', err);
        });

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
        let fileQueue = this.importFileQueue;
        chokidar
            .watch(directoryToWatch, {awaitWriteFinish: {stabilityThreshold: 2000, pollInterval: 500}, depth: 0})
            .on('add', function(file) { fileQueue.push(file); });
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
    
            const parsedFile = path.parse(file);
            if (!parsedFile.base.match(filePattern)) {
                logDebug('pollingProvider', '_fileWatcherGotFile', 'file does not match pattern. skipping.');
                return;
            }

            const date = new Date();
            const monthArchive = date.getFullYear() + '-' + ("0" + (date.getMonth() + 1)).slice(-2);
            const archivePath = path.join(parsedFile.dir, 'archive', monthArchive);
            if (!fs.existsSync(archivePath)) {
                logDebug('pollingProvider', '_fileWatcherGotFile', 'archive path not existing. creating.');
                fs.mkdirSync(archivePath, { recursive: true });
            }
        
            logInfo('pollingProvider', '_fileWatcherGotFile', 'processing file ' + file);
            let dayClosingData = data;
            if (fileEncoding) {
                dayClosingData = encoding.convert(dayClosingData, 'utf-8', fileEncoding);
            }
            
            restClientInstance.reportTrackingFile(this.code, dayClosingData.toString()).then((response) => {
                if (!response.success) {
                    return;
                }

                const archiveFileName = path.join(archivePath, parsedFile.base + '.' + Date.now() + '.done');
                logInfo('pollingProvider', '_fileWatcherGotFile', 'file processed successfully. moving to archive. ' + archiveFileName);
                fs.renameSync(file, archiveFileName);
            }).catch(console.log);
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
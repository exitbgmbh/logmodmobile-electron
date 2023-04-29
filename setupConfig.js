const app = require('electron').app;
const fs = require('fs');
const path = require('path');
const {logDebug, logInfo} = require('./src/logging');

const defaultConfig = new Buffer(`{
    "app": {
        "url": "https://your-logmod-mobile-instance-url",
        "autoUpdateCheckInterval": 600,
        "heartbeatInterval": 5,
        "gsPrintExecutable": "/bin/echo",
    },
    "scale": {
        "type": "None",
        "path": "/dev/ttyUSB0",
        "baud": 9600,
        "command": [],
        "parserDelimiter": []
    },
    "invoicing": {
        "directPrinting": false,
        "watchBoxes": "$x"
    },
    "shipping": {
        "DPD": {
            "printing": {
                "shipmentLabelPrinter": "PDF",
                "rotate": true
            }
        },
        "DHL": {
            "polling": {
                "fileExport": {
                    "path": "PATH",
                    "pattern": "Poll-{COUNTER}.csv",
                    "encoding": "iso-8859-1"
                },
                "fileImport": {
                    "path": "PATH",
                    "pattern": "^ELSendEx.*.txt$",
                    "encoding": "utf-8"
                }
            }
        }
    },
    "printing": {
        "defaultInvoiceSlipPrinter": "PDF",
        "defaultInvoiceSlipPrinterMode": "monochrome",
        "defaultDeliverySlipPrinter": "PDF",
        "defaultDeliverySlipPrinterMode": "monochrome",
        "defaultReturnSlipPrinter": "PDF",
        "defaultReturnSlipPrinterMode": "monochrome",
        "defaultShipmentLabelPrinter": "PDF",
        "defaultShipmentLabelPrinterMode": "monochrome",
        "defaultProductLabelPrinter": "PDF",
        "defaultProductLabelPrinterMode": "monochrome",
        "defaultAdditionalDocumentPrinter": "PDF",
        "defaultAdditionalDocumentPrinterMode": "monochrome",
    
        "requestInvoiceDocumentsMerged": true,
    
        "rotateProductLabel": true,
    
        "printProductLabelRAW": false,
        "productLabelRAWTemplate": "N\\nS4\\nD15\\nq400\\nR\\nB10,10,0,1,3,20,100,N,\\"{%barcode}\\"\\nA10,150,0,1,3,3,N,\\"{%barcode}\\"\\nP{%quantity}\\n",
    
        "printAdditionalDocuments": false,
        "additionalDocumentUrl": "",
    
        "printShippingRequestPackageLabel": false,
        "shippingRequestPackageLabelRAWTemplate": "N\\nS4\\nD15\\nq400\\nR\\nB10,10,0,1,3,20,100,N,\\"{%packageId}\\"\\nA10,150,0,1,3,3,N,\\"{%packageId}\\"\\nP1\\n",
    
        "autoPrintMultiPackageSupplyNote": false,
        "alwaysPrintMultiPackageSupplyNote": false,
        "requestMultiPackageSupplyNoteOnDemand": false,
    
        "defaultInvoiceSlipPrintCountCC": 1,
        "defaultInvoiceSlipPrintCountEU": 1,
        "defaultInvoiceSlipPrintCountTC": 3,
        "advertisingMediumConfig": {
            "EXB": {
                "invoiceSlipPrinter": "PDF",
                "invoiceSlipPrinterMode": "monochrome",
                "deliverySlipPrinter": "PDF",
                "deliverySlipPrinterMode": "monochrome",
                "returnSlipPrinter": "PDF",
                "returnSlipPrinterMode": "monochrome",
                "invoiceSlipPrintCountCC": 1,
                "invoiceSlipPrintCountEU": 1,
                "invoiceSlipPrintCountTC": 3
            }
        }
    }
}`);


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
    const fileDestination = getApplicationConfigFile();
    logDebug('setupConfig', 'setupConfig::fileDestination', fileDestination);

    fs.writeFileSync(fileDestination, defaultConfig);
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

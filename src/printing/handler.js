const config = require('config');
const eventEmitter = require('./../websocket/eventEmitter');
const restClientInstance = require('./../restClient');
const tmp = require('tmp');
const fs = require('fs');
const printer = require('pdf-to-printer');
const getPrinter = require('./printer');
const { logDebug } = require('./../logging');

class PrintingHandler
{
    initialize = () => {
        if (!config.has('printing')) {
            throw new Error('no printing defined in config. invalid config?')
        }

        this._registerEventListener();
    };

    _registerEventListener = () => {
        eventEmitter.on('print', this.requestDocuments);
    };

    printShipmentLabel = (data) => {

    };

    requestDocuments = (data) => {
        if (!data || !data.hasOwnProperty('documentType')) {
            return;
        }

        switch(data.documentType.toUpperCase()) {
            case 'PRODUCTLABEL': {
                if (!data.hasOwnProperty('productEan')) {
                    this._handleError(new Error('invalid data, no ean number given'));
                    return;
                }

                restClientInstance.requestProductLabel(data.productEan, data.templateId).then((response) => {
                    this._handleProductLabelPrinting(response.response.content, data.quantity);
                }).catch(this._handleError);
                break;
            }
            case 'INVOICE': {
                if (!data.hasOwnProperty('invoiceNumber')) {
                    this._handleError(new Error('invalid data, no invoice number given'));
                    return;
                }

                restClientInstance.requestInvoiceDocument(data.invoiceNumber).then((response) => {
                    this._handleDocumentPrinting('invoice', response.response, response.response.content)
                }).catch(this._handleError);
                break;
            }
            case 'DELIVERY': {
                if (!data.hasOwnProperty('invoiceNumber')) {
                    this._handleError(new Error('invalid data, no invoice number given'));
                    return;
                }

                restClientInstance.requestDeliverySlipDocument(data.invoiceNumber).then((response) => {
                    this._handleDocumentPrinting('delivery', response.response, response.response.content)
                }).catch(this._handleError);
                break;
            }
            case 'RETURN': {
                if (!data.hasOwnProperty('invoiceNumber')) {
                    this._handleError(new Error('invalid data, no invoice number given'));
                    return;
                }

                restClientInstance.requestReturnSlipDocument(data.invoiceNumber).then((response) => {
                    this._handleDocumentPrinting('return', response.response, response.response.content)
                }).catch(this._handleError);
                break;
            }
            case 'ALLDOCS': {
                if (!data.hasOwnProperty('invoiceNumber')) {
                    this._handleError(new Error('invalid data, no invoice number given'));
                    return;
                }

                restClientInstance.requestAllDocuments(data.invoiceNumber).then((response) => {
                    this._handleDocumentPrinting('invoice', response.response, response.response.invoicePdf);
                    this._handleDocumentPrinting('delivery', response.response, response.response.deliverySlipPdf);
                    this._handleDocumentPrinting('return', response.response, response.response.returnSlipPdf);
                }).catch(this._handleError);
                break;
            }
        }
    };

    _handleError = (err) => {
        console.log('error', err);
    };

    _handleProductLabelPrinting = (contentToPrint, numberOfCopies) => {
        if (!contentToPrint || contentToPrint.length < 100) {
            return;
        }

        const tmpFile = tmp.fileSync({prefix: 'logmodmobile_'});
        const documentEncoded = Buffer.from(contentToPrint, 'base64');
        fs.writeFileSync(tmpFile.name, documentEncoded);

        let options = {};
        const printerConfig = getPrinter('productLabel');
        if (printerConfig.printer) {
            options.printer = printerConfig.printer;
        }

        if (numberOfCopies) {
            options.unix = ['-n ' + numberOfCopies, '-o scaling=100'];
            options.win32 = ['-print-settings "' + numberOfCopies + 'x"'];
        }

        logDebug('printingHandler', '_handleProductLabelPrintering', 'start printing with options ' + JSON.stringify(options));
        printer.print(tmpFile.name, options).then(console.log).catch(console.log);
    };

    _handleDocumentPrinting = (type, data, contentToPrint) => {
        if (!contentToPrint || contentToPrint.length < 100) {
            return;
        }

        const tmpFile = tmp.fileSync({prefix: 'logmodmobile_'});
        const documentEncoded = Buffer.from(contentToPrint, 'base64');
        fs.writeFileSync(tmpFile.name, documentEncoded);

        let options = {};
        const printerConfig = getPrinter(type, data.advertisingMedium, data.deliveryCountry, data.isEU);
        if (printerConfig.printer) {
            options.printer = printerConfig.printer;
        }

        if (printerConfig.numOfCopies) {
            options.unix = ['-n ' + printerConfig.numOfCopies];
            options.win32 = ['-print-settings "' + printerConfig.numOfCopies + 'x"'];
        }

        logDebug('printingHandler', '_handleProductLabelPrintering', 'start printing with options ' + JSON.stringify(options));
        printer.print(tmpFile.name, options).then(console.log).catch(console.log);
    };
}

module.exports = PrintingHandler;
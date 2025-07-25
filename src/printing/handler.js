const config = require('config');
const eventEmitter = require('./../websocket/eventEmitter');
const restClientInstance = require('./../restClient');
const tmp = require('tmp');
const fs = require('fs');
const printer = require('@grandchef/node-printer')
const {isLinux, isWindows} = require('../helper')
const {getDocumentPrinter, getProductLabelPrinter, getShipmentLabelPrinter, getRawLabelPrinter} = require('./printer');
const {logDebug, logWarning} = require('./../logging');
const { exec } = require("child_process");

const printProductLabelRAW = config.has('printing.printProductLabelRAW') && config.get('printing.printProductLabelRAW') || false;
const productLabelRAWTemplate = printProductLabelRAW ? config.get('printing.productLabelRAWTemplate') : '';
const printShippingRequestPackageLabelRaw = config.has('printing.printShippingRequestPackageLabelRaw') && config.get('printing.printShippingRequestPackageLabelRaw') || false;
const shippingRequestPackageLabelRAWTemplate = printShippingRequestPackageLabelRaw ? config.get('printing.shippingRequestPackageLabelRAWTemplate') : '';
const printAdditionalDocumentsFirst = config.has('printing.printAdditionalDocumentsFirst') && config.get('printing.printAdditionalDocumentsFirst') === true;
// EPL2 Guide: https://www.servopack.de/support/zebra/EPL2_Manual.pdf

function pdfPrinter() {
    if (isWindows()) {
        return require('pdf-to-printer');
    }
    if (isLinux()) {
        return require('unix-print');
    }

    throw new Error(`unsupported platform. ${process.platform}`)
}

function labelPrinter() {
    return printer;
}

class PrintingHandler {
    /**
     * list of all created temporary files in this session
     * need this to cleanup when application is shut down
     *
     * @type {[{string}]}
     */
    createdFilesCache = [];

    initialized = false;

    /**
     * initializes the handler
     */
    initialize = () => {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        if (!config.has('printing')) {
            throw new Error('no printing defined in config. invalid config?')
        }

        this._registerEventListener();
    };

    /**
     * cleaning up all temporary created files
     */
    cleanup = () => {
        this.createdFilesCache.forEach((file) => {
            try {
                fs.unlinkSync(file)
            } catch {
            }
        });
    };

    /**
     * all events we are listening for
     *
     * @private
     */
    _registerEventListener = () => {
        eventEmitter.on('requestDocuments', this._requestDocuments);
        eventEmitter.on('invoiceCreationSuccess', this._printInvoiceCreationResultDocuments);
        eventEmitter.on('shipmentLabelPrint', this._handleShipmentLabelPrinting);
        eventEmitter.on('shipmentRawPrint', this._handleRawLabelPrinting);
        eventEmitter.on('pickListNeedsAdditionalDocuments', this._requestAdditionalPickListDocuments);
        eventEmitter.on('multiPackageSupplyNotePrint', this._requestMultiPackageSupplyNote);
    };

    /**
     * printing invoices got from invoice handler
     *
     * @param {{advertisingMediumCode:string, deliveryCountryCode: string, deliveryCountryIsEu: boolean, base64encodedInvoice: string, base64encodedDeliverySlip:string, base64encodedReturnSlip: string}} data
     * @private
     */
    _printInvoiceCreationResultDocuments = (data) => {
        const resultData = {
            advertisingMedium: data.advertisingMediumCode,
            deliveryCountry: data.deliveryCountryCode,
            isEU: data.deliveryCountryIsEu
        };

        if (data.hasOwnProperty('base64encodedInvoice') && data.base64encodedInvoice) {
            this._handleDocumentPrinting('invoice', resultData, data.base64encodedInvoice);
        }

        if (data.hasOwnProperty('base64encodedDeliverySlip') && data.base64encodedDeliverySlip) {
            this._handleDocumentPrinting('delivery', resultData, data.base64encodedDeliverySlip);
        }

        if (data.hasOwnProperty('base64encodedReturnSlip') && data.base64encodedReturnSlip) {
            this._handleDocumentPrinting('return', resultData, data.base64encodedReturnSlip);
        }
    };

    _requestMultiPackageSupplyNote = (data) => {
        const { identification : invoiceNumber, force, packageData } = data; // invoice number
        logDebug('printingHandler', '_requestMultiPackageSupplyNote', `requesting ${invoiceNumber} forced ${force}`);

        if (packageData) {
            if (!config.has('printing.requestMultiPackageSupplyNoteOnDemand') || !config.get('printing.requestMultiPackageSupplyNoteOnDemand')) {
                logDebug('printingHandler', '_requestMultiPackageSupplyNote', 'canceling request due to requestOnDemand is not activated');
                return;
            }

            restClientInstance.requestMultiPackageSupplyNote(invoiceNumber, JSON.stringify(packageData)).then((response) => {
                this._handleDocumentPrinting('delivery', response.response, response.response.packageSupplyNote)
            }).catch(this._handleError);
        } else {
            // force means, the request is triggered manually
            if (!force) {
                if (!config.has('printing.autoPrintMultiPackageSupplyNote') || !config.get('printing.autoPrintMultiPackageSupplyNote')) {
                    logDebug('printingHandler', '_requestMultiPackageSupplyNote', 'canceling request due to autoprinting not enabled');
                    return;
                }

                // if only one package created, option 'alwaysPrintMultiPackageSupplyNote' needs to be true to trigger print
                const numberOfPackages = 1;
                if (numberOfPackages === 1 && (!config.has('printing.alwaysPrintMultiPackageSupplyNote') || !config.get('printing.alwaysPrintMultiPackageSupplyNote'))) {
                    logDebug('printingHandler', '_requestMultiPackageSupplyNote', 'canceling request due to single package');
                    return;
                }

                // if requestMultiPackageSupplyNoteOnDemand is configured and set to 'true' we have had printed the document before. so we don't want it to be printed again
                if (config.has('printing.requestMultiPackageSupplyNoteOnDemand') && config.get('printing.requestMultiPackageSupplyNoteOnDemand')) {
                    logDebug('printingHandler', '_requestMultiPackageSupplyNote', 'canceling request due to requestOnDemand is activated');
                    return;
                }
            }

            restClientInstance.requestShippingRequestPackages(invoiceNumber).then(async (shippingRequestPackages) => {
                if (!Array.isArray(shippingRequestPackages)) {
                    return;
                }

                for (let i = 0; i < shippingRequestPackages.length; i++) {
                    const pkg = shippingRequestPackages[i];
                    try {
                        const res = await restClientInstance.requestMultiPackageSupplyNote(invoiceNumber, pkg.id)
                        this._handleDocumentPrinting('delivery', res.response, res.response.packageSupplyNote)
                    } catch (e) {
                        this._handleError(e)
                    }

                }
            });
        }
    }

    /**
     *
     * @param {{pickListNumber: string, pickListId: int, pickListType: int}} data
     * @private
     */
    _requestAdditionalPickListDocuments = (data) => {
        logDebug('printingHandler', '_requestAdditionalPickListDocuments', JSON.stringify(data));
        if (!data || !data.pickListNumber || !data.pickListType || data.pickListType === 1) {
            return;
        }

        switch (data.pickListType) {
            case 2: {
                // relocation list
                restClientInstance.requestRelocationDocuments(data.pickListNumber).then((response) => {
                    this._handleDocumentPrinting('invoice', response.response, response.response.relocationPdf)
                }).catch(this._handleError);
                break;
            }
            case 4: {
                // repair cases
                restClientInstance.requestRepairCaseDocuments(data.pickListNumber).then((response) => {
                    this._handleDocumentPrinting('invoice', response.response, response.response.repairCasePdf)
                }).catch(this._handleError);
                break;
            }
            case 3:
            default: {
                // replenishment
                break;
            }

        }
    }

    /**
     * requesting documents from blisstribute and print them
     *
     * @param {{productEan:string, templateId:int, invoiceNumber:string}} data
     *
     * @private
     */
    _requestDocuments = (data) => {
        if (!data || !data.hasOwnProperty('documentType')) {
            return;
        }

        switch (data.documentType.toUpperCase()) {
            case 'REPAIRCASECOVERLETTER': {
                if (!data.hasOwnProperty('pickBox')) {
                    this._handleError(new Error('invalid data, no pick box given'));
                    return;
                }

                restClientInstance.requestRepairCaseDocuments(data.pickBox).then((response) => {
                    this._handleDocumentPrinting('additional', response.response, response.response.repairCasePdf)
                }).catch(this._handleError);
                break;
            }
            case 'RELOCATIONPROOF': {
                if (!data.hasOwnProperty('pickBox')) {
                    this._handleError(new Error('invalid data, no pick box given'));
                    return;
                }

                restClientInstance.requestRelocationDocuments(data.pickBox).then((response) => {
                    this._handleDocumentPrinting('additional', response.response, response.response.relocationPdf)
                }).catch(this._handleError);
                break;
            }
            case 'PRODUCTLABEL': {
                if (!data.hasOwnProperty('productEan')) {
                    this._handleError(new Error('invalid data, no ean number given'));
                    return;
                }

                restClientInstance.requestProductLabel(data.productEan, data.templateId).then((response) => {
                    this._handleProductLabelPrinting(response.response, data.quantity);
                }).catch(this._handleError);
                break;
            }
            case 'SHIPPINGREQUESTPACKAGELABEL': {
                if (!data.hasOwnProperty('shippingRequestPackageNumber')) {
                    this._handleError(new Error('invalid data, no shipping request package number given'));
                    return;
                }

                restClientInstance.requestShippingRequestPackageLabel(data.shippingRequestPackageNumber).then((response) => {
                    this._handleShippingRequestPackageLabelPrinting(response.response, data.quantity);
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

                if (config.has('printing.requestInvoiceDocumentsMerged') && config.get('printing.requestInvoiceDocumentsMerged') === true) {
                    restClientInstance.requestMergedDocuments(data.invoiceNumber).then((response) => {
                        if (printAdditionalDocumentsFirst) {
                            this._handleAdditionalDocumentPrinting(response.response);
                        }
                        this._handleDocumentPrinting('invoiceMerge', response.response, response.response.mergedDocumentsPdf);

                        if (!printAdditionalDocumentsFirst) {
                            this._handleAdditionalDocumentPrinting(response.response);
                        }
                    }).catch(this._handleError);
                } else {
                    restClientInstance.requestAllDocuments(data.invoiceNumber).then((response) => {
                        if (printAdditionalDocumentsFirst) {
                            this._handleAdditionalDocumentPrinting(response.response);
                        }

                        this._handleDocumentPrinting('invoice', response.response, response.response.invoicePdf);
                        this._handleDocumentPrinting('delivery', response.response, response.response.deliverySlipPdf);
                        this._handleDocumentPrinting('return', response.response, response.response.returnSlipPdf);

                        if (!printAdditionalDocumentsFirst) {
                            this._handleAdditionalDocumentPrinting(response.response);
                        }
                    }).catch(this._handleError);
                }
                break;
            }
        }
    };

    _handleAdditionalDocumentPrinting = (response) => {
        if (!config.has('printing.printAdditionalDocuments') || config.get('printing.printAdditionalDocuments') === false) {
            return;
        }

        if (!config.has('printing.additionalDocumentUrl')) {
            return;
        }

        const additionalDocumentUrl = config.get('printing.additionalDocumentUrl');
        if (!additionalDocumentUrl.length) {
            return;
        }

        logDebug('printingHandler', '_requestDocuments', 'requesting' + additionalDocumentUrl + response.orderNumber);
        restClientInstance.requestAdditionalDocument(additionalDocumentUrl, response.orderNumber).then((responseBlob) => {
            logDebug('printingHandler', '_requestDocuments', 'got additional response');
            responseBlob.arrayBuffer().then((buffer) => {
                this._handleDocumentPrinting('additional', {}, buffer, false);
            });
        }).catch((err) => {
            logWarning('printingHandler', '_requestDocuments', 'got error' + err);
        })
    };

    /**
     * printing error handler
     *
     * @param {Error} err
     *
     * @private
     */
    _handleError = (err) => {
        console.log('error', err);
    };

    /**
     * helper method to save base64encoded file content to temporary files
     *
     * @param {string} contentToPrint
     * @param {boolean} isBase64
     *
     * @returns {string}
     *
     * @private
     */
    _saveResultToPdf = (contentToPrint, isBase64 = true) => {
        const tmpFile = tmp.fileSync({prefix: 'ellmm_', postfix: '.pdf'});
        const encoding = isBase64 ? 'base64' : 'utf-8';
        const documentEncoded = Buffer.from(contentToPrint, encoding);
        fs.writeFileSync(tmpFile.name, documentEncoded);

        this.createdFilesCache.push(tmpFile.name);

        return tmpFile.name;
    };

    /**
     * printing a document
     *
     * @param {string} type
     * @param {{advertisingMedium:string, deliveryCountry:string, isEU: boolean}} data
     * @param {string} contentToPrint
     * @param {boolean} isBase64
     * @private
     */
    _handleDocumentPrinting = (type, data, contentToPrint, isBase64 = true) => {
        if (!contentToPrint || contentToPrint.length < 100) {
            return;
        }

        const tmpFileName = this._saveResultToPdf(contentToPrint, isBase64);

        const printerConfig = getDocumentPrinter(type, data.advertisingMedium, data.deliveryCountry, data.isEU);
        const printingOptions = this._getOptionsForPrinting(printerConfig);

        logDebug('printingHandler', '_handleDocumentPrinting', 'start printing with options ' + JSON.stringify(printingOptions));
        if (isWindows()) {
            pdfPrinter().print(tmpFileName, printingOptions).then((r) => {
                console.log('after print', r);
                if (
                    process.env.NODE_ENV === 'development' &&
                    config.has('printing.debugAutoOpenDocumentAfterPrint') &&
                    config.get('printing.debugAutoOpenDocumentAfterPrint')
                ) {
                    exec('xdg-open ' + tmpFileName);
                }
            }).catch(console.log);
        } else {
            pdfPrinter().print(tmpFileName, printingOptions.printer).then((r) => {
                console.log('after print', r);
                if (
                    process.env.NODE_ENV === 'development' &&
                    config.has('printing.debugAutoOpenDocumentAfterPrint') &&
                    config.get('printing.debugAutoOpenDocumentAfterPrint')
                ) {
                    exec('xdg-open ' + tmpFileName);
                }
            }).catch(console.log);
        }
    };

    _handleRawPrint = (printerName, command) => {
        logDebug('printingHandler', '_handleRawPrint', `started for printer ${printerName} with command ${command}`)
        labelPrinter().printDirect({
            data: command,
            printer: printerName,
            type: "RAW",
            success:function() {
                logDebug('printingHandler', '_handleRawPrint', 'succeed');
            },
            error:function(err) {
                logWarning('printingHandler', '_handleRawPrint', `printing failed with error ${err}`);
            }
        });
    }

    _handleRawLabelPrinting = (data) => {
        const printerName = getRawLabelPrinter(data.shipmentTypeCode);
        this._handleRawPrint(printerName, data.command)
    }

    printDirectRaw = (printerName, command) => {
        this._handleRawPrint(printerName, command)
    };

    productLabelPrintRaw = (printerName, template, numberOfCopies, ean13, price, articleNumber, classification1, classification2) => {
        const command = template
        .replaceAll('{%quantity}', numberOfCopies.toString())
        .replaceAll('{%barcode}', ean13)
        .replaceAll('{%articleNumber}', articleNumber)
        .replaceAll('{%price}', price)
        .replaceAll('{%classification1}', classification1)
        .replaceAll('{%classification2}', classification2);

        this._handleRawPrint(printerName, command)
    };

    shippingRequestPackageLabelPrintRaw = (printerName, template, numberOfCopies, shippingRequestPackageNumber, shippingRequestNumber) => {
        const command = template
        .replaceAll('{%quantity}', numberOfCopies.toString())
        .replaceAll('{%packageId}', shippingRequestPackageNumber)
        .replaceAll('{%shippingRequest}', shippingRequestNumber);

        console.log('foooooo', printerName, command)

        this._handleRawPrint(printerName, command)
    };

    /**
     * printing product label
     *
     * @param {{}} responseData
     * @param {int} numberOfCopies
     *
     * @private
     */
    _handleProductLabelPrinting = (responseData, numberOfCopies) => {
        logDebug('printingHandler', '_handleProductLabelPrinting', 'start printing with options ' + JSON.stringify(responseData));
        const {content: labelContent, ean13, price, articleNumber, classification1, classification2} = responseData;
        if (!labelContent || labelContent.length < 100) {
            return;
        }
        const printerConfig = getProductLabelPrinter(numberOfCopies);
        if (printProductLabelRAW) {
            return this.productLabelPrintRaw(printerConfig.printer, productLabelRAWTemplate, numberOfCopies, ean13, price, articleNumber, classification1, classification2);
        }

        const tmpFileName = this._saveResultToPdf(labelContent);
        const printingOptions = this._getOptionsForPrinting(printerConfig, numberOfCopies);

        logDebug('printingHandler', '_handleProductLabelPrinting', 'start printing with options ' + JSON.stringify(printingOptions));
        pdfPrinter().print(tmpFileName, printingOptions).then(console.log).catch(console.log);
    };

    /**
     * printing product label
     *
     * @param {{}} responseData
     * @param {int} numberOfCopies
     *
     * @private
     */
    _handleShippingRequestPackageLabelPrinting = (responseData, numberOfCopies = 1) => {
        logDebug('printingHandler', '_handleShippingRequestPackageLabelPrinting', 'start printing with options ' + JSON.stringify(responseData));
        const {content: labelContent, shippingRequestPackageNumber, shippingRequestNumber} = responseData;
        if (!labelContent || labelContent.length < 100) {
            return;
        }
        const printerConfig = getProductLabelPrinter(numberOfCopies);
        if (printShippingRequestPackageLabelRaw) {
            return this.shippingRequestPackageLabelPrintRaw(printerConfig.printer, shippingRequestPackageLabelRAWTemplate, numberOfCopies, shippingRequestPackageNumber, shippingRequestNumber);
        }

        const tmpFileName = this._saveResultToPdf(labelContent);
        const printingOptions = this._getOptionsForPrinting(printerConfig);

        logDebug('printingHandler', '_handleShippingRequestPackageLabelPrinting', 'start printing with options ' + JSON.stringify(printingOptions));
        pdfPrinter().print(tmpFileName, printingOptions).then(console.log).catch(console.log);
    };

    /**
     * printing labels got from shipping handler
     *
     * @param {{shipmentTypeCode:string, shipmentLabelCollection: [{packageId:string, trackingId:string, shipmentLabel:string, returnLabel:string}]}} data
     *
     * @private
     */
    _handleShipmentLabelPrinting = (data) => {
        const printerConfig = getShipmentLabelPrinter(data.shipmentTypeCode);
        const printingOptions = this._getOptionsForPrinting(printerConfig);

        data.shipmentLabelCollection.forEach((label) => {
            if (label.shipmentLabel && label.shipmentLabel.trim() !== '') {
                let shipmentTmpFile = this._saveResultToPdf(label.shipmentLabel);

                logDebug('printingHandler', '_handleShipmentLabelPrinting', 'start printing with options ' + JSON.stringify(printingOptions));
                pdfPrinter().print(shipmentTmpFile, printingOptions).then(console.log).catch(console.log);
            }

            if (label.returnLabel && label.returnLabel.trim() !== '') {
                let returnTmpFile = this._saveResultToPdf(label.returnLabel);
                logDebug('printingHandler', '_handleShipmentLabelPrinting', 'start printing with options ' + JSON.stringify(printingOptions));
                pdfPrinter().print(returnTmpFile, printingOptions).then(console.log).catch(console.log);
            }
        });
    };

    /**
     * map printer configuration to pdf-to-printer options
     *
     * @param {{}} printerConfig
     * @param {int} numberOfCopies
     * @returns {{}}
     * @private
     */
    _getOptionsForPrinting = (printerConfig, numberOfCopies = 1) => {
        const options = {}
        if (printerConfig.printer) {
            options.printer = printerConfig.printer;
        }

        options.copies = numberOfCopies;
        if (printerConfig.numberOfCopies && printerConfig.numberOfCopies > numberOfCopies) {
            options.copies = printerConfig.numberOfCopies;
        }

        if (isWindows()) {
            if (printerConfig.color) { // nothing to do, this is default
                logDebug('printingHandler', '_getOptionsForPrinting', `color printing ${printerConfig.color}`);
                options.monochrome = !printerConfig.color
            }

            if (printerConfig.monochrome) {
                logDebug('printingHandler', '_getOptionsForPrinting', `monochrome printing ${printerConfig.monochrome}`);
                options.monochrome = printerConfig.monochrome
            }

            if (printerConfig.rotate) {
                logDebug('printingHandler', '_getOptionsForPrinting', 'rotated printing');
                options.orientation = 'landscape'
            }

            if (printerConfig.bin) {
                logDebug('printingHandler', '_getOptionsForPrinting', `using printer bin ${printerConfig.bin}`);
                options.bin = printerConfig.bin
            }

            if (printerConfig.paper) {
                logDebug('printingHandler', '_getOptionsForPrinting', `using paperSize ${printerConfig.paper}`);
                options.paperSize = printerConfig.paper
            }

        }

        return options;
    }

}

module.exports = PrintingHandler;

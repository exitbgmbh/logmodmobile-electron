const config = require('config');
const eventEmitter = require('./../websocket/eventEmitter');
const restClientInstance = require('./../restClient');
const tmp = require('tmp');
const fs = require('fs');
const printer = require('pdf-to-printer');
const { getDocumentPrinter, getProductLabelPrinter, getShipmentLabelPrinter } = require('./printer');
const {logDebug} = require('./../logging');
const pdftk = require('node-pdftk');
pdftk.configure({
  bin: config.has('app.pdfTkExecutable') ? config.get('app.pdfTkExecutable') : 'pdftk'
});

class PrintingHandler {
  /**
   * list of all created temporary files in this session
   * need this to cleanup when application is shut down
   *
   * @type {[{string}]}
   */
  createdFilesCache = [];

  /**
   * initializes the handler
   */
  initialize = () => {
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
        } catch { }
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
    eventEmitter.on('shipmentLabelPrint', this._handleShipmentLabelPrinting)
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
   *
   * @returns {string}
   *
   * @private
   */
  _saveResultToPdf = (contentToPrint) => {
    const tmpFile = tmp.fileSync({prefix: 'ellmm_', postfix: '.pdf'});
    const documentEncoded = Buffer.from(contentToPrint, 'base64');
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
   * @private
   */
  _handleDocumentPrinting = (type, data, contentToPrint) => {
    if (!contentToPrint || contentToPrint.length < 100) {
      return;
    }

    const tmpFileName = this._saveResultToPdf(contentToPrint);

    let options = {};
    const printerConfig = getDocumentPrinter(type, data.advertisingMedium, data.deliveryCountry, data.isEU);
    if (printerConfig.printer) {
      options.printer = printerConfig.printer;
    }

    if (printerConfig.numOfCopies) {
      options.unix = ['-n ' + printerConfig.numOfCopies];
      options.win32 = ['-print-settings "' + printerConfig.numOfCopies + 'x"'];
    }

    logDebug('printingHandler', '_handleDocumentPrinting', 'start printing with options ' + JSON.stringify(options));
    printer.print(tmpFileName, options).then(console.log).catch(console.log);
  };

  _printRotated = (sourceFileName, printingOptions) => {
    const rotatedFileName = '/tmp/foobar_rotated.pdf';
    pdftk
      .input(sourceFileName)
      .cat('1-endWest')
      .output(rotatedFileName)
      .then((res) => {
        console.log('pdftkres', res);
        this.createdFilesCache.push(rotatedFileName);
        printer.print(rotatedFileName, printingOptions).then(console.log).catch(console.log);
      })
      .catch((err) => {
        console.log('pdftkerror', err);
      });
  };

  /**
   * printing product label
   *
   * @param {string} contentToPrint
   * @param {int} numberOfCopies
   *
   * @private
   */
  _handleProductLabelPrinting = (contentToPrint, numberOfCopies) => {
    if (!contentToPrint || contentToPrint.length < 100) {
      return;
    }

    const tmpFileName = this._saveResultToPdf(contentToPrint);

    let options = {};
    const printerConfig = getProductLabelPrinter();
    if (printerConfig.printer) {
      options.printer = printerConfig.printer;
    }

    if (numberOfCopies) {
      options.unix = ['-n ' + numberOfCopies, '-o scaling=100'];
      options.win32 = ['-print-settings "' + numberOfCopies + 'x"'];
    }

    logDebug('printingHandler', '_handleProductLabelPrinting', 'start printing with options ' + JSON.stringify(options));
    if (printerConfig.rotate) {
      this._printRotated(tmpFileName, options);
    } else {
      printer.print(tmpFileName, options).then(console.log).catch(console.log);
    }
  };

  /**
   * printing labels got from shipping handler
   *
   * @param {{shipmentTypeCode:string, shipmentLabelCollection: [{packageId:string, trackingId:string, shipmentLabel:string, returnLabel:string}]}} data
   *
   * @private
   */
  _handleShipmentLabelPrinting = (data) => {
    let options = {};
    const printerConfig = getShipmentLabelPrinter(data.shipmentTypeCode);
    if (printerConfig.printer) {
      options.printer = printerConfig.printer;
    }

    data.shipmentLabelCollection.forEach((label) => {
      if (label.shipmentLabel && label.shipmentLabel.trim() !== '') {
        let shipmentTmpFile = this._saveResultToPdf(label.shipmentLabel);
        if (printerConfig.rotate) {
          this._printRotated(shipmentTmpFile, options);
        } else {
          printer.print(shipmentTmpFile, options).then(console.log).catch(console.log);
        }
      }

      if (label.returnLabel && label.returnLabel.trim() !== '') {
        let returnTmpFile = this._saveResultToPdf(label.returnLabel);
        if (printerConfig.rotate) {
          this._printRotated(returnTmpFile, options);
        } else {
          printer.print(returnTmpFile, options).then(console.log).catch(console.log);
        }
      }
    });
  };
}

module.exports = PrintingHandler;
const config = require('config');
const eventEmitter = require('./../websocket/eventEmitter');
const restClientInstance = require('./../restClient');
const tmp = require('tmp');
const fs = require('fs');
const printer = require('pdf-to-printer');
const getDocumentPrinter = require('./printer');
const {logDebug} = require('./../logging');

class PrintingHandler {
  createdFilesCache = [];

  initialize = () => {
    if (!config.has('printing')) {
      throw new Error('no printing defined in config. invalid config?')
    }

    this._registerEventListener();
  };

  cleanup = () => {
    this.createdFilesCache.forEach((file) => {
        try {
            fs.unlinkSync(file)
        } catch { }
    });
  };

  _registerEventListener = () => {
    eventEmitter.on('requestDocuments', this.requestDocuments);
    eventEmitter.on('invoiceCreationSuccess', this.printInvoiceCreationResultDocuments);
  };

  printShipmentLabel = (data) => {

  };

  printInvoiceCreationResultDocuments = (data) => {
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

  requestDocuments = (data) => {
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

  _handleError = (err) => {
    console.log('error', err);
  };

  _saveResultToPdf = (contentToPrint) => {
    const tmpFile = tmp.fileSync({prefix: 'ellmm_', postfix: '.pdf'});
    const documentEncoded = Buffer.from(contentToPrint, 'base64');
    fs.writeFileSync(tmpFile.name, documentEncoded);

    this.createdFilesCache.push(tmpFile.name);

    return tmpFile.name;
  };

  _handleProductLabelPrinting = (contentToPrint, numberOfCopies) => {
    if (!contentToPrint || contentToPrint.length < 100) {
      return;
    }

    const tmpFileName = this._saveResultToPdf(contentToPrint);

    let options = {};
    const printerConfig = getDocumentPrinter('productLabel');
    if (printerConfig.printer) {
      options.printer = printerConfig.printer;
    }

    if (numberOfCopies) {
      options.unix = ['-n ' + numberOfCopies, '-o scaling=100'];
      options.win32 = ['-print-settings "' + numberOfCopies + 'x"'];
    }

    logDebug('printingHandler', '_handleProductLabelPrintering', 'start printing with options ' + JSON.stringify(options));
    printer.print(tmpFileName, options).then(console.log).catch(console.log);
  };

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
}

module.exports = PrintingHandler;
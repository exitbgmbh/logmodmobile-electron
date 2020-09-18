const { logDebug } = require('./../logging');
const config = require('config');
const printer = require('pdf-to-printer');

let printerList = [];
printer.getPrinters().then(res => printerList = res);

let defaultPrinter = '';
printer.getDefaultPrinter().then(res => defaultPrinter = res.trim());

/**
 * checks if given printer name is existent in system
 * if not, the system default printer will be returned
 *
 * @param {string} printerName
 *
 * @returns {string}
 *
 * @private
 */
_checkPrinterAndCorrect = (printerName) => {
  if (printerList.indexOf(printerName) === -1) {
    return defaultPrinter;
  }

  return printerName;
};

/**
 * checks if given key is available and configured
 *
 * @param {string} printerKey
 *
 * @returns {boolean}
 *
 * @private
 */
_checkPrinterKey = (printerKey) => {
  if (!config.has(printerKey)) {
    return false;
  }

  const printerConfig = config.get(printerKey);
  return printerConfig && printerConfig.trim() !== '';
};

/**
 * evaluates the printer and printer settings for given documentType
 *
 * @param {string} documentType
 * @param {string} advertisingMedium
 * @param {string} deliveryCountryCode
 * @param {boolean} deliveryCountryIsEU
 *
 * @returns {{numOfCopies: number, printer: string}}
 *
 */
getDocumentPrinter = (documentType, advertisingMedium = '', deliveryCountryCode= '', deliveryCountryIsEU = false) => {
  logDebug('printer', 'getDocumentPrinter', JSON.stringify({documentType, advertisingMedium, deliveryCountryIsEU, deliveryCountryCode}));
  let printerConfig = {};
  switch(documentType.toUpperCase()) {
    case 'INVOICE': {
      printerConfig = getInvoicePrinter(advertisingMedium, deliveryCountryCode, deliveryCountryIsEU);
      break;
    }
    case 'INVOICEMERGE': {
      printerConfig = getInvoicePrinter(advertisingMedium, 'DE', true);
      break;
    }
    case 'DELIVERY': {
      printerConfig = getDeliverySlipPrinter(advertisingMedium);
      break;
    }
    case 'RETURN': {
      printerConfig = getReturnSlipPrinter(advertisingMedium);
      break;
    }
  }

  logDebug('printer', 'getDocumentPrinter', JSON.stringify(printerConfig));
  return printerConfig;
};

/**
 * load invoice printer and number of copies
 * this is configured by default and can be overwritten by additional configuration with advertising medium
 *
 * @param {string} advertisingMedium
 * @param {string} deliveryCountryCode
 * @param {boolean} deliveryCountryIsEU
 *
 * @returns {{numOfCopies: number, printer: string}}
 *
 */
getInvoicePrinter = (advertisingMedium, deliveryCountryCode, deliveryCountryIsEU = false) => {
  let printerConfig = { numOfCopies: 1, printer: defaultPrinter };
  if (_checkPrinterKey('printing.defaultInvoiceSlipPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultInvoiceSlipPrinter'));
  }

  if (deliveryCountryCode === 'DE' && config.has('printing.defaultInvoiceSlipPrintCountCC')) {
    printerConfig.numOfCopies = config.get('printing.defaultInvoiceSlipPrintCountCC');
  } else if (deliveryCountryIsEU && config.has('printing.defaultInvoiceSlipPrintCountEU')) {
    printerConfig.numOfCopies = config.get('printing.defaultInvoiceSlipPrintCountEU');
  } else if (!deliveryCountryIsEU && config.has('printing.defaultInvoiceSlipPrintCountTC')) {
    printerConfig.numOfCopies = config.get('printing.defaultInvoiceSlipPrintCountTC');
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium;
  if (_checkPrinterKey(advertisingMediumConfigKey + '.invoiceSlipPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(advertisingMediumConfigKey + '.invoiceSlipPrinter'));
  }

  if (deliveryCountryCode === 'DE' && config.has(advertisingMediumConfigKey + '.invoiceSlipPrintCountCC')) {
    printerConfig.numOfCopies = config.get(advertisingMediumConfigKey + '.invoiceSlipPrintCountCC');
  } else if (deliveryCountryIsEU && config.has(advertisingMediumConfigKey + '.invoiceSlipPrintCountEU')) {
    printerConfig.numOfCopies = config.get(advertisingMediumConfigKey + '.invoiceSlipPrintCountEU');
  } else if (!deliveryCountryIsEU && config.has(advertisingMediumConfigKey + '.invoiceSlipPrintCountTC')) {
    printerConfig.numOfCopies = config.get(advertisingMediumConfigKey + '.invoiceSlipPrintCountTC');
  }

  return printerConfig;
};

/**
 * load delivery slip printer and number of copies
 * this is configured by default and can be overwritten by additional configuration with advertising medium
 *
 * @param {string} advertisingMedium
 *
 * @returns {{numOfCopies: number, printer: string}}
 */
getDeliverySlipPrinter = (advertisingMedium) => {
  let printerConfig = { numOfCopies: 1, printer: defaultPrinter };
  if (_checkPrinterKey('printing.defaultDeliverySlipPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultDeliverySlipPrinter'));
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.deliverySlipPrinter';
  if (_checkPrinterKey(advertisingMediumConfigKey)) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(advertisingMediumConfigKey));
  }

  return printerConfig;
};

/**
 * load return slip printer and number of copies
 * this is configured by default and can be overwritten by additional configuration with advertising medium
 *
 * @param {string} advertisingMedium
 *
 * @returns {{numOfCopies: number, printer: string}}
 */
getReturnSlipPrinter = (advertisingMedium) => {
  let printerConfig = { numOfCopies: 1, printer: defaultPrinter };
  if (_checkPrinterKey('printing.defaultReturnSlipPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultReturnSlipPrinter'));
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.returnSlipPrinter';
  if (_checkPrinterKey(advertisingMediumConfigKey)) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(advertisingMediumConfigKey));
  }

  return printerConfig;
};

/**
 * load product label printer
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean}}
 */
getProductLabelPrinter = (numberOfCopies) => {
  let printerConfig = { numOfCopies: numberOfCopies, printer: defaultPrinter, rotate: false };
  if (_checkPrinterKey('printing.defaultProductLabelPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultProductLabelPrinter'));
  }

  if (config.has('printing.rotateProductLabel')) {
    printerConfig.rotate = config.get('printing.rotateProductLabel');
  }

  return printerConfig;
};

/**
 * load shipment label printer
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean}}
 */
getShipmentLabelPrinter = (shipmentTypeCode) => {
  let printerConfig = { numOfCopies: 1, printer: defaultPrinter, rotate: false };
  const printerKey = 'shipping.' + shipmentTypeCode + '.printing.shipmentLabelPrinter';
  if (_checkPrinterKey(printerKey)) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(printerKey));
  }

  const rotateKey = 'shipping.' + shipmentTypeCode + '.printing.rotate';
  if (config.has(rotateKey)) {
    printerConfig.rotate = config.get(rotateKey);
  }

  return printerConfig;
};

module.exports = {
  getDocumentPrinter,
  getProductLabelPrinter,
  getShipmentLabelPrinter
};
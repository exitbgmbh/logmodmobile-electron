const { logDebug } = require('./../logging');
const config = require('config');
const printer = require('pdf-to-printer');

let printerList = [];
printer.getPrinters().then((res) => {
  console.log('printer.js', 'getPrinters', res)
  printerList = res
});

let defaultPrinter = '';
printer.getDefaultPrinter().then((res) => {
  console.log('printer.js', 'getDefaultPrinter', res)
  defaultPrinter = res
});

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
  const foundPrinter = printerList.filter((i) => { return i.name === printerName })
  if (foundPrinter.length === 0) {
    return defaultPrinter
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
 *
 * @param defaultPrinter
 * @returns {{color: boolean, numOfCopies: number, printer, monochrome: boolean}}
 * @private
 */
_getConfigTemplate = (defaultPrinter) => {
  return {
    numOfCopies: 1,
    printer: defaultPrinter,
    rotate: false,
    color: false,
    monochrome: false
  };
}

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
    case 'ADDITIONAL': {
      printerConfig = getAdditionalDocumentPrinter();
      break;
    }
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
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 *
 */
getInvoicePrinter = (advertisingMedium, deliveryCountryCode, deliveryCountryIsEU = false) => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  if (_checkPrinterKey('printing.defaultInvoiceSlipPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultInvoiceSlipPrinter'));
  }

  if (config.has('printing.defaultInvoiceSlipPrinterMode')) {
    if (config.get('printing.defaultInvoiceSlipPrinterMode') === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
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

  const advertisingMediumModeConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.invoiceSlipPrinterMode';
  if (_checkPrinterKey(advertisingMediumModeConfigKey)) {
    if (config.get(advertisingMediumModeConfigKey) === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  const advertisingMediumRotateConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.invoiceSlipPrinterRotate';
  if (config.has(advertisingMediumRotateConfigKey)) {
    printerConfig.rotate = config.get(advertisingMediumRotateConfigKey);
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
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getDeliverySlipPrinter = (advertisingMedium) => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  if (_checkPrinterKey('printing.defaultDeliverySlipPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultDeliverySlipPrinter'));
  }

  if (config.has('printing.defaultDeliverySlipPrinterMode')) {
    if (config.get('printing.defaultDeliverySlipPrinterMode') === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.deliverySlipPrinter';
  if (_checkPrinterKey(advertisingMediumConfigKey)) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(advertisingMediumConfigKey));
  }

  const advertisingMediumModeConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.deliverySlipPrinterMode';
  if (_checkPrinterKey(advertisingMediumModeConfigKey)) {
    if (config.get(advertisingMediumModeConfigKey) === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  const advertisingMediumRotateConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.deliverySlipPrinterRotate';
  if (config.has(advertisingMediumRotateConfigKey)) {
    printerConfig.rotate = config.get(advertisingMediumRotateConfigKey);
  }

  return printerConfig;
};

/**
 * load return slip printer and number of copies
 * this is configured by default and can be overwritten by additional configuration with advertising medium
 *
 * @param {string} advertisingMedium
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getReturnSlipPrinter = (advertisingMedium) => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  if (_checkPrinterKey('printing.defaultReturnSlipPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultReturnSlipPrinter'));
  }

  if (config.has('printing.defaultReturnSlipPrinterMode')) {
    if (config.get('printing.defaultReturnSlipPrinterMode') === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.returnSlipPrinter';
  if (_checkPrinterKey(advertisingMediumConfigKey)) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(advertisingMediumConfigKey));
  }

  const advertisingMediumModeConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.returnSlipPrinterMode';
  if (_checkPrinterKey(advertisingMediumModeConfigKey)) {
    if (config.get(advertisingMediumModeConfigKey) === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  const advertisingMediumRotateConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.returnSlipPrinterRotate';
  if (config.has(advertisingMediumRotateConfigKey)) {
    printerConfig.rotate = config.get(advertisingMediumRotateConfigKey);
  }

  return printerConfig;
};

/**
 * load additional slip printer and number of copies
 * this is configured by default and can be overwritten by additional configuration with advertising medium
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getAdditionalDocumentPrinter = () => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  if (_checkPrinterKey('printing.defaultAdditionalDocumentPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultAdditionalDocumentPrinter'));
  } else if (_checkPrinterKey('printing.defaultInvoiceSlipPrinter')) {  // backwards compatibility
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultInvoiceSlipPrinter'));
  }

  if (config.has('printing.defaultAdditionalDocumentPrinterMode')) {
    if (config.get('printing.defaultAdditionalDocumentPrinterMode') === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  return printerConfig;
};

/**
 * load product label printer
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getProductLabelPrinter = (numberOfCopies) => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  if (_checkPrinterKey('printing.defaultProductLabelPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultProductLabelPrinter'));
  }

  if (config.has('printing.rotateProductLabel')) {
    printerConfig.rotate = config.get('printing.rotateProductLabel');
  }

  if (config.has('printing.productLabelFormatName')) {
    printerConfig.paper = config.get('printing.productLabelFormatName');
  }

  if (config.has('printing.productLabelOptions')) {
    printerConfig.specialOptions = config.get('printing.productLabelOptions');
  }

  if (config.has('printing.defaultProductLabelPrinterMode')) {
    if (config.get('printing.defaultProductLabelPrinterMode') === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  return printerConfig;
};

/**
 * load shipment label printer
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getShipmentLabelPrinter = (shipmentTypeCode) => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  const printerKey = 'shipping.' + shipmentTypeCode + '.printing.shipmentLabelPrinter';
  if (_checkPrinterKey(printerKey)) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(printerKey));
  }

  const rotateKey = 'shipping.' + shipmentTypeCode + '.printing.rotate';
  const paperFormatName = 'shipping.' + shipmentTypeCode + '.printing.paperFormatName';
  if (config.has(rotateKey)) {
    printerConfig.rotate = config.get(rotateKey);
  }
  if (config.has(paperFormatName)) {
    printerConfig.paper = config.get(paperFormatName);
  }

  return printerConfig;
};
/**
 * load shipment label printer
 *
 * @returns {string}
 */
getRawLabelPrinter = (shipmentTypeCode) => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  const printerKey = 'shipping.' + shipmentTypeCode + '.raw.shipmentLabelPrinter';
  if (_checkPrinterKey(printerKey)) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get(printerKey));
  }

  return printerConfig.printer;
};

module.exports = {
  getDocumentPrinter,
  getProductLabelPrinter,
  getRawLabelPrinter,
  getShipmentLabelPrinter
};

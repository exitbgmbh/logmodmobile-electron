const { logDebug, logWarning } = require('./../logging');
const config = require('config');
const printer = require('pdf-to-printer');
const {isLinux, isWindows} = require("../helper");

function systemPrinter() {
  if (isWindows()) {
    return require('pdf-to-printer');
  }
  if (isLinux()) {
    return require('unix-print');
  }

  throw new Error(`unsupported platform. ${process.platform}`)
}

/**
 * normalized list of all printers known by the system
 *
 * @type {[{name: string, displayName: string, status: string, paperSizes: [string]}]}
 */
let printerList = [];

/**
 * the system default printer as delivered by the printing module - platform dependent structure
 */
let defaultPrinter = '';

/**
 * name of the system default printer
 *
 * @type {string}
 */
let defaultPrinterName = '';

/**
 * normalizes the platform dependent printer information
 *
 * windows (pdf-to-printer) delivers {deviceId, name, paperSizes}
 * linux (unix-print) delivers {printer, description, status, alerts, connection}
 *
 * @param {{}|string} systemPrinterInfo
 *
 * @returns {{name: string, displayName: string, status: string, paperSizes: [string]}|null}
 *
 * @private
 */
_normalizePrinterInfo = (systemPrinterInfo) => {
  if (!systemPrinterInfo) {
    return null;
  }

  if (typeof systemPrinterInfo === 'string') {
    return {name: systemPrinterInfo, displayName: systemPrinterInfo, status: '', paperSizes: []};
  }

  const name = systemPrinterInfo.name || systemPrinterInfo.printer || '';
  if (name === '') {
    return null;
  }

  return {
    name: name,
    displayName: systemPrinterInfo.description || name,
    status: systemPrinterInfo.status || systemPrinterInfo.alerts || '',
    paperSizes: systemPrinterInfo.paperSizes || []
  };
};

/**
 * reads all printers from the system and refreshes the local cache
 *
 * @returns {Promise<[{name: string, displayName: string, status: string, paperSizes: [string]}]>}
 */
refreshPrinterList = () => {
  // both requests are handled independently - a host without a default print queue still has to deliver its printers
  const printerListRequest = systemPrinter().getPrinters().then((systemPrinterList) => {
    printerList = (systemPrinterList || []).map(_normalizePrinterInfo).filter((printerInfo) => printerInfo !== null);
  }).catch((err) => {
    logWarning('printer', 'refreshPrinterList', 'could not read printers from system - ' + err.message);
  });

  const defaultPrinterRequest = systemPrinter().getDefaultPrinter().then((systemDefaultPrinter) => {
    defaultPrinter = systemDefaultPrinter;
    const normalizedDefaultPrinter = _normalizePrinterInfo(systemDefaultPrinter);
    defaultPrinterName = normalizedDefaultPrinter ? normalizedDefaultPrinter.name : '';
  }).catch((err) => {
    logWarning('printer', 'refreshPrinterList', 'could not read default printer from system - ' + err.message);
  });

  return Promise.all([printerListRequest, defaultPrinterRequest]).then(() => {
    logDebug('printer', 'refreshPrinterList', JSON.stringify({printerList, defaultPrinterName}));

    return printerList;
  });
};

refreshPrinterList();

/**
 * all printers known by the system, refreshed on every call
 *
 * @returns {Promise<[{name: string, displayName: string, status: string, isDefault: boolean, paperSizes: [string]}]>}
 */
getAvailablePrinters = () => {
  return refreshPrinterList().then((availablePrinters) => {
    return availablePrinters.map((printerInfo) => {
      return {...printerInfo, isDefault: printerInfo.name === defaultPrinterName};
    });
  });
};

/**
 * name of the system default printer - may be empty until the first refresh has been done
 *
 * @returns {string}
 */
getDefaultPrinterName = () => {
  return defaultPrinterName;
};

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
  if (isLinux()) {
    return printerName;
  }

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
 * applies a printer requested with the print command
 * the requested printer always wins over any configured printer
 *
 * @param {{}} printerConfig
 * @param {string} requestedPrinter
 *
 * @returns {{}}
 *
 * @private
 */
_applyRequestedPrinter = (printerConfig, requestedPrinter) => {
  if (!requestedPrinter || typeof requestedPrinter !== 'string' || requestedPrinter.trim() === '') {
    return printerConfig;
  }

  const requestedPrinterName = requestedPrinter.trim();

  // an empty printer list means we were not able to read the printers from the system - in this case we trust the request
  const printerIsKnown = printerList.length === 0 || printerList.some((printerInfo) => printerInfo.name === requestedPrinterName);
  if (!printerIsKnown) {
    logWarning('printer', '_applyRequestedPrinter', 'requested printer ' + requestedPrinterName + ' is unknown to the system, keeping configured printer ' + JSON.stringify(printerConfig.printer));

    return printerConfig;
  }

  logDebug('printer', '_applyRequestedPrinter', 'using requested printer ' + requestedPrinterName);
  printerConfig.printer = requestedPrinterName;

  return printerConfig;
};

/**
 * evaluates the printer and printer settings for given documentType
 *
 * @param {string} documentType
 * @param {string} advertisingMedium
 * @param {string} deliveryCountryCode
 * @param {boolean} deliveryCountryIsEU
 * @param {string} requestedPrinter printer given with the print command, overrides the configured printer
 *
 * @returns {{numOfCopies: number, printer: string}}
 *
 */
getDocumentPrinter = (documentType, advertisingMedium = '', deliveryCountryCode= '', deliveryCountryIsEU = false, requestedPrinter = '') => {
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
    case 'PERSONALIZATION': {
      printerConfig = getPersonalizationPrinter();
      break;
    }
  }

  printerConfig = _applyRequestedPrinter(printerConfig, requestedPrinter);

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
  const advertisingMediumPaperFormatNameConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.invoiceSlipPrinterFormatName';
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
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getPersonalizationPrinter = () => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  if (_checkPrinterKey('printing.defaultPersonalizationPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultPersonalizationPrinter'));
  }

  if (config.has('printing.defaultPersonalizationPrinterMode')) {
    if (config.get('printing.defaultPersonalizationPrinterMode') === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  if (config.has('printing.personalizationPrinterFormatName')) {
    printerConfig.paper = config.get('printing.personalizationPrinterFormatName');
  }

  if (config.has('printing.personalizationPrinterOptions')) {
    printerConfig.specialOptions = config.get('printing.personalizationPrinterOptions');
  }

  return printerConfig;
};


/**
 * load product label printer
 *
 * @param {int} numberOfCopies
 * @param {string} requestedPrinter printer given with the print command, overrides the configured printer
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getProductLabelPrinter = (numberOfCopies, requestedPrinter = '') => {
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

  return _applyRequestedPrinter(printerConfig, requestedPrinter);
};

/**
 * load movement label printer
 *
 * @param {string} requestedPrinter printer given with the print command, overrides the configured printer
 *
 * @returns {{numOfCopies: number, printer: string, rotate: boolean, color: boolean, monochrome: boolean}}
 */
getMovementLabelPrinter = (requestedPrinter = '') => {
  let printerConfig = _getConfigTemplate(defaultPrinter);
  if (_checkPrinterKey('printing.defaultMovementLabelPrinter')) {
    printerConfig.printer = _checkPrinterAndCorrect(config.get('printing.defaultMovementLabelPrinter'));
  }

  if (config.has('printing.defaultMovementLabelPrinterMode')) {
    if (config.get('printing.defaultMovementLabelPrinterMode') === 'monochrome') {
      printerConfig.monochrome = true;
    } else {
      printerConfig.color = true;
    }
  }

  return _applyRequestedPrinter(printerConfig, requestedPrinter);
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
  getMovementLabelPrinter,
  getRawLabelPrinter,
  getShipmentLabelPrinter,
  getAvailablePrinters,
  getDefaultPrinterName
};

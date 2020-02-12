const { logDebug } = require('./../logging');
const config = require('config');
// const printer = require('pdf-to-printer');

const defaultPrinter = 'EPSON'; //change to printer.list(true);

/**
 *
 * @param {string} documentType
 * @param {string} advertisingMedium
 * @param {string} deliveryCountryCode
 * @param {string} deliveryCountryIsEU
 * @returns {object} {{numOfCopies: number}|{}}
 * @private
 */
getDocumentPrinter = (documentType, advertisingMedium, deliveryCountryCode, deliveryCountryIsEU) => {
  logDebug('printer', 'getDocumentPrinter', JSON.stringify({documentType, advertisingMedium, deliveryCountryIsEU, deliveryCountryCode}));
  let printerConfig = {};
  switch(documentType.toUpperCase()) {
    case 'INVOICE': {
      printerConfig = getInvoicePrinter(advertisingMedium, deliveryCountryCode, deliveryCountryIsEU);
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
    case 'PRODUCTLABEL': {
      printerConfig = getProductLabelPrinter();
      break;
    }
  }

  logDebug('printer', 'getDocumentPrinter', JSON.stringify(printerConfig));
  return printerConfig;
};

/**
 *
 * @param {string} advertisingMedium
 * @param {string} deliveryCountryCode
 * @param {string} deliveryCountryIsEU
 * @returns {object} {{numOfCopies: number}}
 * @private
 */
getInvoicePrinter = (advertisingMedium, deliveryCountryCode, deliveryCountryIsEU) => {
  let printerConfig = { numOfCopies: 1, printer: defaultPrinter };
  if (config.has('printing.defaultInvoiceSlipPrinter')) {
    printerConfig.printer = config.get('printing.defaultInvoiceSlipPrinter');
  }

  if (deliveryCountryCode === 'DE' && config.has('printing.defaultInvoiceSlipPrintCountCC')) {
    printerConfig.numOfCopies = config.get('printing.defaultInvoiceSlipPrintCountCC');
  } else if (deliveryCountryIsEU && config.has('printing.defaultInvoiceSlipPrintCountEU')) {
    printerConfig.numOfCopies = config.get('printing.defaultInvoiceSlipPrintCountEU');
  } else if (!deliveryCountryIsEU && config.has('printing.defaultInvoiceSlipPrintCountTC')) {
    printerConfig.numOfCopies = config.get('printing.defaultInvoiceSlipPrintCountTC');
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium;
  if (config.has(advertisingMediumConfigKey + '.invoiceSlipPrinter')) {
    printerConfig.printer = config.get(advertisingMediumConfigKey + '.invoiceSlipPrinter');
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

getDeliverySlipPrinter = (advertisingMedium) => {
  let printerConfig = { numOfCopies: 1 };
  if (config.has('printing.defaultDeliverySlipPrinter')) {
    printerConfig.printer = config.get('printing.defaultDeliverySlipPrinter');
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.deliverySlipPrinter';
  if (config.has(advertisingMediumConfigKey)) {
    printerConfig.printer = config.get(advertisingMediumConfigKey);
  }

  return printerConfig;
};

getReturnSlipPrinter = (advertisingMedium) => {
  let printerConfig = { numOfCopies: 1 };
  if (config.has('printing.defaultReturnSlipPrinter')) {
    printerConfig.printer = config.get('printing.defaultReturnSlipPrinter');
  }

  const advertisingMediumConfigKey = 'printing.advertisingMediumConfig.' + advertisingMedium + '.returnSlipPrinter';
  if (config.has(advertisingMediumConfigKey)) {
    printerConfig.printer = config.get(advertisingMediumConfigKey);
  }

  return printerConfig;
};

getProductLabelPrinter = () => {
  let printerConfig = { numOfCopies: 1 };
  if (config.has('printing.defaultProductLabelPrinter')) {
    printerConfig.printer = config.get('printing.defaultProductLabelPrinter');
  }

  return printerConfig;
};

module.exports = getDocumentPrinter;
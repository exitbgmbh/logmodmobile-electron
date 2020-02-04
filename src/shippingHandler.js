const config = require('config');

class ShipmentProvider
{
    code = '';

    constructor(code, config) {
        this.code = code;

        this._initialize(config);
    }

    _initialize = (config) => {
        if (config.hasOwnProperty('printing') && config.hasOwnProperty('export')) {
            throw new Error('shipment provider ' + this.code + ' is not configured properly');
        }

        if (config.hasOwnProperty('printing')) {
            this._supportsPrinting = true;

            if (config.printing.hasOwnProperty('shipmentLabelPrinter')) {
                this._printerName = config.printing.shipmentLabelPrinter;
            }
        }
    };

    _supportsPrinting = false;
    supportsPrinting = () => {
        return this._supportsPrinting;
    };

    _printerName = '';
    getPrinterName = () => {
        return this._printerName;
    };


    supportsPolling = () => {
        return false;
    };

    supportClosingImport = () => {
        return false;
    };

}

class ShippingHandler
{
    shipmentProviders = {};

    initialize = () => {
        if (!config.has('shipping')) {
            throw new Error('no shipping defined in config. invalid config?')
        }

        const providerConfig = config.get('shipping');
        for (let providerCode in providerConfig) {
            this.shipmentProviders[providerCode] = new ShipmentProvider(providerCode, providerConfig[providerCode]);
        }
    };


    handleShipOut = () => {

    };
}

module.exports = new ShippingHandler();
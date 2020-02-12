class ShippingProvider
{
    code = '';

    constructor(code, config) {
        this.code = code;

        this._initialize(config);
    }

    _initialize = (config) => {
        if (config.hasOwnProperty('printing') && config.hasOwnProperty('polling')) {
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

module.exports = ShippingProvider;
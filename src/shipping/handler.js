const config = require('config');
const PollingProvider = require('./pollingProvider');
const {logInfo, logDebug, logWarning} = require('./../logging');
const restClientInstance = require('./../restClient');
const mapRequest = require('./requestMapper');
const eventEmitter = require('./../websocket/eventEmitter');

class ShippingHandler {
    /**
     * configured polling providers
     * @type {{}}
     */
    pollingProviders = {};
    pollingCounter = 0;

    initialized = false;

    initialize = () => {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        if (!config.has('shipping')) {
            throw new Error('no shipping defined in config. invalid config?')
        }

        const providerConfig = config.get('shipping');
        for (let providerCode in providerConfig) {
            if (!providerConfig[providerCode].hasOwnProperty('polling')) {
                continue;
            }

            this.pollingProviders[providerCode] = new PollingProvider(providerCode, providerConfig[providerCode]);
        }

        this._registerEventListener();
    };

    _registerEventListener = () => {
        eventEmitter.on('shipOut', this.handleShipping);
        eventEmitter.on('shipOutPrevious', this.handlePreviousShipping);
    };

    _handlePolling = (shipmentTypeCode, pollingDataEncoded, invoiceNumber = '') => {
        if (!this.pollingProviders.hasOwnProperty(shipmentTypeCode)) {
            throw new Error('polling provider ' + shipmentTypeCode + ' not configured');
        }

        this.pollingProviders[shipmentTypeCode].handlePolling(pollingDataEncoded, ++this.pollingCounter, invoiceNumber);
    };

    _handlePrinting = (shipmentTypeCode, shipmentLabelCollection) => {
        eventEmitter.emit('shipmentLabelPrint', {shipmentTypeCode, shipmentLabelCollection});
    };

    _handleRawPrinting = (shipmentTypeCode, command) => {
        logDebug('shipmentRawPrint', '_handleRawPrinting', shipmentTypeCode);
        logDebug('shipmentRawPrint', '_handleRawPrinting', command);
        eventEmitter.emit('shipmentRawPrint', {shipmentTypeCode, command});
    };

    _handleResult = (res, boxIdentification, boxInvoice) => {
        logDebug('shippingHandler', '_handleResult', 'requestShipOut response ' + JSON.stringify(res));
        logDebug('shippingHandler', '_handleResult', 'boxIdentification ' + boxIdentification);
        logDebug('shippingHandler', '_handleResult', 'boxInvoice ' + boxInvoice);
        if (!res.success) {
            throw new Error('request not successful');
        }

        const {
            shipmentTypeCode = '',
            returnShipmentTypeCode = '', //tbd
            shipOutType = '',
            returnShipOutType = '', //tbd
            packageCount = 0,
            invoiceNumber = '',
            shipmentPollingData: pollingDataBase64Encoded = '', //deprecated
            shipmentPollingCollection = [],
            shipmentLabels = [],
            returnPollingCollection = [],
            returnLabels = [],
            shipmentRawCollection = [],
            returnRawCollection = []
        } = res.response;

        let shipmentDone = false;
        if (shipmentLabels.length > 0) {
            this._handlePrinting(shipmentTypeCode, shipmentLabels);
            shipmentDone = true;
        }

        if (shipmentRawCollection.length > 0) {
            shipmentRawCollection.forEach((rawLabel) => {
                let decodedContent = Buffer.from(rawLabel, 'base64');
                this._handleRawPrinting(shipmentTypeCode, decodedContent);
            })
        }

        if (shipmentPollingCollection.length > 0) {
            shipmentPollingCollection.forEach((pollingDataBase64Encoded) => {
                this._handlePolling(shipmentTypeCode, pollingDataBase64Encoded, invoiceNumber);
            });

            shipmentDone = true;
        } else if (pollingDataBase64Encoded && pollingDataBase64Encoded.trim() !== '') {
            this._handlePolling(shipmentTypeCode, pollingDataBase64Encoded, invoiceNumber);
            shipmentDone = true;
        }

        if (returnLabels.length > 0) {
            this._handlePrinting(returnShipmentTypeCode, returnLabels);
        }

        if (returnPollingCollection.length > 0) {
            returnPollingCollection.forEach((pollingDataBase64Encoded) => {
                this._handlePolling(returnShipmentTypeCode, pollingDataBase64Encoded, invoiceNumber);
            });
        }

        if (returnRawCollection.length > 0) {
            returnRawCollection.forEach((rawLabel) => {
                let decodedContent = Buffer.from(rawLabel, 'base64');
                this._handleRawPrinting(shipmentTypeCode, decodedContent);
            })
        }

        if (shipOutType === 'SELF-COLLECTOR') {
            logInfo('shippingHandler', 'handleShipping', boxIdentification + ' shipOut succeed with SELF-COLLECTOR');
            shipmentDone = true;
        }

        if (shipOutType === 'VIRTUAL') {
            logInfo('shippingHandler', 'handleShipping', boxIdentification + ' shipOut succeed with VIRTUAL');
            shipmentDone = true;
        }

        if (!shipmentDone) {
            throw new Error('unknown ship out type');
        }

        let data = {
            boxIdent: boxIdentification,
            boxInvoice: boxInvoice,
            shipOutType: shipOutType,
            shipOutPackageCount: packageCount,
            shipmentTypeCode: shipmentTypeCode
        };

        eventEmitter.emit('shipOutSucceed', {
            event: 'shipOutSucceed',
            type: 'pickBox',
            receiverUserId: 0,
            receiverLogModIdent: '',
            data: data
        });
    }

    handlePreviousShipping = (data) => {
        const {identification: invoiceNumber} = data;
        if (!invoiceNumber || invoiceNumber === '') {
            logWarning('shippingHandler', 'handlePreviousShipping', 'got no invoice number from data ' + JSON.stringify(data));
            return;
        }

        restClientInstance.requestPreviousShipOut(invoiceNumber)
            .then((res) => {
                this._handleResult(res, null, invoiceNumber);
            })
            .catch((err) => {
                logWarning('shippingHandler', 'requestPreviousShipOut', 'requestShipOut failed ' + JSON.stringify(err));
                eventEmitter.emit('shipOutFailed', {
                    event: 'historicShipOutFailed',
                    type: 'pickBox',
                    receiverUserId: 0,
                    receiverLogModIdent: '',
                    data: {invoice: invoiceNumber}
                });
            });
    };

    handleShipping = (data) => {
        const {identification: boxIdentification} = data;
        if (!boxIdentification || boxIdentification === '') {
            const msg = 'got no boxIdentification from data ' + JSON.stringify(data)
            logWarning('shippingHandler', 'handleShipping', msg);
            return new Promise((resolve, reject) => {
                reject(msg)
            });
        }

        const requestData = mapRequest(data);
        return restClientInstance.requestShipOut(boxIdentification, requestData)
            .then((res) => {
                this._handleResult(res, boxIdentification);

                return new Promise((resolve) => {
                    resolve('success')
                });
            })
            .catch((err) => {
                logWarning('shippingHandler', 'handleShipping', 'requestShipOut failed ' + JSON.stringify(err));
                eventEmitter.emit('shipOutFailed', {
                    event: 'shipOutFailed',
                    type: 'pickBox',
                    receiverUserId: 0,
                    receiverLogModIdent: '',
                    data: {boxIdent: boxIdentification, reason: err.message}
                });

                return new Promise((resolve, reject) => {
                    reject('failed');
                });
            })

    };
}

module.exports = ShippingHandler;

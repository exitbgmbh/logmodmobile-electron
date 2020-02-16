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

    initialize = () => {
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

    handleShipping = (data) => {
        const {identification: boxIdentification} = data;

        if (!boxIdentification || boxIdentification === '') {
            logWarning('shippingHandler', 'handleShipping', 'got no boxIdentification from data ' + JSON.stringify(data));
            return;
        }

        const requestData = mapRequest(data);
        restClientInstance.requestShipOut(boxIdentification, requestData)
            .then((res) => {
                logDebug('shippingHandler', 'handleShipping', 'requestShipOut response ' + JSON.stringify(res));
                if (!res.success) {
                    throw new Error('request not successful');
                }
    
                const {
                    shipmentTypeCode = '',
                    shipOutType = '',
                    packageCount = 0,
                    invoiceNumber = '',
                    shipmentPollingData: pollingDataBase64Encoded = '',
                    shipmentLabels = []
                } = res.response;
    
                // we just need to handle label printing or polling export
                if (shipmentLabels.length > 0) {
                    this._handlePrinting(shipmentTypeCode, shipmentLabels);
                } else if (pollingDataBase64Encoded && pollingDataBase64Encoded.trim() !== '') {
                    this._handlePolling(shipmentTypeCode, pollingDataBase64Encoded, invoiceNumber);
                } else if (shipOutType === 'SELF-COLLECTOR') {
                    logInfo('shippingHandler', 'handleShipping', boxIdentification + ' shipOut succeed with SELF-COLLECTOR');
                } else if (shipOutType === 'VIRTUAL') {
                    logInfo('shippingHandler', 'handleShipping', boxIdentification + ' shipOut succeed with VIRTUAL');
                } else {
                    throw new Error('unknown ship out type');
                }
    
                eventEmitter.emit('shipOutSucceed', {
                    event: 'shipOutSucceed',
                    type: 'pickBox',
                    receiverUserId: 0,
                    receiverLogModIdent: '',
                    data: {boxIdent: boxIdentification, shipOutType: shipOutType, shipOutPackageCount: packageCount}
                });
            })
            .catch((err) => {
                console.log(err.message);
                logWarning('shippingHandler', 'handleShipping', 'requestShipOut failed ' + JSON.stringify(err));
                eventEmitter.emit('shipOutFailed', {
                    event: 'shipOutFailed',
                    type: 'pickBox',
                    receiverUserId: 0,
                    receiverLogModIdent: '',
                    data: {boxIdent: boxIdentification}
                });
            });
    };
}

module.exports = ShippingHandler;
const config = require('config');
const ShippingProvider = require('./provider');
const {logInfo, logDebug, logWarning} = require('./../logging');
const restClientInstance = require('./../restClient');
const mapRequest = require('./requestMapper');
const eventEmitter = require('./../websocket/eventEmitter');

class ShippingHandler {
  shipmentProviders = {};

  shippingCounter = 0;

  initialize = () => {
    if (!config.has('shipping')) {
      throw new Error('no shipping defined in config. invalid config?')
    }

    const providerConfig = config.get('shipping');
    for (let providerCode in providerConfig) {
      this.shipmentProviders[providerCode] = new ShippingProvider(providerCode, providerConfig[providerCode]);
    }

    this._registerEventListener();
  };

  _registerEventListener = () => {
    eventEmitter.on('shipOut', this.handleShipping);
  };

  handleShipping = (data) => {
    const {identification: boxIdentification} = data;

    if (!boxIdentification || boxIdentification === '') {
      logWarning('shippingHandler', 'handleShipping', 'got no boxIdentification from data ' + JSON.stringify(data));
      return;
    }

    const requestData = mapRequest(data);
    restClientInstance.requestShipOut(boxIdentification, requestData).then((response) => {
      logDebug('shippingHandler', 'handleShipping', 'requestShipOut response ' + JSON.stringify(response));

      // if (!this.shipmentProviders.hasOwnProperty(providerCode)) {
      //     throw new Error('shipment provider ' + providerCode + ' seems not configured');
      // }
      //
      // const provider = this.shipmentProviders[providerCode];
      //
      // if (provider.supportsPrinting()) {
      //     console.log('printing result');
      //     return;
      // }
      //
      // if (provider.supportsPolling()) {
      //     console.log('export polling file');
      //     return;
      // }

      eventEmitter.emit('shipOutSucceed', {
        event: 'shipOutSucceed',
        type: 'pickBox',
        receiverUserId: 0,
        receiverLogModIdent: '',
        data: {boxIdent: boxIdentification, shipOutType: 'POLLING'}
      });

      this.shippingCounter++;
    })
    .catch((err) => {
      eventEmitter.emit('shipOutFailed', {
        event: 'shipOutFailed',
        type: 'pickBox',
        receiverUserId: 0,
        receiverLogModIdent: '',
        data: {boxIdent: boxIdentification}
      });
      logWarning('shippingHandler', 'handleShipping', 'requestShipOut failed ' + JSON.stringify(err));
    });
  };
}

module.exports = ShippingHandler;
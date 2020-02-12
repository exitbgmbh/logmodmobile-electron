const eventEmitter = require('./../websocket/eventEmitter');
class InvoiceHandler
{
    initialize = () => {
        eventEmitter.on('pickBoxReady', console.log);
    }
}

module.exports = InvoiceHandler;
const {logDebug} = require("../../logging");
const {getResponse, getMockResponse} = require("../response");
const shippingHandler = require('./../../shipping');

module.exports = (server) => {
    server.post('/shipping/processShipping/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'shipping/processShipping', JSON.stringify(request.params));
        if (request.params.mock) {
            return getMockResponse(response, request.params.error);
        }

        /**
         * {
         *     identification: <string|pickBoxIdentification|invoiceNumber>,
         *     shippingRequestPackages: <[]|packageCollection>
         * }
         */
        logDebug('restRouter', 'shipping/processShipping::request.body', JSON.stringify(request.body));
        shippingHandler.handleShipping(request.body).then((res) => {
            logDebug('restRouter', 'shipping/processShipping::result', JSON.stringify(res));
            response.send(getResponse(200, '', { success: true }));
        }).catch((res) => {
            logDebug('restRouter', 'shipping/processShipping::error', JSON.stringify(res));
            response.send(getResponse(500, '', { success: false }));
        })
    });
}

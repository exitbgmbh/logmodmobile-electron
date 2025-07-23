const {logDebug} = require("../../logging");
const getResponse = require("../response");
const scaleHandler = require('./../../scale');
const shippingHandler = require('./../../shipping');

const _handleMock = (response, error) => {
    if (error) {
        response.send(getResponse(500, 'some error message'));
        return;
    }

    response.send(getResponse(200));
}

module.exports = (server) => {
    server.get('/shippingRequest/scale/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'shippingRequest/scale', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleMock(response, request.params.error);
        }

        scaleHandler.callScale().then((res) => {
            response.send(getResponse(200, '', { weight: res }));
        }).catch(() => {
            response.send(getResponse(500, '', { weight: 0 }));
        })
    });

    server.get('/shippingRequest/scaleAvailable/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'shippingRequest/scaleAvailable', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleMock(response, request.params.error);
        }

        const available = scaleHandler.scaleAvailable()

        // send response
        response.send(getResponse(200, '', available));
    });

    server.post('/shippingRequest/shipOut/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'shippingRequest/shipOut', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleMock(response, request.params.error);
        }
        /*
        {
            identification: pickBox,
            shippingRequestPackages: packageCollection
        }
         */

        console.log(request.body)
        shippingHandler.handleShipping(request.body).then((res) => {
            console.log(res)
            response.send(getResponse(200, '', { success: true }));
        }).catch((res) => {
            console.log(res)
            response.send(getResponse(500, '', { success: false }));
        })
    });
}

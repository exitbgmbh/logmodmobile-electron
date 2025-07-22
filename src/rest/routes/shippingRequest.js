const {logDebug} = require("../../logging");
const getResponse = require("../response");

const _handleMock = (response, error) => {
    if (error) {
        response.send(getResponse(500, 'some error message'));
        return;
    }

    response.send(getResponse(200));
}

module.exports = (server, windowInstance) => {
    server.get('/shippingRequest/scale/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'shippingRequest/scale', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleMock(response, request.params.error);
        }

        const weight = window.promiseIpc.send('scale-package'); // 3000

        // send response
        response.send(getResponse(200, '', { weight }));
    });
}

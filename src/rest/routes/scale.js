const {logDebug} = require("../../logging");
const {getResponse, getMockResponse} = require("../response");
const scaleHandler = require('./../../scale');

module.exports = (server) => {
    server.get('/scale/getWeight/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'scale/getWeight', JSON.stringify(request.params));
        if (request.params.mock) {
            return getMockResponse(response, request.params.error);
        }

        scaleHandler.callScale().then((res) => {
            response.send(getResponse(200, '', { weight: res }));
        }).catch(() => {
            response.send(getResponse(500, '', { weight: 0 }));
        })
    });

    server.get('/scale/isAvailable/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'scale/isAvailable', JSON.stringify(request.params));
        if (request.params.mock) {
            return getMockResponse(response, request.params.error);
        }

        const available = scaleHandler.scaleAvailable()

        // send response
        response.send(getResponse(200, '', { isAvailable: available }));
    });

}

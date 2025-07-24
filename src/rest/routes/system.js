const {logDebug} = require("../../logging");
const {getResponse, getMockResponse} = require("../response");

module.exports = (server) => {
    server.get('/system/isAvailable/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'system/isAvailable', JSON.stringify(request.params));
        if (request.params.mock) {
            return getMockResponse(response, request.params.error);
        }


        response.send(getResponse(200, '', { isAvailable: true }));
    });

}

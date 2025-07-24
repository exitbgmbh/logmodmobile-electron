const registerBatchOrderRoutes = require('./routes/batchOrder');
const registerShippingRoutes = require('./routes/shipping');
const registerScaleRoutes = require('./routes/scale');
const registerSystemRoutes = require('./routes/system');
const {getResponse} = require('./response');

module.exports = (server, windowInstance) => {
    // routes with connection to frontend
    registerBatchOrderRoutes(server, windowInstance);

    // routes without frontend connection
    registerShippingRoutes(server);
    registerScaleRoutes(server);
    registerSystemRoutes(server);

    // default route
    server.use((request, response) => {
        response.send(getResponse(404, 'resource not found'));
    })
}

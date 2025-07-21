const registerBatchOrderRoutes = require("./routes/batchOrder");
const registerShippingRequestRoutes = require("./routes/shippingRequest");
const getResponse = require("./response");

module.exports = (server, windowInstance) => {
    registerBatchOrderRoutes(server, windowInstance);
    registerShippingRequestRoutes(server, windowInstance);

    // default route
    server.use((request, response) => {
        response.send(getResponse(404, 'resource not found'));
    })
}

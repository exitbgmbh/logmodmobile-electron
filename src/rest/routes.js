const registerBatchOrderRoutes = require("./batchOrder");
const getResponse = require("./response");

module.exports = (server, windowInstance) => {
    registerBatchOrderRoutes(server, windowInstance);

    // default route
    server.use((request, response) => {
        response.send(getResponse(404, 'resource not found'));
    })
}

const express = require('express');
const cors = require('cors');
const config = require('config');

class RestServerHandler
{
    initialized = false;
    server;
    windowInstance;

    initialize = (windowInstance) => {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        if (!config.has('app.restServer.enable') || !config.get('app.restServer.enable')) {
            return;
        }

        let serverPort = 3005; // default
        if (config.has('app.restServer.port')) {
            serverPort = config.get('app.restServer.port');
        }

        this.windowInstance = windowInstance;
        this.server = express();

        this.server.use(cors({
          origin: '*',
          methods: ['GET', 'POST', 'PUT', 'DELETE']
        }));

        this.server.use(express.urlencoded({ extended: true }));
        this.server.use(express.json());

        this._initRoutes();

        this.server.listen(serverPort, () => {
            console.log('server is running');
        });
    }

    _initRoutes = () => {
        require('./routes')(this.server, this.windowInstance);
    }

}

module.exports = RestServerHandler;

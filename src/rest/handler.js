const express = require('express');
const {ipcMain} = require("electron");
const config = require('config');

class RestServerHandler
{
    initialized = false;
    server;
    windowInstance;

    getResponse = (code = 200, message = '', responseData = []) => {
        return {
            success: code === 200,
            code: code,
            message: message,
            response: responseData
        };
    }

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
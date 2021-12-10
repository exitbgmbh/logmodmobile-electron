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
        this.server.get('/batchOrder/getNext/:mock?/:error?', (request, response) => {
            if (request.params.mock) {
                return this._handleBatchOrderGetNextMock(response, request.params.error);
            }

            ipcMain.once('got-batch-order', (event, args) => {
                console.log('got-batch-order', event, args);
                response.send(this.getResponse(args.responseCode, args.responseMessage, args.responseData));
            });
            this.windowInstance.webContents.send('get-batch-order');
        });

        this.server.patch('/batchOrder/finalize/:mock?/:error?', (request, response) => {
            if (request.params.mock) {
                return this._handleBatchOrderFinalizeMock(response, request.params.error);
            }

            ipcMain.once('finished-batch-order', (event, args) => {
                console.log('finished-batch-order', event, args);
                response.send(this.getResponse(args.responseCode, args.responseMessage, args.responseData));
            });
            this.windowInstance.webContents.send('finish-batch-order');
        });

        // default route
        this.server.use((request, response) => {
            response.send(this.getResponse(404, 'resource not found'));
        })
    }

    _handleBatchOrderGetNextMock = (response, error) => {
        if (error) {
            response.send(this.getResponse(500, 'some error message'));
            return;
        }

        response.send(this.getResponse(
            200,
            '',
            { // object
                'orderNumber': 'X123456789', // alphanumeric|string
                'shippingRequestNumber': '21511234567896', // numeric|(big)int
                'packingId': 'SRP-987654321', // alphanumeric|string
                'workstation': 'PRO-AP-123456', // alphanumeric|string
                'orderLines': [{ // object array
                    'vhsArticleNumber': '00202100001236', // alphanumeric|string
                    'barcode': '9001234567896', // alphanumeric|string
                    'location': 'PBX-A1', // alphanumeric|string
                    'trayCode': 'PBX-A1-01-01', // alphanumeric|string
                    'quantity': 1 // int
                }, {
                    'vhsArticleNumber': '00202100001478', // alphanumeric|string
                    'barcode': '9009876543216', // alphanumeric|string
                    'location': 'PBX-A1', // alphanumeric|string
                    'trayCode': 'PBX-A1-03-02', // alphanumeric|string
                    'quantity': 2 // int
                }]
            }
        ))
    }

    _handleBatchOrderFinalizeMock = (response, error) => {
        if (error) {
            response.send(this.getResponse(500, 'some error message'));
            return;
        }

        response.send(this.getResponse(200));
    }

}

module.exports = RestServerHandler;
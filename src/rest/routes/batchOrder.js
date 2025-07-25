const {logDebug} = require("../../logging");
const {ipcMain} = require("electron");
const {getHostname} = require("../../helper");
const {getResponse} = require("../response");

const _handleBatchOrderGetNextMock = (response, error) => {
    if (error) {
        response.send(getResponse(500, 'some error message'));
        return;
    }

    response.send(getResponse(
        200,
        '',
        { // object
            'orderNumber': 'X123456789', // alphanumeric|string
            'shippingRequestNumber': '21511234567896', // numeric|(big)int
            'packingId': 'SRP-987654321', // alphanumeric|string
            'workstation': 'PRO-AP-123456', // alphanumeric|string
            'pickMode': 0, // numeric|int
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

const _handleBatchOrderFinalizeMock = (response, error) => {
    if (error) {
        response.send(getResponse(500, 'some error message'));
        return;
    }

    response.send(getResponse(200));
}

const _handleBatchOrderCancelMock = (response, error) => {
    if (error) {
        response.send(getResponse(500, 'some error message'));
        return;
    }

    response.send(getResponse(200));
}

const _handleConfirmArticleMock = (response, error) => {
    if (error) {
        response.send(getResponse(500, 'some error message'));
        return;
    }

    response.send(getResponse(200));
}

module.exports = (server, windowInstance) => {
    server.get('/batchOrder/getNext/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'batchOrder/getNext', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleBatchOrderGetNextMock(response, request.params.error);
        }

        ipcMain.once('got-batch-order', (event, args) => {
            logDebug('restRouter', 'got-batch-order', JSON.stringify(args));

            let responseData = {
                orderNumber: args.responseData.orderNumber,
                shippingRequestNumber: args.responseData.shippingRequestNumber,
                packageId: args.responseData.packageId,
                workstation: getHostname(),
                pickMode: args.responseData.expertMode,
                orderLines: args.responseData.orderLines
            };
            response.send(getResponse(args.responseCode, args.responseMessage, responseData));
        });
        windowInstance.webContents.send('get-batch-order');
    });

    server.patch('/batchOrder/confirm/:trayCode/:barcode/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'batchOrder/confirm', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleConfirmArticleMock(response, request.params.error);
        }

        const args = {barcode: request.params.barcode, trayCode: request.params.trayCode};
        ipcMain.once('article-confirmed', (event, args) => {
            logDebug('restRouter', 'article-confirmed', JSON.stringify(args));
            response.send(getResponse(args.responseCode, args.responseMessage, args.responseData));
        });
        windowInstance.webContents.send('confirm-article', args);
    });

    server.patch('/batchOrder/finalize/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'batchOrder/finalize', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleBatchOrderFinalizeMock(response, request.params.error);
        }

        ipcMain.once('finished-batch-order', (event, args) => {
            logDebug('restRouter', 'finished-batch-order', JSON.stringify(args));
            response.send(getResponse(args.responseCode, args.responseMessage, args.responseData));
        });
        windowInstance.webContents.send('finish-batch-order');
    });

    server.patch('/batchOrder/cancel/:mock?/:error?', (request, response) => {
        logDebug('restRouter', 'batchOrder/cancel', JSON.stringify(request.params));
        if (request.params.mock) {
            return _handleBatchOrderCancelMock(response, request.params.error);
        }

        ipcMain.once('cancelled-batch-order', (event, args) => {
            logDebug('restRouter', 'cancelled-batch-order', JSON.stringify(args));
            response.send(getResponse(args.responseCode, args.responseMessage, args.responseData));
        });
        windowInstance.webContents.send('cancel-batch-order');
    });
}

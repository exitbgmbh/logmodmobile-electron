const eventEmitter = require('./../websocket/eventEmitter');
const restClientInstance = require('./../restClient');
const config = require('config');

class InvoiceHandler {
    initialized = false;

    initialize = () => {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        eventEmitter.on('pickBoxReady', this.requestInvoiceForPickBox);
    };

    requestInvoiceForPickBox = (requestData) => {
        const {pickBoxIdent, force: forceInvoice = false} = requestData;
        let messageTemplate = {
            event: null,
            type: 'pickBox',
            receiverUserId: 0,
            logModIdent: null,
            data: {pickBoxIdent: pickBoxIdent, invoiceNumber: null}
        };

        restClientInstance
            .requestInvoice(pickBoxIdent, forceInvoice)
            .then((res) => {
                if (!res.success) {
                    console.log('invoiceHandler::requestInvoiceForPickBox::request invoice failed', res);
                    throw new Error('request not successful');
                }

                const {response} = res;
                const disableInvoicePrinting = config.has('printing.disablePrintingOnCreation') && config.get('printing.disablePrintingOnCreation');

                let event = 'pickBoxInvoiceSuccess';
                // event for lmm - toggle mask
                eventEmitter.emit(event, {
                    ...messageTemplate,
                    event: event,
                    data: {
                        ...messageTemplate.data,
                        invoiceNumber: response.invoiceNumber,
                        shippingRequestNumber: response.shippingRequestNumber,
                        printingIsSkipped: disableInvoicePrinting
                    }
                });

                if (disableInvoicePrinting === true) {
                    console.log('invoiceHandler::requestInvoiceForPickBox::skip invoice printing due to configuration');
                    return;
                }

                if (config.has('printing.requestInvoiceDocumentsMerged') && config.get('printing.requestInvoiceDocumentsMerged') === true) {
                    if (response.invoiceNumber === 'NO_INVOICE') {
                        eventEmitter.emit('requestDocuments', {
                            documentType: 'allDocs',
                            invoiceNumber: response.shippingRequestNumber
                        });
                    } else {
                        eventEmitter.emit('requestDocuments', {
                            documentType: 'allDocs',
                            invoiceNumber: response.invoiceNumber
                        });
                    }
                } else {
                    eventEmitter.emit('invoiceCreationSuccess', response);
                }
            })
            .catch((res) => {
                console.log('invoice creation/printing failed', res);

                let event = 'pickBoxInvoiceFailed';
                eventEmitter.emit(event, {...messageTemplate, event: event});
            });
    };
}

module.exports = InvoiceHandler;
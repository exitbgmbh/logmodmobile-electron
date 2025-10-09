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
        let messageTemplate = {event: null, type: 'pickBox', receiverUserId: 0, logModIdent: null, data: {pickBoxIdent: pickBoxIdent, invoiceNumber: null}};

        restClientInstance
              .requestInvoice(pickBoxIdent, forceInvoice)
              .then((res) => {
                if (!res.success) {
                  throw new Error('request not successful');
              }

              const { response } = res;
              let event = 'pickBoxInvoiceSuccess';
              // event for lmm - toggle mask
              eventEmitter.emit(event, {...messageTemplate, event: event, data: {...messageTemplate.data, invoiceNumber: response.invoiceNumber, shippingRequestNumber: response.shippingRequestNumber}});

              if (config.has('printing.requestInvoiceDocumentsMerged') && config.get('printing.requestInvoiceDocumentsMerged') === true) {
                  if (response.invoiceNumber === 'NO_INVOICE') {
                      eventEmitter.emit('requestDocuments', {documentType: 'allDocs', invoiceNumber: response.shippingRequestNumber});
                  } else {
                      eventEmitter.emit('requestDocuments', {documentType: 'allDocs', invoiceNumber: response.invoiceNumber});
                  }
              } else {
                  eventEmitter.emit('invoiceCreationSuccess', response);
              }
          })
          .catch((res) => {
            console.log(res);

            let event = 'pickBoxInvoiceFailed';
            eventEmitter.emit(event, {...messageTemplate, event: event});
          });
      };
}

module.exports = InvoiceHandler;
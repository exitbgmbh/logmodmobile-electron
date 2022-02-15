const fetch = require('node-fetch');
const os = require('os');
const version = require(__dirname + '/../package').version;
const querystring = require('querystring');
const { logInfo, logDebug, logWarning } = require('./logging');
const isDevelopment = process.env.NODE_ENV === 'development';

class RestClient
{
    baseUrl = '';
    defaultHeaders = {
        'X-DEVICE-ID': 'Electron ' + os.hostname(),
        'X-APP-VERSION': version
    };
    
    enablePersistentLogin = () => {
        setInterval(() => {
            this.get('login/refreshLogin').then((response) => {
                this.setAuthToken(response.response.jwt);
            });
        }, 1000 * 60 * 60);
    }
    
    /**
     * set Bearer Authentication Token to axios
     *
     * @param {string} authToken
     */
    setAuthToken = (authToken) => {
        this.defaultHeaders['Authorization'] = 'Bearer ' + authToken;
    };

    /**
     * parsing url to set axios base url
     *
     * @param {string} requestUrl
     */
    parseBaseUrl = (requestUrl) => {
        const url = new URL(requestUrl);
        this.baseUrl = url.origin;
    };

    /**
     * creates final url
     *
     * @param {string} path
     * @param {string} parameter
     * @param {string} apiVersion
     *
     * @returns {string}
     *
     * @private
     */
    _getFinalPath = (path, parameter, apiVersion = 'v1') => {
        let finalPath = this.baseUrl + '/' + apiVersion + '/' + path;
        let param = parameter || [];

        if (isDevelopment) {
            param['XDEBUG_SESSION_START'] = 'PHPSTORM';
        }

        if (param && Object.keys(param).length) {
            finalPath += '?' + querystring.stringify(param);
        }
        return finalPath;
    };

    /**
     * wrapping fetch get method
     *
     * @param {string} path
     * @param {object} parameter
     * @param {string} apiVersion
     *
     * @returns {*|Promise}
     */
    get = (path, parameter = {}, apiVersion = 'v1') => {
        const request = this._getFinalPath(path, parameter, apiVersion);
        logDebug('restClient', 'get', request);

        return fetch(request, {headers: {...this.defaultHeaders}, method: 'GET'}).then(res => res.json());
    };

    /**
     * wrapping fetch post method
     *
     * @param {string} path
     * @param {object} data
     * @param {object} parameter
     * @param {string} apiVersion
     *
     * @returns {*|Promise}
     */
    post = (path, data = {}, parameter = {}, apiVersion = 'v1') => {
        const request = this._getFinalPath(path, parameter, apiVersion);
        logDebug('restClient', 'post', request + ' // ' + JSON.stringify(data));

        return fetch(request, {headers:{...this.defaultHeaders}, method: 'POST', body: JSON.stringify(data)}).then(res => res.json());
    };

    /**
     *
     * @param {string} logModIdent
     *
     * @returns {*|Promise}
     */
    requestWebSocketAccessLink = (logModIdent) => {
        return this.get('login/getWebSocketAccessLink', {logModIdent: logModIdent});
    };

    /**
     *
     * @param {string} shipmentTypeCode
     * @param {string} shipmentTypeData
     *
     * @returns {*|Promise}
     */
    reportTrackingFile = (shipmentTypeCode, shipmentTypeData) => {
        return this.post('tracking/importTrackingFile/' + shipmentTypeCode, {trackingFileContent: shipmentTypeData, encoding: 'UTF-8'});
    };

    /**
     *
     * @param {string} boxIdentification
     * @param {object} data
     *
     * @returns {*|Promise}
     */
    requestShipOut = (boxIdentification, data) => {
        return this.post('shipOut/processShipping/' + boxIdentification, data);
    };

    /**
     *
     * @param {string} invoiceNumber
     *
     * @returns {*|Promise}
     */
    requestPreviousShipOut = (invoiceNumber) => {
        return this.get('shipOut/processPreviousShipping/' + invoiceNumber);
    };

    /**
     * request a product label
     *
     * @param {string} productIdentification
     * @param {int} templateId
     *
     * @returns {*|Promise}
     */
    requestProductLabel = (productIdentification, templateId) => {
        return this.get('document/readProductLabel/' + productIdentification, {templateId: templateId});
    };

    /**
     * request a product label
     *
     * @param {string} shippingRequestPackageNumber
     *
     * @returns {*|Promise}
     */
    requestShippingRequestPackageLabel = (shippingRequestPackageNumber) => {
        return this.get('document/readShippingRequestPackageLabel/' + shippingRequestPackageNumber);
    };

    /**
     *
     * @param {string} pickBoxIdentification
     * @param {boolean} forceInvoice
     *
     * @returns {*|Promise}
     */
    requestInvoice = (pickBoxIdentification, forceInvoice = false) => {
        return this.post('pickBox/createInvoice/' + pickBoxIdentification, {forceInvoice: forceInvoice});
    };

    /**
     * request a single invoice slip for printing
     *
     * @param {string} invoiceNumber
     *
     * @returns {*|Promise}
     */
    requestInvoiceDocument = (invoiceNumber) => {
        return this.get('document/readInvoice/' + invoiceNumber);
    };

    /**
     * requests a single delivery slip for printing
     *
     * @param {string} invoiceNumber
     *
     * @returns {*|Promise}
     */
    requestDeliverySlipDocument = (invoiceNumber) => {
        return this.get('document/readDeliverySlip/' + invoiceNumber);
    };

    /**
     * request a single return slip for printing
     *
     * @param {string} invoiceNumber
     *
     * @returns {*|Promise}
     */
    requestReturnSlipDocument = (invoiceNumber) => {
        return this.get('document/readReturnSlip/' + invoiceNumber);
    };

    /**
     * request all documents for an invoice for printing
     *
     * @param {string} invoiceNumber
     *
     * @returns {*|Promise}
     */
    requestAllDocuments = (invoiceNumber) => {
        return this.get('document/readInvoiceDocuments/' + invoiceNumber);
    };

    /**
     * request all documents for an invoice for printing
     *
     * @param {string} invoiceNumber
     *
     * @returns {*|Promise}
     */
    requestMergedDocuments = (invoiceNumber) => {
        return this.get('document/readMergedInvoiceDocuments/' + invoiceNumber);
    };
    
    /**
     * request (batched) repair case documents
     *
     * @param {string} identifier
     */
    requestRepairCaseDocuments = (identifier) => {
        return this.get('document/readRepairCaseDocument/' + identifier);
    }
    
    /**
     * request relocation document
     *
     * @param {string} identifier
     */
    requestRelocationDocuments = (identifier) => {
        return this.get('document/readRelocationDocument/' + identifier);
    }

    /**
     * request relocation document
     *
     * @param {string} identifier
     */
    requestMultiPackageSupplyNote = (identifier) => {
        return this.get('document/readMultiPackageSupplyNote/' + identifier);
    }

    /**
     *
     * @param {string} url
     * @param {string} orderNumber
     */
    requestAdditionalDocument = (url, orderNumber) => {
        return fetch(url.replaceAll('$ORDER_NUMBER$', orderNumber)).then(res => res.blob());
    }
}

module.exports = new RestClient();
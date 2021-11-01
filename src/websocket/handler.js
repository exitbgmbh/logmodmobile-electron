const showNotification = require('./../notificationHelper');
const config = require('config');
const WebSocketClient = require('websocket').client;
const WebSocketConnection = require('websocket').connection;
const { logInfo, logDebug, logWarning } = require('./../logging');
const eventEmitter = require('./eventEmitter');
const {getLogModIdentification} = require("../helper");

const SHIP_OUT_EVENT = 'LOGMODSHIPOUT';
const PREVIOUS_SHIP_OUT_EVENT = 'LOGMODSHIPOUTPREVIOUS';
const MULTI_PACKAGE_SUPPLY_NOTE_EVENT = 'LOGMODMULTIPACKAGESUPPLYNOTE';
const PRINT_EVENT = 'LOGMODPRINT';
const PICK_BOX_READY = 'PICKBOXREADY';
const PICK_LIST_FINISHED = 'PICKLISTFINISHED';

class WebSocketHandler
{
    constructor() {
        eventEmitter.on('shipOutFailed', this.sendMessage);
        eventEmitter.on('shipOutSucceed', this.sendMessage);
        eventEmitter.on('pickBoxInvoiceSuccess', this.sendMessage);
        eventEmitter.on('pickBoxInvoiceFailed', this.sendMessage);
    }

    /**
     * identification of this logmod instance
     * @type string
     */
    logModIdentification = '';

    /**
     * set the logmod identification
     *
     * @param logModIdentification
     *
     * @returns WebSocketHandler
     */
    setLogModIdentification = (logModIdentification) => {
        this.logModIdentification = logModIdentification;

        return this;
    };

    /**
     * @type WebSocketClient
     */
    socket = null;

    /**
     * @type WebSocketConnection
     */
    currentConnection = null;

    /**
     * @type int
     */
    heartbeatIntervalPID = 0;

    /**
     * sending a message to websocket
     *
     * @param message
     */
    sendMessage = (message) => {
        if (this.currentConnection && this.currentConnection.connected) {
            logDebug('webSocketHandler', 'sendMessage', 'sending message ... ' + JSON.stringify(message));
            this.currentConnection.send(JSON.stringify(message));
        }
    };

    /**
     * open (or close an open) a connection to blisstribute websocket
     *
     * @param socketLink
     */
    connectToWebSocket = (socketLink) => {
        if (this.currentConnection) {
            if (this.currentConnection.connected) {
                this.currentConnection.close();
            }

            this.currentConnection = null;
        }

        if (this.socket) {
            this.socket = null;
        }

        this.socket = new WebSocketClient();
        this.socket.on('connectFailed', function(error) {
            logWarning('webSocketHandler', 'connectToWebSocket', 'connection failed: ' + error.toString());
        });

        this.socket.on('connect', function(connection) {
            this.currentConnection = connection;
            logInfo('webSocketHandler', 'onConnect', 'instance registered ' + this.logModIdentification);
            showNotification('LogModMobile wurde erfolgreich als %s registriert.'.replace('%s', this.logModIdentification));

            this._registerHeartbeat();

            this.currentConnection.on('error', this._connectionError);
            this.currentConnection.on('close', this._connectionClose);
            this.currentConnection.on('message', this._handleMessage);
        }.bind(this));

        this.socket.connect(socketLink);
    };

    _connectionError = (error) => {
        logWarning('webSocketHandler', 'onError', 'error occurred: ' + error.toString());
        showNotification('LogModMobile - Fehler in der WebSocket-Verbindung: ' + error.toString());
    }

    _connectionClose = () => {
        logWarning('webSocketHandler', '_connectionClose', 'connection closed');
        if (this.currentConnection) {
            this.currentConnection.close();
            logDebug('webSocketHandler', '_connectionClose', 'connection instance closed');
        }

        if (this.heartbeatIntervalPID) {
            clearInterval(this.heartbeatIntervalPID);
            logDebug('webSocketHandler', '_connectionClose', 'heartbeat interval removed');
        }

        showNotification('LogModMobile - Die aktuelle WebSocket-Verbindung wurde geschlossen.');
    };
    
    /**
     * handle the websocket message
     * @param {{type: string, utf8Data: string}} message
     * @private
     */
    _handleMessage = (message) => {
        if (message.type !== 'utf8') {
            logWarning('webSocketHandler', 'onMessage', 'skip processing. message not utf8 encoded ' + JSON.stringify(message));
            return;
        }

        const socketEvent = JSON.parse(message.utf8Data);
        logDebug('webSocketHandler', 'onMessage', 'message received: ' + JSON.stringify(socketEvent));

        switch(socketEvent.event.toUpperCase()) {
            case PREVIOUS_SHIP_OUT_EVENT: {
                if (!this._isMessageForMe(socketEvent)) {
                    return;
                }

                eventEmitter.emit('shipOutPrevious', socketEvent.data);
                break;
            }
            case MULTI_PACKAGE_SUPPLY_NOTE_EVENT: {
                if (!this._isMessageForMe(socketEvent)) {
                    return;
                }

                eventEmitter.emit('multiPackageSupplyNotePrint', socketEvent.data);
                break;
            }
            case SHIP_OUT_EVENT: {
                if (!this._isMessageForMe(socketEvent)) {
                    return;
                }

                eventEmitter.emit('shipOut', socketEvent.data);
                break;
            }
            case PRINT_EVENT: {
                eventEmitter.emit('requestDocuments', socketEvent.data);
                break;
            }
            case PICK_BOX_READY: {
                if (!this._isInvoicePrintingActive(socketEvent.data) || this._pickListNeedsAdditionalDocuments(socketEvent.data)) {
                    return;
                }
                
                eventEmitter.emit('pickBoxReady', socketEvent.data);
                break;
            }
            case PICK_LIST_FINISHED: {
                if (!this._isAdditionalDocumentPrintingActive(socketEvent.data) || !this._pickListNeedsAdditionalDocuments(socketEvent.data)) {
                    return;
                }
                
                eventEmitter.emit('pickListNeedsAdditionalDocuments', socketEvent.data);
                break;
            }
            default: {
                break;
            }
        }
    };
    
    /**
     * checks if socket message is for me
     *
     * @param {{}} socketMessage
     * @returns {boolean}
     * @private
     */
    _isMessageForMe = (socketMessage) => {
        const ident = getLogModIdentification();
        const { data: messageData, receiverLogModIdent } = socketMessage;
        return (messageData.hasOwnProperty('logModIdent') && messageData.logModIdent === ident)
            || (receiverLogModIdent === ident);

    };
    
    /**
     * checks if automatic invoice process is active and box is watched
     *
     * @param {{}} messageData
     * @returns {boolean}
     * @private
     */
    _isInvoicePrintingActive = (messageData) => {
        if (!config.has('invoicing.watchBoxes') || !messageData.pickBoxIdent) {
            return false;
        }

        const ident = getLogModIdentification();
        if (messageData.logModIdent === ident) {
            return true;
        }
        
        const watchPattern = new RegExp(config.get('invoicing.watchBoxes'));
        return watchPattern.test(messageData.pickBoxIdent);
    };
    
    /**
     * checks if automatic additional document printing is enabled
     *
     * @param {{}} messageData
     * @returns {boolean}
     * @private
     */
    _isAdditionalDocumentPrintingActive = (messageData) => {
        if (!config.has('printing.printAdditionalDocuments')) {
            return false;
        }
        
        return config.get('printing.printAdditionalDocuments');
    };
    
    /**
     * checks if pick list not containing shipping request items
     *
     * @param {{}} messageData
     * @returns {boolean}
     * @private
     */
    _pickListNeedsAdditionalDocuments = (messageData) => {
        if (!messageData.hasOwnProperty('pickListNumber') || !messageData.hasOwnProperty('pickListType')) {
            logDebug('webSocketHandler', '_pickListNeedsAdditionalDocuments', 'no additional documents needed');
            return false;
        }
        
        return messageData.pickListType > 1;
    }

    /**
     * registers the heartbeat interval
     *
     * @private
     */
    _registerHeartbeat = () => {
        if (this.heartbeatIntervalPID) {
            logDebug('webSocketHandler', '_registerHeartbeat', 'cleaning up old heartbeat interval');
            clearInterval(this.heartbeatIntervalPID);
        }

        let heartbeatInterval = 30;
        if (config.has('app.heartbeatInterval')) {
            heartbeatInterval = config.get('app.heartbeatInterval');
        }
        this.heartbeatIntervalPID = setInterval(this._heartbeat, heartbeatInterval * 1000);
        logDebug('webSocketHandler', '_registerHeartbeat', 'heartbeat registered with interval ' + heartbeatInterval);

    };

    /**
     * heartbeat routine
     *
     * @private
     */
    _heartbeat = () => {
        logDebug('webSocketHandler', '_heartbeat', 'try sending heartbeat...');
        this.sendMessage({event: 'logModHeartBeat', type: 'logMod', 'receiverUserId': 0, logModIdent: null, data: {logModIdent: this.logModIdentification}});
    };
}


module.exports = WebSocketHandler;
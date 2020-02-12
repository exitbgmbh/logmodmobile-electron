const showNotification = require('./../notificationHelper');
const config = require('config');
const WebSocketClient = require('websocket').client;
const WebSocketConnection = require('websocket').connection;
const { logInfo, logDebug, logWarning } = require('./../logging');
const eventEmitter = require('./eventEmitter');
const {getLogModIdentification} = require("../helper");

const SHIP_OUT_EVENT = 'LOGMODSHIPOUT';
const PRINT_EVENT = 'LOGMODPRINT';
const PICK_BOX_READY = 'PICKBOXREADY';

class WebSocketHandler
{
    constructor() {
        eventEmitter.on('shipOutFailed', this.sendMessage);
        eventEmitter.on('shipOutSucceed', this.sendMessage);
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
        this.currentConnection.send(JSON.stringify(message));
    };

    /**
     * open (or close an open) a connection to blisstribute websocket
     *
     * @param socketLink
     */
    connectToWebSocket = (socketLink) => {
        // we need to close the current connection first
        if (this.socket && this.currentConnection) {
            this.currentConnection.close();
            this.currentConnection = null;
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

            this.currentConnection.on('error', function(error) {
                logWarning('webSocketHandler', 'onError', 'error occurred: ' + error.toString());
                showNotification('LogModMobile - Fehler in der WebSocket-Verbindung: ' + error.toString());
            });
            this.currentConnection.on('close', function() {
                logWarning('webSocketHandler', 'onClose', 'connection closed');
                showNotification('LogModMobile - Die aktuelle WebSocket-Verbindung wurde geschlossen.');
            });

            this.currentConnection.on('message', this._handleMessage);
        }.bind(this));

        this.socket.connect(socketLink);
    };

    _handleMessage = (message) => {
        if (message.type !== 'utf8') {
            logWarning('webSocketHandler', 'onMessage', 'skip processing. message not utf8 encoded ' + JSON.stringify(message));
            return;
        }

        const socketEvent = JSON.parse(message.utf8Data);
        logDebug('webSocketHandler', 'onMessage', 'message received: ' + JSON.stringify(socketEvent));

        switch(socketEvent.event.toUpperCase()) {
            case SHIP_OUT_EVENT: {
                eventEmitter.emit('shipOut', socketEvent.data);
                break;
            }
            case PRINT_EVENT: {
                eventEmitter.emit('print', socketEvent.data);
                break;
            }
            case PICK_BOX_READY: {
                if (!this._isMessageForMe(socketEvent.data)) {
                    return;
                }
                
                eventEmitter.emit('pickBoxReady', socketEvent.data);
                break;
            }
            default: {
                break;
            }
        }
    };

    _isMessageForMe = (messageData) => {
        const ident = getLogModIdentification();
        return messageData.hasOwnProperty('logModIdent') && messageData.logModIdent === ident;
    };

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
        logDebug('webSocketHandler', '_heartbeat', 'sending heartbeat...');
        this.sendMessage({event: 'logModHeartBeat', type: 'logMod', 'receiverUserId': 0, logModIdent: null, data: {logModIdent: this.logModIdentification}});
    };
}


module.exports = WebSocketHandler;
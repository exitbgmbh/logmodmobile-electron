const showNotification = require('./notificationHelper');
const config = require('config');
const WebSocketClient = require('websocket').client;
const WebSocketConnection = require('websocket').connection;
const { logInfo, logDebug, logWarning } = require('./logging');

class WebSocketHandler
{
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
            console.log('Connect Error: ' + error.toString());
        });

        this.socket.on('connect', function(connection) {
            this.currentConnection = connection;
            showNotification('LogModMobile wurde erfolgreich als %s registriert.'.replace('%s', this.logModIdentification));

            this._registerHeartbeat();

            this.currentConnection.on('error', function(error) {
                showNotification('LogModMobile - Fehler in der WebSocket-Verbindung: ' + error.toString());
            });
            this.currentConnection.on('close', function() {
                showNotification('LogModMobile - Die aktuelle WebSocket-Verbindung wurde geschlossen.');
            });

            this.currentConnection.on('message', function(message) {
                if (message.type === 'utf8') {
                    console.log("Received: '" + message.utf8Data + "'");
                }
            });
        }.bind(this));

        this.socket.connect(socketLink);
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
        const heartbeatMessage = {event: 'logModHeartBeat', type: 'logMod', 'receiverUserId': 0, logModIdent: null, data: {logModIdent: this.logModIdentification}};
        this.currentConnection.send(JSON.stringify(heartbeatMessage));
    };

}


module.exports = new WebSocketHandler();
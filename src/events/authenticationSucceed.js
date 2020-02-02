const WebSocketClient = require('websocket').client;
const { getAxiosInstance } = require(__dirname + '/../axiosHelper');
const os = require('os');
const Notification = require('electron').Notification;


let axiosInstance, socket;
const authenticationSucceed = (event, arguments) => {
    console.log('authentication-succeed', arguments);
    if (!axiosInstance) {
        console.log('init axios instance');
        axiosInstance = getAxiosInstance(arguments.authenticationToken);
    }

    const logModMobileIdent = 'LOG-' + os.hostname();

    let url = new URL(arguments.requestUrl);
    url.searchParams.append('logModIdent', logModMobileIdent);

    console.log('call for websocket');
    axiosInstance.get(url.toString()).then((response) => {
        const connectionInitNotification = {
            body: "LogModMobile wird registriert...",
            icon: __dirname + "/../../static/assets/logmodmobile-32.png"
        };
        new Notification(connectionInitNotification).show();
        const {socketLink} = response.data.response;

        socket = new WebSocketClient();
        socket.on('connectFailed', function(error) {
            console.log('Connect Error: ' + error.toString());
        });
        socket.on('connect', function(connection) {
            console.log('WebSocket Client Connected');
            const connectionSucceedNotification = {
                body: 'LogModMobile wurde erfolgreich als %s registriert.'.replace('%s', logModMobileIdent),
                icon: __dirname + '/../../static/assets/logmodmobile-32.png'
            };
            new Notification(connectionSucceedNotification).show();

            connection.on('error', function(error) {
                console.log("Connection Error: " + error.toString());
            });
            connection.on('close', function() {
                console.log('echo-protocol Connection Closed');
            });
            connection.on('message', function(message) {
                if (message.type === 'utf8') {
                    console.log("Received: '" + message.utf8Data + "'");
                }
            });
        });

        socket.connect(socketLink);
    }).catch((error) => {
        console.log(error)
    });
};

module.exports = authenticationSucceed;
const getAxiosInstance = require(__dirname + '/../axiosHelper');
const os = require('os');
const { logInfo, logDebug, logWarning } = require('./../logging');
const showNotification = require('./../notificationHelper');
const webSocketHandler = require('./../webSocketHandler');

let axiosInstance;
const authenticationSucceed = (event, arguments) => {
    logDebug('event', 'authenticationSucceed', 'start ' + JSON.stringify(arguments));
    if (!axiosInstance) {
        axiosInstance = getAxiosInstance(arguments.authenticationToken);
    }

    const logModMobileIdent = 'LOG-' + os.hostname();
    let url = new URL(arguments.requestUrl);
    url.searchParams.append('logModIdent', logModMobileIdent);
    logDebug('event', 'authenticationSucceed', 'call for websocket ' + url.href);

    axiosInstance.get(url.toString()).then((response) => {
        showNotification('LogModMobile wird registriert...');
        const { socketLink } = response.data.response;

        webSocketHandler.setLogModIdentification(logModMobileIdent).connectToWebSocket(socketLink);
    })
    .catch((error) => {
        logWarning('event', 'authenticationSucceed', 'call for websocket failed ' + error.message);
    });
};

module.exports = authenticationSucceed;
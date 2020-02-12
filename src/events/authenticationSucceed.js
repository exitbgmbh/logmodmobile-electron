const restClientInstance = require('./../restClient');
const { logInfo, logDebug, logWarning } = require('./../logging');
const showNotification = require('./../notificationHelper');
const webSocketHandler = require('./../websocket');
const { getLogModIdentification } = require('./../helper');

const authenticationSucceed = (event, arguments) => {
    logDebug('event', 'authenticationSucceed', 'start ' + JSON.stringify(arguments));
    restClientInstance.setAuthToken(arguments.authenticationToken);
    restClientInstance.parseBaseUrl(arguments.requestUrl);

    const logModMobileIdent = getLogModIdentification();
    restClientInstance.requestWebSocketAccessLink(logModMobileIdent).then((response) => {
        showNotification('LogModMobile wird registriert...');
        console.log(response);
        const { socketLink } = response.response;

        webSocketHandler.setLogModIdentification(logModMobileIdent).connectToWebSocket(socketLink);
    }).catch((error) => {
        logWarning('event', 'authenticationSucceed', 'call for websocket failed ' + error.message);
    });
};

module.exports = authenticationSucceed;
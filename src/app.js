const axios = require('axios');
const os = require('os');
const version = require(__dirname + '/../package').version;
const { autoUpdater } = require("electron-updater");

const index = require('electron');
const { ipcMain } = require('electron');

const BrowserWindow = index.BrowserWindow;
const path = require('path');
const url = require('url');

const WebSocketClient = require('websocket').client;

const isDevelopment = process.env.NODE_ENV === 'development';

let mainWindow;
function showWindow() {
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        console.log(log_message);
    });
    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded');
    });

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, '/../static/assets/logmodmobile.png'),
        webPreferences: {
            nodeIntegration: true,
            preload: __dirname + '/preload.js'
        }
    });

    const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    console.log(__dirname);
    mainWindow.setMenu(null);
    mainWindow.loadURL(startUrl).then(() => {
        mainWindow.setTitle(mainWindow.getTitle() + ' • Client %s'.replace('%s', version));
    });

    if (isDevelopment) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', function () {
        mainWindow = null
    });
}

ipcMain.on('websocket-connected', (event, arg) => {
    console.log('websocket-connected', arg);
    //event.reply('asynchronous-reply', 'pong')
});
ipcMain.on('websocket-disconnected', (event, arg) => {
    console.log('websocket-disconnected', arg);
    //event.reply('asynchronous-reply', 'pong')
});

let axiosInstance, socket;
ipcMain.on('authentication-succeed', (event, arg) => {
    console.log('authentication-succeed', arg);
    if (!axiosInstance) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${arg.authenticationToken}`;
        axios.defaults.headers.common['X-DEVICE-ID'] = 'Electron ' + os.hostname();
        axios.defaults.headers.common['X-APP-VERSION'] = version;

        axiosInstance = axios.create();
    }

    axiosInstance.get(arg.requestUrl).then((response) => {
        const {socketLink} = response.data.response;
        socket = new WebSocketClient();
        socket.on('connectFailed', function(error) {
            console.log('Connect Error: ' + error.toString());
        });
        socket.on('connect', function(connection) {
            console.log('WebSocket Client Connected');
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

        socket.connect(socketLink + '&L=EL-' + os.hostname());
    }).catch((error) => {
        console.log(error)
    });
});

module.exports = {
    startElectronApp: showWindow,
    windowInstance: mainWindow
};
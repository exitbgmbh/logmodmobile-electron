const app = require('electron');
const version = require('./../package').version;
const BrowserWindow = app.BrowserWindow;
const path = require('path');
const registerEvents = require('./events');

const isDevelopment = process.env.NODE_ENV === 'development';

let mainWindow;
function showWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, '/../static/assets/logmodmobile-64.png'),
        webPreferences: {
            nodeIntegration: true,
            preload: __dirname + '/preload.js'
        }
    });

    const startUrl = process.env.ELECTRON_START_URL || 'https://www.exitb.de';
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

    registerEvents();
}

module.exports = {
    startElectronApp: showWindow,
    windowInstance: mainWindow
};
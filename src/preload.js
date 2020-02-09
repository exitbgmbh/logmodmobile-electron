const os = require('os');
const printer = require('pdf-to-printer');
const config = require('config');

const isDevelopment = process.env.NODE_ENV === 'development';

window.ipcRenderer = require('electron').ipcRenderer;
window.printer = printer;
window.deviceId = 'EL-' + os.hostname();

if (isDevelopment) {
    window.devData = {};
    if (config.has('app.username')) {
        window.devData = {...window.devData, userName: config.get('app.username')}
    }
    if (config.has('app.password')) {
        window.devData = {...window.devData, password: config.get('app.password')}
    }
}

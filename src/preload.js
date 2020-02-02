const os = require('os');
const printer = require('pdf-to-printer');

window.ipcRenderer = require('electron').ipcRenderer;
window.printer = printer;
window.deviceId = 'EL-' + os.hostname();

if (process.env.LM_USER || process.env.LM_PASSWORD) {
    window.devData = {userName: process.env.LM_USER, password: process.env.LM_PASSWORD}
}
const os = require('os');
const printer = require('pdf-to-printer');

window.ipcRenderer = require('electron').ipcRenderer;
window.printer = printer;
window.deviceId = 'EL-' + os.hostname();
const os = require('os');
const printer = require('pdf-to-printer');
const config = require('config');
const { PromiseIpc } = require('electron-promise-ipc');
const promiseIpc = new PromiseIpc({maxTimeoutMs: 1000});
const { ipcRenderer } = require('electron')
const version = require('./../package').version;

const isDevelopment = process.env.NODE_ENV === 'development';

window.ipcRenderer = ipcRenderer;
window.promiseIpc = promiseIpc;
window.printer = printer;
// platform independent printer list from the electron backend, see docs/websocket-printing.md
window.getPrinterList = () => ipcRenderer.invoke('printer-list');
window.deviceId = 'EL-' + os.hostname();
window.elVersion = version;
window.invoiceDirectPrinting = (config.has('invoicing.directPrinting') && config.get('invoicing.directPrinting')) || false;

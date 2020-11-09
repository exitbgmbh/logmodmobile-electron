const app = require('electron').app;
const log = require('electron-log');
log.transports.file.maxSize = 10485760;

if (process.env.NODE_ENV !== 'development') {
    console.log = log.log;
    const { checkConfig } = require('./setupConfig');
    checkConfig(app);
}

const init = require('./src/application');
init(app);

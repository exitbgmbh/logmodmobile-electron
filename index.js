const app = require('electron').app;
const log = require('electron-log');
log.transports.file.maxSize = 10485760;

log.transports.file.maxSize = 10485760;
log.variables.pid = process.pid;

log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{pid}] [{level}]{scope} {text}';
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{pid}] [{level}]{scope} {text}';

if (process.env.NODE_ENV !== 'development') {
    console.log = log.log;
    const { checkConfig } = require('./setupConfig');
    checkConfig(app);
}

const init = require('./src/application');
init(app);

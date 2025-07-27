const log = require('electron-log');

console.log(process.versions)
console.log(process.version)
console.log(`Node.js ABI version: ${process.versions.modules}`);
console.log(`env: ${process.env}`);

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

log.transports.file.maxSize = 104857600;
log.variables.pid = process.pid;

log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{pid}] [{level}]{scope} {text}';
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{pid}] [{level}]{scope} {text}';

log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{pid}] [{level}]{scope} {text}';
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{pid}] [{level}]{scope} {text}';

if (process.env.NODE_ENV !== 'development') {
    console.log = log.log;
    const { checkConfig } = require('./setupConfig');
    checkConfig();
}

const init = require('./src/application');
init();
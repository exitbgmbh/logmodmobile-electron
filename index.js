const app = require('electron').app;

if (process.env.NODE_ENV !== 'development') {
    const { checkConfig } = require('./setupConfig');
    checkConfig(app);
}

const init = require('./src/application');
init(app);

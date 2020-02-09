const app = require('electron').app;
const checkConfig = require('./setupConfig');
checkConfig(app);

const init = require('./src/application');
init(app);

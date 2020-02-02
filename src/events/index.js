const { ipcMain } = require('electron');
const authenticationSucceed = require('./authenticationSucceed');
const initAutoUpdate = require('./autoUpdate');

const registerEvents = () => {
    initAutoUpdate();

    ipcMain.on('authentication-succeed', authenticationSucceed);
};

module.exports = registerEvents;
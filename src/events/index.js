const { ipcMain } = require('electron');
const authenticationSucceed = require('./authenticationSucceed');

const registerEvents = () => {
    ipcMain.on('authentication-succeed', authenticationSucceed);
};

module.exports = registerEvents;
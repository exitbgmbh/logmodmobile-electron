const { ipcMain } = require('electron');
const authenticationSucceed = require('./authenticationSucceed');

const registerEvents = () => {
    //initAutoUpdate();

    ipcMain.on('authentication-succeed', authenticationSucceed);
    ipcMain.on('authentication-succeed', () => {console.log(
        'second listener'
    )});
};

module.exports = registerEvents;
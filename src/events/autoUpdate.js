const { autoUpdater } = require("electron-updater");

const initAutoUpdate = () => {
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        console.log(log_message);
    });
    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded');
    });
};

module.exports = initAutoUpdate;

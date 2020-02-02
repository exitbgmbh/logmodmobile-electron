const index = require('electron');
const app = index.app;
const { startElectronApp, windowInstance } = require(__dirname + '/src/app');

require('dotenv').config({path: __dirname + '/auth.env'});

app.on('ready', startElectronApp);
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (windowInstance === null) {
        startElectronApp()
    }
});

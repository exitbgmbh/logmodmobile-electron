const config = require('config');
const path = require('path');
const fs = require('fs');
const {logInfo, logDebug, logWarning} = require('./../logging');
const {session} = require("electron");

class WebcamHandler {
    initialized = false;

    savePhoto = (data) => {
        if (!this.initialized) {
            logWarning('webcamHandler', 'savePhoto', 'webcamHandler not setup properly.')
            return;
        }

        const { imgRawData, orderNumber, invoiceNumber } = data;
        const base64Data = imgRawData.replace(/^data:image\/png;base64,/, '');

        const now = new Date().toISOString();
        const date     = now.slice(0, 10);
        const dateTime = now.slice(0, 19).replace('T', '_');
        const time     = now.slice(11, 19).replace(/:/g, '-');

        const filename = config.get('webcam.shipoutPhotoSaveFileName')
            .replace('{%orderNumber}', orderNumber)
            .replace('{%invoiceNumber}', invoiceNumber)
            .replace('{%date}', date)
            .replace('{%dateTime}', dateTime)
            .replace('{%time}', time);

        fs.writeFileSync(filename, base64Data, 'base64');

        logDebug('webcamHandler', 'savePhoto', 'photo saved as ', filename);

        return filename;
    }

    initialize = () => {
        this.ensureCamSetup();
        this.requestMediaPermissions().then(() => {
            this.setupPermissions();
        })
    }

    // Create save folder in user's Pictures
    ensureCamSetup = () => {
        if (!config.has('webcam.shipoutPhotoSaveFileName')) {
            logWarning('webcamHandler', 'ensureCamSetup', 'webcamHandler not setup properly.',)
            this.initialized = false;

            return false;
        }

        this.initialized = true;
        return true;
    }

    requestMediaPermissions = async () => { // @conrad funktioniert das ueberhaupt? systemPreferences hat doch gar keine referenz?
        if (process.platform !== 'darwin') {
            return new Promise((resolve, reject) => {
                resolve(true);
            });
        }

        try {
            const cameraGranted = await systemPreferences.askForMediaAccess('camera');
            logInfo('webcamHandler', 'requestMediaPermissions', `Camera permission (macOS): ${cameraGranted ? 'GRANTED' : 'DENIED'}`)

            if (cameraGranted) {
                return new Promise((resolve, reject) => {
                    resolve(true);
                });
            } else {
                return new Promise((resolve, reject) => {
                    reject();
                });
            }
            // Optional: also ask for microphone if needed later
            // const microphoneGranted = await systemPreferences.askForMediaAccess('microphone');
            // logInfo('webcamHandler', 'requestMediaPermissions', `Microphone permission (macOS): ${microphoneGranted ? 'GRANTED' : 'DENIED'}`)
        } catch (err) {
            logWarning('webcamHandler', 'requestMediaPermissions', 'Failed to request media access')
            console.error('Failed to request media access:', err);
        }

        return new Promise((resolve, reject) => {
            reject();
        });
    }


    setupPermissions = () => {
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            console.log(`Permission requested: ${permission}`);
            if (permission === 'camera' || permission === 'media') {
                callback(true);   // Auto-approve
            } else {
                callback(false);
            }
        });
    }
}

module.exports = WebcamHandler;

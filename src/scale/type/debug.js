const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const SerialPort = require('serialport');

class Debug extends AbstractScale {
    parser = new SerialPort.parsers.Delimiter('<GB>');
    command = Buffer.from([]);
    
    constructor(scaleConfig) {
        super(scaleConfig);
        this.command = Buffer.from(scaleConfig['command']);
    }
    
    scale = () => {
        logDebug('Debug', 'scale', 'start');
        return this._scale(this.command).then((data) => {
            logDebug('Debug', 'scale', 'got data from abstract ' + data);
            logDebug('Debug', 'scale', 'data ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = Debug;
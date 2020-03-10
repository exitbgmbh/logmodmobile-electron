const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const SerialPort = require('serialport');

class Rhewa82 extends AbstractScale {
    parser = new SerialPort.parsers.Delimiter({delimiter: [0x3c, 0x47, 0x42, 0x3e]});
    command = Buffer.from([0x3c, 0x47, 0x42, 0x31, 0x3e]);
    
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('Rhewa82', 'scale', 'start');
        return this._scale(this.command).then((data) => {
            logDebug('Rhewa82', 'scale', 'got data from abstract ' + data);
            logDebug('Rhewa82', 'scale', 'data after postprocessing ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = Rhewa82;
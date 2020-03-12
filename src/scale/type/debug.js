const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const SerialPort = require('serialport');

class Debug extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('Debug', 'scale', 'start');
        const command = Buffer.from(scaleConfig['command']);
        const parser = new SerialPort.parsers.Delimiter({delimiter: scaleConfig['parserDelimiter']});
        
        return this._scale(command, parser).then((data) => {
            logDebug('Debug', 'scale', 'got data from abstract ' + data);
            logDebug('Debug', 'scale', 'data ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = Debug;
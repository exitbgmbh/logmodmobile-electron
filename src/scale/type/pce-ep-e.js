const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const SerialPort = require('serialport');

class PCE_EP_E extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('PCE-EP-E', 'scale', 'start');
        const parser = new SerialPort.parsers.Delimiter({delimiter: [0x0d, 0x0a, 0x0d, 0x0a]});
        const command = Buffer.from([0x50]);
        
        return this._scale(command, parser).then((data) => {
            
            logDebug('PCE-EP-E', 'scale', 'got data from abstract ' + data);
            if (data) {
                data = data.match(/\d+\.\d+[a-z]+/).toString().replace(/[\skg]+/, '');
            }
            
            logDebug('PCE-EP-E', 'scale', 'data after postprocessing ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = PCE_EP_E;
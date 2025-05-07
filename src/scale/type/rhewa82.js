const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const { DelimiterParser } = require('@serialport/parser-delimiter');

class Rhewa82 extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('Rhewa82', 'scale', 'start');
        const parser = new DelimiterParser({delimiter: [0x3c, 0x47, 0x42, 0x3e]});
        const command = Buffer.from([0x3c, 0x47, 0x42, 0x31, 0x3e]);
        
        return this._scale(command, parser).then((data) => {
            logDebug('Rhewa82', 'scale', 'got data from abstract ' + data);
            logDebug('Rhewa82', 'scale', 'data after postprocessing ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = Rhewa82;
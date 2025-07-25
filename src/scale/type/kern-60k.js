const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const { DelimiterParser } = require('@serialport/parser-delimiter');

class Kern60k extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('Kern60k', 'scale', 'start');
        const parser = new DelimiterParser({delimiter: [0x0D, 0x0A]});
        const command = Buffer.from([0x53, 0x0D, 0x0A]);
        
        return this._scale(command, parser).then((data) => {
            logDebug('Kern60k', 'scale', 'got data from abstract ' + data);
            if (data) {
                data = data.match(/ST,GS\s\d+\.\d+kg/).toString().replace(/[ST,GS\s]+/, '').replace(/[kg]+/, '');
            }
            
            logDebug('Kern60k', 'scale', 'data after postprocessing ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = Kern60k;
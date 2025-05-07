const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const { ReadlineParser } = require('@serialport/parser-readline');

class PCE_PB_N extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('PCE-PB-N', 'scale', 'start');
        const parser = new ReadlineParser();
        const command = Buffer.from([0x53, 0x78, 0x0d, 0x0a]);
        
        return this._scale(command, parser).then((data) => {
            logDebug('PCE-PB-N', 'scale', 'got data from abstract ' + data);
            if (data) {
                data = data.match(/\d+\.\d+[a-z]+/).toString().replace(/[\skg]+/, '');
            }
            
            logDebug('PCE-PB-N', 'scale', 'data after postprocessing ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = PCE_PB_N;
const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');


class PLC6000 extends AbstractScale {
    command = [0x1b, 0x70];
    
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('PLC6000', 'scale', 'start');
        return this._scale(this.command).then((data) => {
            logDebug('PLC6000', 'scale', 'got data from abstract ' + data);
            
            if (data) {
                data = Number(data.trim().replace(/[\sA-Za-z]+/, ''));
                data = (data / 1000).toFixed(2);
            } else {
                data = Number(0);
            }
            logDebug('PLC6000', 'scale', 'data after postprocessing ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = PLC6000;
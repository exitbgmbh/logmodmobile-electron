const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');


class Debug extends AbstractScale {
    command = [0x1b, 0x70];
    
    constructor(scaleConfig) {
        super(scaleConfig);
        this.command = scaleConfig['command'];
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
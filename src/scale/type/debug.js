const AbstractScale = require('./abstract');
const {logDebug} = require('./../../logging');
const { DelimiterParser } = require('@serialport/parser-delimiter');

class Debug extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('Debug', 'scale', 'start');
        const command = Buffer.from(this.scaleConfig['command']);
        const parser = new DelimiterParser({delimiter: this.scaleConfig['parserDelimiter']});
        
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
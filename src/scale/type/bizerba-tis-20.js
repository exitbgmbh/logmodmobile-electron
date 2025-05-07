const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');
const { DelimiterParser } = require('@serialport/parser-delimiter');

class BizerbaTis20 extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('BizerbaTis20', 'scale', 'start');
        const parser = new DelimiterParser({delimiter: [0x0D, 0x0A]});
        const command = Buffer.from([0x71, 0x25, 0x0D, 0x0A]);
        
        return this._scale(command, parser).then((data) => {
            logDebug('BizerbaTIS20', 'scale', 'got data from abstract ' + data);
            if (data) {
                data = data.match(/\d+,\d+[a-z]+/).toString().replace(/[+!\skg]+/, '').replace(/[,]/, '\.');
            }
            
            logDebug('BizerbaTIS20', 'scale', 'data after postprocessing ' + data);
            
            return new Promise((resolve) => {
                resolve(data);
            });
        });
    }
}

module.exports = BizerbaTis20;
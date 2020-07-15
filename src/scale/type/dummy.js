const AbstractScale = require('./abstract');
const {logDebug, logInfo, logWarning} = require('./../../logging');

class Dummy extends AbstractScale {
    constructor(scaleConfig) {
        super(scaleConfig);
    }
    
    scale = () => {
        logDebug('Dummy', 'scale', 'start');
        return new Promise((resolve) => {
            const max = 100,
                min = 1;

            const number = Math.random() * (max - min) + min;
            resolve(number.toFixed(2));
        });
    }
}

module.exports = Dummy;
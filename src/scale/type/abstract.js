const {logDebug, logInfo, logWarning} = require('./../../logging');
const { SerialPort } = require('serialport');

class AbstractScale {
    scaleConfig = null;
    
    constructor(scaleConfig) {
        if (this.constructor === AbstractScale) {
            throw new TypeError('Abstract class "AbstractScale" cannot be instantiated directly.');
        }
        
        this.scaleConfig = scaleConfig;
    }
    
    _scale = (command, parser) => {
        logDebug('abstractScale', '_scale', 'start');
        const connector = new SerialPort({ path: this.scaleConfig.path, baudRate: this.scaleConfig.baud });
        connector.on('open', (err) => {
            if (err) {
                logWarning('abstractScale', '_scale', 'could not connect scale ' + err.message);
                return new Promise((resolve, reject) => reject(err.message));
            }
    
            logDebug('abstractScale', '_scale', 'scale connected');
        });
        
        connector.pipe(parser);
        
        console.log('sending command', command);
        connector.on('data', (connData) => {
            console.log('>>', connData);
        });
    
        connector.write(command);
        return new Promise(resolve => parser.on('data', (data) => {
            logDebug('abstractScale', '_scale', 'got raw data ' + data);
            
            connector.close();
            logDebug('abstractScale', '_scale', 'scale disconnected');
            
            resolve(data.toString());
        }));
    }
}

module.exports = AbstractScale;
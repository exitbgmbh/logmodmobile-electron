const {logDebug, logInfo, logWarning} = require('./../../logging');
const SerialPort = require('serialport');

class AbstractScale {
    scaleConfig = null;
    
    constructor(scaleConfig) {
        if (this.constructor === AbstractScale) {
            throw new TypeError('Abstract class "AbstractScale" cannot be instantiated directly.');
        }
        
        this.scaleConfig = scaleConfig;
    }
    
    _scale = (command) => {
        logDebug('abstractScale', '_scale', 'start');
        const connector = new SerialPort(this.scaleConfig.path, {
            baudRate: this.scaleConfig.baud
        });
        connector.on('open', (err) => {
            if (err) {
                logWarning('abstractScale', '_scale', 'could not connect scale ' + err.message);
                return new Promise((resolve, reject) => reject(err.message));
            }
    
            logDebug('abstractScale', '_scale', 'scale connected');
        });
        
        const parser = new SerialPort.parsers.Readline();
        connector.pipe(parser);
    
        connector.write(command);
        return new Promise(resolve => parser.on('data', (data) => {
            logDebug('abstractScale', '_scale', 'got raw data ' + data);
            
            connector.close();
            logDebug('abstractScale', '_scale', 'scale disconnected');
            
            resolve(data);
        }));
    }
}

module.exports = AbstractScale;
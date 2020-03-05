const config = require('config');
const SerialPort = require('serialport');

class ScaleHandler {
    active = false;
    reading = false;
    command = [];
    connector = false;
    parser = false;

    initialize = () => {
        if (!config.has('scale')) {
            return;
        }
        
        this.command = config.get('scale.command');
        this.parser = new SerialPort.parsers.Readline();
        
        this.connector = new SerialPort(config.get('scale.path'), {
            baudRate: config.get('scale.baud'),
            autoOpen: false
        });
        this.connector.pipe(this.parser);
        this.connector.open(function(err) {
            if (err) {
                this.active = false;
                return console.log('error connecting serial port: ', err.message);
            }
            
            this.active = true;
        }.bind(this));
    };
    
    callScale = (callback) => {
        if (!this.active) {
            return;
        }
        
        if (this.reading) {
            return;
        }
        
        this.reading = true;
        this.connector.write(Buffer.from(this.command));
        setTimeout(() => {
            const data = this.parser.read().trim().replace(/\s[a-zA-Z]/, '');
            this.reading = false;
            callback(data);
        }, 250);
        
    }
    
}

module.exports = ScaleHandler;
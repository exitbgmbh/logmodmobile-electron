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
        console.log('callScale');
        if (!this.active) {
            console.log('not active');
            return;
        }
        
        if (this.reading) {
            console.log('is reading');
            return;
        }
        
        this.reading = true;
        this.connector.write(Buffer.from(this.command));
        setTimeout(() => {
            let data = this.parser.read();
            console.log(data);
            if (data) {
                data = data.trim().replace(/\s[a-zA-Z]/, '');
            }
            
            this.reading = false;
            callback(data);
        }, 500);
        
    }
    
}

module.exports = ScaleHandler;
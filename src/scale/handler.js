const config = require('config');
const SerialPort = require('serialport');

class ScaleHandler {
    active = true;
    reading = false;
    command = [];
    connector = false;
    parser = false;

    initialize = () => {
        if (!config.has('scale')) {
            this.active = false;
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
            
            console.log('connected to serial port');
            this.active = true;
        }.bind(this));
    };
    
    callScale = () => {
        if (!this.active) {
            console.log('not active');
            return;
        }
    
        this.connector.write(this.command);
        return new Promise(resolve => this.parser.on('data', (data) => {
            if (data) {
                data = data.trim().replace(/[\sA-Za-z]+/, '');
            }
            
            resolve(data);
        }));
    }
    
}

module.exports = ScaleHandler;
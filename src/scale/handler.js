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
            this.active = false;
            return;
        }
        
        this.command = config.get('scale.command');
        this.parser = new SerialPort.parsers.Readline('\r\n');
        
        this.connector = new SerialPort(config.get('scale.path'), {
            baudRate: config.get('scale.baud'),
            autoOpen: false
        });
        //this.connector.pipe(this.parser);
        this.connector.open(function(err) {
            if (err) {
                this.active = false;
                return console.log('error connecting serial port: ', err.message);
            }
            
            console.log('connected to serial port');
            this.active = true;
        }.bind(this));
        this.connector.on('error', function(err) {
            console.log(err);
        });
    };
    
    callScale = () => {
        if (!this.active) {
            console.log('not active');
            return new Promise((resolve, reject) => { reject('not active'); })
        }
    
        if (!this.connector.write(this.command, function(err) {
            if (err) {
                console.log('error writing data', err.message);
                return new Promise((resolve,reject) => {
                    reject(err);
                });
            }
            
            console.log('data written');
        })) {
            console.log('could not write data');
        }
        return new Promise(resolve => this.connector.on('data', (data) => {
            resolve(data);
        }));
    }
    
}

module.exports = ScaleHandler;
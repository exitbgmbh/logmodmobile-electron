const config = require('config');
const SerialPort = require('serialport');
const PLC6000 = require('./type/plc6000');
const Rhewa82 = require('./type/rhewa82');
const PCE_EP_E = require('./type/pce-ep-e');
const Debug = require('./type/debug');
const Random = require('./type/random');
const PCE_PB_N = require("./type/pce-pb-n");
const BizerbaTis20 = require("./type/bizerba-tis-20");
const {logDebug, logInfo, logWarning} = require('./../logging');

class ScaleHandler {
    /**
     * @type AbstractScale
     */
    scale = null;
    
    initialize = () => {
        if (!config.has('scale') || !config.has('scale.type')) {
            return;
        }
        
        const scaleConfig = config.get('scale');
        switch(scaleConfig.type) {
            case 'DEBUG': {
                this.scale = new Debug(scaleConfig);
                break;
            }
            case 'RANDOM': {
                this.scale = new Random(scaleConfig);
                break;
            }
            case 'PLC6000': {
                this.scale = new PLC6000(scaleConfig);
                break;
            }
            case 'RHEWA82': {
                this.scale = new Rhewa82(scaleConfig);
                break;
            }
            case 'PCE-EP-E': {
                this.scale = new PCE_EP_E(scaleConfig);
                break;
            }
            case 'BIZERBATIS20': {
                this.scale = new BizerbaTis20(scaleConfig);
                break;
            }
            case 'PCE-PB-N': {
                this.scale = new PCE_PB_N(scaleConfig);
                break;
            }
            default: {
                break;
            }
        }
    };

    scaleAvailable = () => {
        return config.has('scale') && config.has('scale.type');
    }
    
    callScale = () => {
        logDebug('ScaleHandler', 'callScale', 'start');
        if (this.scale === null) {
            logWarning('ScaleHandler', 'callScale', 'no active scale found');
            return new Promise((resolve, reject) => {
                reject('no scale active')
            });
        }
        
        return this.scale.scale();
    }
    
}

module.exports = ScaleHandler;
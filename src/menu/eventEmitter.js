const EventEmitter = require('events');
class MenuEventEmitter extends EventEmitter {}
module.exports = new MenuEventEmitter();
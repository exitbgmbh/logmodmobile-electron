const EventEmitter = require('events');
class WebSocketEventEmitter extends EventEmitter {}
module.exports = new WebSocketEventEmitter();
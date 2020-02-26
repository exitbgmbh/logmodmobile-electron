const os = require('os');

const getLogModIdentification = () => {
  return 'ELOG-' + getHostname();
};

const getHostname = () => {
  return os.hostname();
};

module.exports = {
  getLogModIdentification, getHostname
};
const os = require('os');

const getLogModIdentification = () => {
  return 'ELOG-' + os.hostname();
};

module.exports = {
  getLogModIdentification
};
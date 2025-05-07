const os = require('os');
const config = require('config');

const getLogModIdentification = () => {
  let identification;
  if (config.has('app.identification')) {
    identification = config.get('app.identification');
  }

  return identification || 'ELOG-' + getHostname();
};

const getHostname = () => {
  return os.hostname();
};

const isWindows = () => {
  return process.platform === 'win32';
}

const isLinux = () => {
  return process.platform === 'linux';
}

module.exports = {
  getLogModIdentification, getHostname, isLinux, isWindows
};
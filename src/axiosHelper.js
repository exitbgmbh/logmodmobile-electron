const axios = require('axios');
const os = require('os');
const version = require(__dirname + '/../package').version;

let axiosInstance;
const getAxiosInstance = (authenticationToken) => {
    if (!axiosInstance || authenticationToken) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${authenticationToken}`;
        axios.defaults.headers.common['X-DEVICE-ID'] = 'Electron ' + os.hostname();
        axios.defaults.headers.common['X-APP-VERSION'] = version;

        axiosInstance = axios.create();
    }

    return axiosInstance;
};

module.exports = getAxiosInstance;
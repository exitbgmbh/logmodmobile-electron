const pcsclite = require('pcsclite')
const {logInfo} = require("../logging");

class RFIDHandler
{
    initialized = false;

    initialize = () => {
        if (this.initialized) {
           return;
        }

        this.initReader()
            .then((reader) => {
                logInfo('application', 'initRFIDReader', `connected to reader ${reader.name}`)
                reader.on('status', (status) => {
                    if ((status.state & reader.SCARD_STATE_PRESENT)) {
                        console.log('Card inserted');

                        reader.connect({ share_mode : reader.SCARD_SHARE_SHARED }, function(err, protocol) {
                            if (err) {
                                console.error(err);
                                return;
                            }
                            console.log('Protocol:', protocol);

                            // APDU-Befehl zum UID-Auslesen
                            const GET_UID = Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]);

                            reader.transmit(GET_UID, 40, protocol, function(err, data) {
                                if (err) {
                                    console.error('Transmit error:', err);
                                    return;
                                }
                                // UID + Statuswort (letzte 2 Bytes)
                                const uid = data.slice(0, -2);
                                const sw1 = data[data.length - 2];
                                const sw2 = data[data.length - 1];

                                console.log('UID:', uid.toString('hex').toUpperCase());
                                console.log(`Status: ${sw1.toString(16)} ${sw2.toString(16)}`);

                                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                                    if (err) console.error(err);
                                    else console.log('Disconnected');
                                });
                            });
                        });
                    }
                })
            })
            .catch((error) => {
                console.log(error)
            })

        this.initialized = true;
    }

    initReader = (timeout = 3000) => {
        return new Promise((resolve, reject) => {
            let resolved = false;
            const pcsc = pcsclite();
            const securityTimeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    pcsc.close();
                    reject(new Error('PC/SC service not available or reader not connected'));
                }
            }, timeout);

            pcsc.on('reader', (reader) => {
                if (!resolved) {
                    clearTimeout(securityTimeout);
                    resolved = true;
                    resolve(reader);
                }
            })
        })
    }

}

module.exports = RFIDHandler;
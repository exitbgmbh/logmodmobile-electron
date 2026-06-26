const pcsclite = require('pcsclite')
const config = require('config');
const {logInfo} = require("../logging");
const MifareCard = require('./card');

const ENABLED = !config.has('rfid.enabled') || config.get('rfid.enabled') === true;
const SECTOR_KEY = (config.has('rfid.sectorKey') && config.get('rfid.sectorKey')) || 'FFFFFFFFFFFF';
const WRITE_TIMEOUT_MS = (config.has('rfid.writeTimeoutMs') && config.get('rfid.writeTimeoutMs')) || 20000;
const GET_UID = Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]);

class RFIDHandler
{
    initialized = false;
    pendingWrite = null; // { encryptedKey, resolve }
    applicationWindow = null;
    processing = false; // re-entrancy guard: a card is currently being handled
    awaitCardRemoval = false; // suppress auto-login until a just-written card is lifted

    initialize = (applicationWindow) => {
        if (this.initialized || !ENABLED) {
           return;
        }
        this.applicationWindow = applicationWindow;

        this.initReader()
            .then((reader) => {
                logInfo('application', 'initRFIDReader', `connected to reader ${reader.name}`)
                reader.on('status', (status) => {
                    const present = (status.state & reader.SCARD_STATE_PRESENT);
                    if (!present) {
                        // card lifted: clear post-write suppression, ready for next card
                        this.awaitCardRemoval = false;
                        return;
                    }
                    if (this.processing || this.awaitCardRemoval) {
                        return;
                    }
                    this.processing = true;
                    this.onCardPresent(reader);
                })
            })
            .catch((error) => {
                console.log(error)
            })

        this.initialized = true;
    }

    onCardPresent = (reader) => {
        const wasWrite = !!this.pendingWrite;
        reader.connect({ share_mode : reader.SCARD_SHARE_SHARED }, async (err, protocol) => {
            if (err) {
                console.error('rfid connect error', err);
                this.failPendingWrite('connect failed');
                this.processing = false;
                return;
            }

            let tagId = null;
            try {
                const uid = await this.transmit(reader, protocol, GET_UID);
                tagId = uid.subarray(0, -2).toString('hex').toUpperCase();

                const card = new MifareCard(reader, protocol, SECTOR_KEY);

                if (this.pendingWrite) {
                    await this.handleWrite(card, tagId);
                } else {
                    await this.handleLogin(card, tagId);
                }
            } catch (error) {
                console.error('rfid card handling error', error);
                this.resolvePendingWrite({ success: false, tagId, error: error.message });
            } finally {
                // after a write, don't auto-login the same card still on the reader;
                // wait until it is physically removed.
                if (wasWrite) {
                    this.awaitCardRemoval = true;
                }
                this.processing = false;
                reader.disconnect(reader.SCARD_LEAVE_CARD, (e) => {
                    if (e) {
                        console.error('rfid disconnect error', e);
                    }
                });
            }
        });
    }

    handleWrite = async (card, tagId) => {
        await card.writePayload(this.pendingWrite.encryptedKey);
        this.resolvePendingWrite({ success: true, tagId });
    }

    handleLogin = async (card, tagId) => {
        const encryptedKey = await card.readPayload();
        if (encryptedKey) {
            this.applicationWindow?.webContents?.send('rfid-login', { tagId, encryptedKey });
        } else {
            this.applicationWindow?.webContents?.send('debug-rfid', { tagId });
        }
    }

    writeKey = (encryptedKey) => {
        if (!encryptedKey) {
            return Promise.resolve({ success: false, error: 'missing encryptedKey' });
        }
        if (this.pendingWrite) {
            return Promise.resolve({ success: false, error: 'write already in progress' });
        }
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingWrite = null;
                resolve({ success: false, error: 'timeout' });
            }, WRITE_TIMEOUT_MS);
            this.pendingWrite = {
                encryptedKey,
                resolve: (result) => {
                    clearTimeout(timer);
                    this.pendingWrite = null;
                    resolve(result);
                },
            };
        });
    }

    resolvePendingWrite = (result) => {
        if (this.pendingWrite) {
            this.pendingWrite.resolve(result);
        }
    }

    failPendingWrite = (message) => {
        this.resolvePendingWrite({ success: false, error: message });
    }

    transmit = (reader, protocol, apdu, resLen = 40) =>
        new Promise((resolve, reject) => {
            reader.transmit(apdu, resLen, protocol, (err, data) => (err ? reject(err) : resolve(data)));
        });

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

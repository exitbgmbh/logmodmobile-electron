const mifare = require('./mifare');

const SW_OK = '9000';
const KEY_TYPE_A = 0x60;

class MifareCard {
    constructor(reader, protocol, keyHex) {
        this.reader = reader;
        this.protocol = protocol;
        this.key = mifare.parseKey(keyHex);
    }

    transmit(apdu, resLen = 40) {
        return new Promise((resolve, reject) => {
            this.reader.transmit(apdu, resLen, this.protocol, (err, data) => {
                if (err) {
                    return reject(err);
                }
                const sw = data.subarray(-2).toString('hex');
                if (sw !== SW_OK) {
                    return reject(new Error(`card responded SW=${sw.toUpperCase()}`));
                }
                resolve(data.subarray(0, -2));
            });
        });
    }

    async loadKey() {
        await this.transmit(mifare.buildLoadKey(this.key));
    }

    async auth(block) {
        await this.transmit(mifare.buildAuth(block, KEY_TYPE_A));
    }

    async readBlock(block) {
        return this.transmit(mifare.buildRead(block), mifare.BLOCK_SIZE + 2);
    }

    async writeBlock(block, data16) {
        await this.transmit(mifare.buildWrite(block, data16));
    }

    async readPayload() {
        await this.loadKey();
        const plan = mifare.planDataBlocks();

        let lastSector = -1;
        const readPlanned = async (block) => {
            const sector = mifare.sectorOf(block);
            if (sector !== lastSector) {
                await this.auth(block);
                lastSector = sector;
            }
            return this.readBlock(block);
        };

        const headerBlock = await readPlanned(plan[0]);
        if (!headerBlock.subarray(0, 2).equals(mifare.MAGIC)) {
            return null; // blank or foreign card
        }

        const totalBytes = mifare.payloadByteLength(headerBlock);
        const neededBlocks = Math.ceil(totalBytes / mifare.BLOCK_SIZE);
        if (neededBlocks > plan.length) {
            throw new Error(`card claims ${totalBytes} bytes but capacity is ${mifare.CAPACITY_BYTES}`);
        }

        const chunks = [headerBlock];
        for (let i = 1; i < neededBlocks; i++) {
            chunks.push(await readPlanned(plan[i]));
        }

        const full = mifare.blocksToBytes(chunks).subarray(0, totalBytes);
        return mifare.partsToToken(mifare.decodePayload(full));
    }

    async writePayload(token) {
        const blocks = mifare.bytesToBlocks(mifare.encodePayload(mifare.tokenToParts(token)));
        const plan = mifare.planDataBlocks();
        if (blocks.length > plan.length) {
            throw new Error(`payload needs ${blocks.length} blocks, only ${plan.length} available`);
        }

        await this.loadKey();
        let lastSector = -1;
        for (let i = 0; i < blocks.length; i++) {
            const block = plan[i];
            const sector = mifare.sectorOf(block);
            if (sector !== lastSector) {
                await this.auth(block);
                lastSector = sector;
            }
            await this.writeBlock(block, blocks[i]);
        }
        return blocks.length;
    }
}

module.exports = MifareCard;

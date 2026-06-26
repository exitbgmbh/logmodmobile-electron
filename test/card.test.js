const { expect } = require('chai');
const m = require('../src/rfid/mifare');
const MifareCard = require('../src/rfid/card');

const SAMPLE_TOKEN = 'EXEC.41.nar.YR6ITe51Oo8nfy/U.NaT1QHYyumxAEqzN1CKqcQ==.5c1mUSlyvr8Wwq8vWOTttJLGJvCygqjX/KYao2lUWKieeaM6390lsu53PNxoNhaK9teV2V5D2NZp8okdaCNDKYIW2OujsneaINPbPRIcZ1fT4bQFYgb7BsasrdtzAju/AhPkxHyTFK9T2pjdlaNWnbioz579fEf1dM0FMkSuIsIsm282uoahQtvwrg2wkOrGPXevDEI0ij72uDUIQzlawu3AumuZDitr2+D+gvmNJ1z0V7CW4SiuWdkZIFt79IAG1S6bzy795xkZtteDZJLk6jv3TMj0RywI5GaHDvJJ/yO7BogRExtHQFi1aYnq3SiwxIyWR5Djmm7NpQJh2SQK9HnyGNCux7Gee1nl0dArqDUA15Y4Q9Ur7kRX+merDlcGa20FzzwbjSIpLtAl3jUus9MXCaMGVPL8a/Uy1fipE6fiTTBSRvhKfStANOIVu3vjhnBMKr4q9xdYllnZY3hhgVPG0dRnQtjf6BORUuW5TlW3hxxEmYWFNqthuxLkjaP38MSgNqmB7OjqXzc0eYioqnDYvZvfvGrB39dEOMX5fTjr3NI3XI1HDm+q3hq9clFg1zCwLJD1A1rmk4A1MgYNNNdcMyOTyghCh87r8K1TSc7AM6miAbrClsHl2NhEea8sK4Evc659/l3OALUD+impjCt4w6OlaMyaTo4lOnAU0EbG85gMx6Y0B8Sa8e6qgL+qdEc9bGMiR1g=';

const ok = (data) => Buffer.concat([data || Buffer.alloc(0), Buffer.from([0x90, 0x00])]);
const sw = (b1, b2) => Buffer.from([b1, b2]);

// Builds a fake reader that responds to MIFARE pseudo-APDUs from an in-memory image.
// authMode: 'ok' | 'fail' (fail => SW 6300 on auth, like a foreign/wrong-key card)
// blockData(block) => Buffer(16) for reads
const fakeReader = ({ authMode = 'ok', blockData }) => ({
    transmit(apdu, resLen, protocol, cb) {
        const cla = apdu[0];
        const ins = apdu[1];
        if (cla === 0xFF && ins === 0x82) { // load key
            return cb(null, ok());
        }
        if (cla === 0xFF && ins === 0x86) { // authenticate
            return cb(null, authMode === 'fail' ? sw(0x63, 0x00) : ok());
        }
        if (cla === 0xFF && ins === 0xB0) { // read block
            const block = apdu[3];
            return cb(null, ok(blockData(block)));
        }
        return cb(new Error(`unexpected APDU ${apdu.toString('hex')}`));
    },
});

const imageFor = (token) => {
    const blocks = m.bytesToBlocks(m.encodePayload(m.tokenToParts(token)));
    const plan = m.planDataBlocks();
    const map = new Map();
    blocks.forEach((b, i) => map.set(plan[i], b));
    return (block) => map.get(block) || Buffer.alloc(16);
};

describe('MifareCard.readPayload robustness', () => {
    it('returns null (does not throw) when the card is not authenticable with our key', async () => {
        const reader = fakeReader({ authMode: 'fail', blockData: () => Buffer.alloc(16) });
        const card = new MifareCard(reader, 2, 'FFFFFFFFFFFF');
        const token = await card.readPayload();
        expect(token).to.equal(null);
    });

    it('returns null for a blank card (auth ok, no LM magic)', async () => {
        const reader = fakeReader({ authMode: 'ok', blockData: () => Buffer.alloc(16) });
        const card = new MifareCard(reader, 2, 'FFFFFFFFFFFF');
        const token = await card.readPayload();
        expect(token).to.equal(null);
    });

    it('reads back a valid logmod card token byte-identical', async () => {
        const reader = fakeReader({ authMode: 'ok', blockData: imageFor(SAMPLE_TOKEN) });
        const card = new MifareCard(reader, 2, 'FFFFFFFFFFFF');
        const token = await card.readPayload();
        expect(token).to.equal(SAMPLE_TOKEN);
    });
});

const { expect } = require('chai');
const m = require('../src/rfid/mifare');

const SAMPLE_TOKEN = 'EXEC.41.nar.YR6ITe51Oo8nfy/U.NaT1QHYyumxAEqzN1CKqcQ==.5c1mUSlyvr8Wwq8vWOTttJLGJvCygqjX/KYao2lUWKieeaM6390lsu53PNxoNhaK9teV2V5D2NZp8okdaCNDKYIW2OujsneaINPbPRIcZ1fT4bQFYgb7BsasrdtzAju/AhPkxHyTFK9T2pjdlaNWnbioz579fEf1dM0FMkSuIsIsm282uoahQtvwrg2wkOrGPXevDEI0ij72uDUIQzlawu3AumuZDitr2+D+gvmNJ1z0V7CW4SiuWdkZIFt79IAG1S6bzy795xkZtteDZJLk6jv3TMj0RywI5GaHDvJJ/yO7BogRExtHQFi1aYnq3SiwxIyWR5Djmm7NpQJh2SQK9HnyGNCux7Gee1nl0dArqDUA15Y4Q9Ur7kRX+merDlcGa20FzzwbjSIpLtAl3jUus9MXCaMGVPL8a/Uy1fipE6fiTTBSRvhKfStANOIVu3vjhnBMKr4q9xdYllnZY3hhgVPG0dRnQtjf6BORUuW5TlW3hxxEmYWFNqthuxLkjaP38MSgNqmB7OjqXzc0eYioqnDYvZvfvGrB39dEOMX5fTjr3NI3XI1HDm+q3hq9clFg1zCwLJD1A1rmk4A1MgYNNNdcMyOTyghCh87r8K1TSc7AM6miAbrClsHl2NhEea8sK4Evc659/l3OALUD+impjCt4w6OlaMyaTo4lOnAU0EbG85gMx6Y0B8Sa8e6qgL+qdEc9bGMiR1g=';

describe('mifare APDU builders', () => {
    it('buildLoadKey loads a 6-byte key into volatile slot 0', () => {
        const apdu = m.buildLoadKey(Buffer.from('FFFFFFFFFFFF', 'hex'));
        expect(apdu.toString('hex').toUpperCase()).to.equal('FF820000' + '06' + 'FFFFFFFFFFFF');
    });

    it('buildAuth authenticates a block with key A', () => {
        const apdu = m.buildAuth(4, 0x60, 0x00);
        expect(apdu.toString('hex').toUpperCase()).to.equal('FF860000' + '05' + '0100' + '04' + '60' + '00');
    });

    it('buildRead reads 16 bytes from a block', () => {
        expect(m.buildRead(4).toString('hex').toUpperCase()).to.equal('FFB00004' + '10');
    });

    it('buildWrite writes 16 bytes to a block', () => {
        const data = Buffer.alloc(16, 0xAB);
        const apdu = m.buildWrite(5, data);
        expect(apdu.toString('hex').toUpperCase()).to.equal('FFD60005' + '10' + 'AB'.repeat(16));
    });

    it('sectorOf maps blocks to 4-block sectors', () => {
        expect(m.sectorOf(0)).to.equal(0);
        expect(m.sectorOf(4)).to.equal(1);
        expect(m.sectorOf(7)).to.equal(1);
        expect(m.sectorOf(8)).to.equal(2);
    });

    it('parseKey turns a hex string into a 6-byte buffer', () => {
        expect(m.parseKey('FFFFFFFFFFFF').equals(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]))).to.be.true;
    });

    it('parseKey rejects keys that are not 6 bytes', () => {
        expect(() => m.parseKey('FFFF')).to.throw();
    });
});

describe('mifare block planner', () => {
    it('plans 45 data blocks in sectors 1-15', () => {
        const blocks = m.planDataBlocks();
        expect(blocks.length).to.equal(45);
    });

    it('never includes block 0 or any sector trailer (block % 4 === 3)', () => {
        const blocks = m.planDataBlocks();
        expect(blocks).to.not.include(0);
        blocks.forEach((b) => {
            expect(b % 4, `block ${b} is a trailer`).to.not.equal(3);
        });
    });

    it('stays within sectors 1-15 (regular region, 4K-safe)', () => {
        const blocks = m.planDataBlocks();
        blocks.forEach((b) => {
            expect(m.sectorOf(b)).to.be.within(1, 15);
        });
    });

    it('starts at block 4 and exposes capacity 720', () => {
        expect(m.planDataBlocks()[0]).to.equal(4);
        expect(m.HEADER_BLOCK).to.equal(4);
        expect(m.CAPACITY_BYTES).to.equal(720);
    });

    it('is strictly increasing with no duplicates', () => {
        const blocks = m.planDataBlocks();
        for (let i = 1; i < blocks.length; i++) {
            expect(blocks[i]).to.be.greaterThan(blocks[i - 1]);
        }
    });
});

describe('mifare token <-> parts', () => {
    it('splits a token into userId + clientCode + raw iv/tag/cipher', () => {
        const p = m.tokenToParts(SAMPLE_TOKEN);
        expect(p.userId).to.equal('41');
        expect(p.clientCode).to.equal('nar');
        expect(p.iv.length).to.equal(12);
        expect(p.tag.length).to.equal(16);
        expect(p.cipher.length).to.equal(536);
    });

    it('rebuilds the exact original token (lossless round-trip)', () => {
        expect(m.partsToToken(m.tokenToParts(SAMPLE_TOKEN))).to.equal(SAMPLE_TOKEN);
    });

    it('rejects a malformed token', () => {
        expect(() => m.tokenToParts('NOPE.1.2')).to.throw();
        expect(() => m.tokenToParts('FOO.727.aa.bb.cc')).to.throw();
    });
});

describe('mifare payload encode/decode', () => {
    it('round-trips parts through encode/decode', () => {
        const parts = m.tokenToParts(SAMPLE_TOKEN);
        const decoded = m.decodePayload(m.encodePayload(parts));
        expect(decoded.userId).to.equal('41');
        expect(decoded.clientCode).to.equal('nar');
        expect(decoded.iv.equals(parts.iv)).to.be.true;
        expect(decoded.tag.equals(parts.tag)).to.be.true;
        expect(decoded.cipher.equals(parts.cipher)).to.be.true;
    });

    it('full pipeline token -> bytes -> blocks -> bytes -> token is identical', () => {
        const blocks = m.bytesToBlocks(m.encodePayload(m.tokenToParts(SAMPLE_TOKEN)));
        const full = m.blocksToBytes(blocks).subarray(0, m.payloadByteLength(blocks[0]));
        expect(m.partsToToken(m.decodePayload(full))).to.equal(SAMPLE_TOKEN);
    });

    it('writes the LM magic and version byte in the header', () => {
        const full = m.encodePayload(m.tokenToParts(SAMPLE_TOKEN));
        expect(full.subarray(0, 2).toString('ascii')).to.equal('LM');
        expect(full[2]).to.equal(1);
    });

    it('rejects a payload larger than card capacity', () => {
        const big = { userId: '1', iv: Buffer.alloc(12), tag: Buffer.alloc(16), cipher: Buffer.alloc(m.CAPACITY_BYTES) };
        expect(() => m.encodePayload(big)).to.throw(/capacity/);
    });

    it('decodePayload rejects a blank/foreign card (no magic)', () => {
        expect(() => m.decodePayload(Buffer.alloc(16))).to.throw(/no logmod card/);
    });

    it('bytesToBlocks pads the last block to 16 bytes', () => {
        const blocks = m.bytesToBlocks(Buffer.from([1, 2, 3]));
        expect(blocks.length).to.equal(1);
        expect(blocks[0].length).to.equal(16);
        expect(blocks[0][0]).to.equal(1);
        expect(blocks[0][3]).to.equal(0);
    });
});

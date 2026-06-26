const { expect } = require('chai');
const m = require('../src/rfid/mifare');

const SAMPLE_TOKEN = 'EXEC.727.iprzY5/QbYv035/t.QDDMbRUrWifXtldL0Wq0Hg==.a+hFSDTPwiwYCP/v1x17mSwvbMKcPUbTwfZEiGLMx2nLNWkLeFtY7pCSpiTdA4TMhGfC6awLJ5vqadN3dENksALFfX7Xpwgz0UujwFZMu+2LBNfGDvGw6SxCVkKCKpwRmsrCi+MUY2ZpDM0p+BaydLi0/Wr+6mHzSxJq/0A841uMCIRJGaqTh0ycYj6gjEivRCAh5dD3v4foD22+2h87t0qG3BBqEsxd7hWpwoV8/Ufrgfkjft3+GSvRoOSbIuX6urlEKBf46k80o11r4FDNvIiQKNyk8uzElPcJQ99WfODAMADTJl7URU0b+6qZs2qLsagIkYypMIaSBOFXw/F0ClO+fEEIqVVEuEYSH+fw9R1P1ZgzMdtN8iuoOOFQwpW82zaE5tClLfgKyyBIuCJmk2S0H2FiGkxcDfrzC5lTo9atG1mimI9DZOcfI+IlVqJ1Ogx1U4bMGzM5XY4nW9+3UxFt6lkBog9TULhtJqq+UuPCaf5QrIqWegs2iAdVSO8T7n8ptGtuPZ5+4OZs0Z1MVJ8mS3995XUaShopWqrZXUqgidrMnXDY2Xu/11J8M7quNjl9KXvlj6qOAuf2+nh924xOx4Sx+qGrcFi8fRq+jWzqRQT6/hNNs25g0d9zLc/kQdwjG+znrPxnDWbL77+PCIbHcBSswSZsdbwXBQpz4hDhvifTZyy3MIcZ7+PEbH44urXwP/bTjhM=';

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
    it('splits a token into userId + raw iv/tag/cipher', () => {
        const p = m.tokenToParts(SAMPLE_TOKEN);
        expect(p.userId).to.equal('727');
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
        expect(decoded.userId).to.equal('727');
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

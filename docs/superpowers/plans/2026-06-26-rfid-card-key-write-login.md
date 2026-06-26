# RFID Card Key Write & Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write an encrypted access token (`EXEC.<userId>.<iv>.<tag>.<cipher>`) to a MIFARE Classic card from logmod, and read it back on tap to drive login.

**Architecture:** Electron stays pure hardware-I/O. Pure, hardware-free logic (APDU builders, block planning, lossless token↔bytes encoding) lives in `src/rfid/mifare.js` and is unit-tested. A thin `src/rfid/card.js` wraps a connected PC/SC session. `src/rfid/handler.js` orchestrates the reader lifecycle and IPC. logmod backend owns all crypto and login.

**Tech Stack:** Node.js (Electron 30 main process), `pcsclite`, Mocha + Chai for unit tests.

## Global Constraints

- The `EXEC.…` token MUST be reconstructed **byte-identical** when read back. Never alter it.
- MIFARE block planner MUST only use sectors 1–15 and MUST NEVER write block 0 or any sector trailer (`block % 4 === 3`). This keeps it safe on both 1K and 4K cards.
- Pure logic (`mifare.js`) MUST NOT `require('pcsclite')` or any hardware/Electron module — it must load in plain Node for Mocha.
- Default sector key A = `FFFFFFFFFFFF` (hex), overridable via `config` key `rfid.sectorKey`.
- Card data capacity = 45 blocks × 16 = 720 bytes (5-byte header + ≤715 payload).
- Existing `debug-rfid` IPC event MUST keep working unchanged.
- Auth applies to a whole sector; re-auth only when crossing into a new sector.

---

## File Structure

- Create `src/rfid/mifare.js` — pure functions: APDU builders, `planDataBlocks`, `sectorOf`, token↔parts, payload encode/decode, bytes↔blocks.
- Create `test/mifare.test.js` — Mocha/Chai unit tests for `mifare.js`.
- Create `src/rfid/card.js` — `MifareCard` class wrapping a connected reader/protocol; `readPayload()`, `writePayload()`.
- Modify `src/rfid/handler.js` — refactor lifecycle; on-tap read→login/debug; `writeKey()` + pending-write state.
- Modify `src/application.js` — bind `ipcMain.on('rfid-write')`, send `rfid-write-result`.

---

### Task 1: Pure APDU builders + sector helpers (`mifare.js`)

**Files:**
- Create: `src/rfid/mifare.js`
- Test: `test/mifare.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `buildLoadKey(keyBytes: Buffer(6)): Buffer`
  - `buildAuth(block: number, keyType=0x60, keySlot=0x00): Buffer`
  - `buildRead(block: number, length=0x10): Buffer`
  - `buildWrite(block: number, data16: Buffer(16)): Buffer`
  - `sectorOf(block: number): number`
  - `parseKey(hex: string): Buffer(6)`

- [ ] **Step 1: Write the failing test**

```js
// test/mifare.test.js
const { expect } = require('chai');
const m = require('../src/rfid/mifare');

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
    expect(m.parseKey('FFFFFFFFFFFF').equals(Buffer.from([0xFF,0xFF,0xFF,0xFF,0xFF,0xFF]))).to.be.true;
  });

  it('parseKey rejects keys that are not 6 bytes', () => {
    expect(() => m.parseKey('FFFF')).to.throw();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha test/mifare.test.js`
Expected: FAIL — `Cannot find module '../src/rfid/mifare'`

- [ ] **Step 3: Write minimal implementation**

```js
// src/rfid/mifare.js
const BLOCK_SIZE = 16;
const BLOCKS_PER_SECTOR = 4;

const sectorOf = (block) => Math.floor(block / BLOCKS_PER_SECTOR);

const parseKey = (hex) => {
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 6) {
    throw new Error(`sector key must be 6 bytes (12 hex chars), got ${key.length}`);
  }
  return key;
};

const buildLoadKey = (keyBytes) =>
  Buffer.concat([Buffer.from([0xFF, 0x82, 0x00, 0x00, 0x06]), keyBytes]);

const buildAuth = (block, keyType = 0x60, keySlot = 0x00) =>
  Buffer.from([0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, block, keyType, keySlot]);

const buildRead = (block, length = 0x10) =>
  Buffer.from([0xFF, 0xB0, 0x00, block, length]);

const buildWrite = (block, data16) =>
  Buffer.concat([Buffer.from([0xFF, 0xD6, 0x00, block, 0x10]), data16]);

module.exports = {
  BLOCK_SIZE,
  BLOCKS_PER_SECTOR,
  sectorOf,
  parseKey,
  buildLoadKey,
  buildAuth,
  buildRead,
  buildWrite,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx mocha test/mifare.test.js`
Expected: PASS (7 passing)

- [ ] **Step 5: Commit**

```bash
git add src/rfid/mifare.js test/mifare.test.js
git commit -m "feat(rfid): pure MIFARE APDU builders and sector helpers"
```

---

### Task 2: Block planner (`mifare.js`)

**Files:**
- Modify: `src/rfid/mifare.js`
- Test: `test/mifare.test.js`

**Interfaces:**
- Consumes: `sectorOf` (Task 1)
- Produces:
  - `planDataBlocks(): number[]` — ordered usable data blocks in sectors 1–15
  - `CAPACITY_BYTES: number` — 720
  - `HEADER_BLOCK: number` — `planDataBlocks()[0]` (= 4)

- [ ] **Step 1: Write the failing test**

```js
// append to test/mifare.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha test/mifare.test.js`
Expected: FAIL — `m.planDataBlocks is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/rfid/mifare.js` (before `module.exports`):

```js
const FIRST_SECTOR = 1;
const LAST_SECTOR = 15;
const DATA_BLOCKS_PER_SECTOR = 3; // 4th block is the trailer

const planDataBlocks = () => {
  const blocks = [];
  for (let s = FIRST_SECTOR; s <= LAST_SECTOR; s++) {
    for (let b = 0; b < DATA_BLOCKS_PER_SECTOR; b++) {
      blocks.push(s * BLOCKS_PER_SECTOR + b);
    }
  }
  return blocks;
};

const CAPACITY_BYTES = LAST_SECTOR * DATA_BLOCKS_PER_SECTOR * BLOCK_SIZE; // 720
const HEADER_BLOCK = planDataBlocks()[0]; // 4
```

Add `planDataBlocks`, `CAPACITY_BYTES`, `HEADER_BLOCK` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx mocha test/mifare.test.js`
Expected: PASS (12 passing)

- [ ] **Step 5: Commit**

```bash
git add src/rfid/mifare.js test/mifare.test.js
git commit -m "feat(rfid): MIFARE data-block planner (1K/4K-safe, no trailers)"
```

---

### Task 3: Lossless token ↔ parts (`mifare.js`)

**Files:**
- Modify: `src/rfid/mifare.js`
- Test: `test/mifare.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `tokenToParts(token: string): { userId: string, iv: Buffer, tag: Buffer, cipher: Buffer }`
  - `partsToToken(parts): string`

- [ ] **Step 1: Write the failing test**

```js
// append to test/mifare.test.js
const SAMPLE_TOKEN = 'EXEC.727.iprzY5/QbYv035/t.QDDMbRUrWifXtldL0Wq0Hg==.a+hFSDTPwiwYCP/v1x17mSwvbMKcPUbTwfZEiGLMx2nLNWkLeFtY7pCSpiTdA4TMhGfC6awLJ5vqadN3dENksALFfX7Xpwgz0UujwFZMu+2LBNfGDvGw6SxCVkKCKpwRmsrCi+MUY2ZpDM0p+BaydLi0/Wr+6mHzSxJq/0A841uMCIRJGaqTh0ycYj6gjEivRCAh5dD3v4foD22+2h87t0qG3BBqEsxd7hWpwoV8/Ufrgfkjft3+GSvRoOSbIuX6urlEKBf46k80o11r4FDNvIiQKNyk8uzElPcJQ99WfODAMADTJl7URU0b+6qZs2qLsagIkYypMIaSBOFXw/F0ClO+fEEIqVVEuEYSH+fw9R1P1ZgzMdtN8iuoOOFQwpW82zaE5tClLfgKyyBIuCJmk2S0H2FiGkxcDfrzC5lTo9atG1mimI9DZOcfI+IlVqJ1Ogx1U4bMGzM5XY4nW9+3UxFt6lkBog9TULhtJqq+UuPCaf5QrIqWegs2iAdVSO8T7n8ptGtuPZ5+4OZs0Z1MVJ8mS3995XUaShopWqrZXUqgidrMnXDY2Xu/11J8M7quNjl9KXvlj6qOAuf2+nh924xOx4Sx+qGrcFi8fRq+jWzqRQT6/hNNs25g0d9zLc/kQdwjG+znrPxnDWbL77+PCIbHcBSswSZsdbwXBQpz4hDhvifTZyy3MIcZ7+PEbH44urXwP/bTjhM=';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha test/mifare.test.js`
Expected: FAIL — `m.tokenToParts is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/rfid/mifare.js`:

```js
const TOKEN_PREFIX = 'EXEC';

const tokenToParts = (token) => {
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== TOKEN_PREFIX) {
    throw new Error('invalid token format (expected EXEC.userId.iv.tag.cipher)');
  }
  return {
    userId: parts[1],
    iv: Buffer.from(parts[2], 'base64'),
    tag: Buffer.from(parts[3], 'base64'),
    cipher: Buffer.from(parts[4], 'base64'),
  };
};

const partsToToken = ({ userId, iv, tag, cipher }) =>
  `${TOKEN_PREFIX}.${userId}.${iv.toString('base64')}.${tag.toString('base64')}.${cipher.toString('base64')}`;
```

Add `tokenToParts`, `partsToToken` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx mocha test/mifare.test.js`
Expected: PASS (15 passing)

- [ ] **Step 5: Commit**

```bash
git add src/rfid/mifare.js test/mifare.test.js
git commit -m "feat(rfid): lossless EXEC token <-> parts conversion"
```

---

### Task 4: Payload encode/decode + bytes↔blocks (`mifare.js`)

**Files:**
- Modify: `src/rfid/mifare.js`
- Test: `test/mifare.test.js`

**Interfaces:**
- Consumes: `tokenToParts`/`partsToToken` (Task 3), `CAPACITY_BYTES`, `BLOCK_SIZE` (Tasks 1–2)
- Produces:
  - `encodePayload(parts): Buffer` — header (`LM` + version 1 + uint16 BE payloadLen) + payload (`userIdLen|userId|ivLen|iv|tagLen|tag|cipher`); throws if `> CAPACITY_BYTES`
  - `decodePayload(full: Buffer): parts` — throws `'no logmod card'` if magic missing
  - `bytesToBlocks(buf: Buffer): Buffer[]` — 16-byte blocks, last zero-padded
  - `blocksToBytes(blocks: Buffer[]): Buffer`
  - `HEADER_LEN: number` — 5
  - `MAGIC: Buffer` — `Buffer.from('LM')`
  - `payloadByteLength(full: Buffer): number` — `HEADER_LEN + uint16BE@3`; for sizing reads

- [ ] **Step 1: Write the failing test**

```js
// append to test/mifare.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha test/mifare.test.js`
Expected: FAIL — `m.encodePayload is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/rfid/mifare.js`:

```js
const MAGIC = Buffer.from('LM', 'ascii');
const VERSION = 1;
const HEADER_LEN = 5; // magic(2) + version(1) + payloadLen(2 BE)

const encodePayload = ({ userId, iv, tag, cipher }) => {
  const userIdBuf = Buffer.from(String(userId), 'ascii');
  if (userIdBuf.length > 255 || iv.length > 255 || tag.length > 255) {
    throw new Error('userId/iv/tag field exceeds 255 bytes');
  }
  const payload = Buffer.concat([
    Buffer.from([userIdBuf.length]), userIdBuf,
    Buffer.from([iv.length]), iv,
    Buffer.from([tag.length]), tag,
    cipher,
  ]);
  if (payload.length > 0xffff) {
    throw new Error('payload length does not fit in 16-bit header');
  }
  const header = Buffer.alloc(HEADER_LEN);
  MAGIC.copy(header, 0);
  header[2] = VERSION;
  header.writeUInt16BE(payload.length, 3);
  const full = Buffer.concat([header, payload]);
  if (full.length > CAPACITY_BYTES) {
    throw new Error(`payload exceeds card capacity (${full.length} > ${CAPACITY_BYTES} bytes)`);
  }
  return full;
};

const payloadByteLength = (headerBlock) => {
  if (headerBlock.length < HEADER_LEN || !headerBlock.subarray(0, 2).equals(MAGIC)) {
    throw new Error('no logmod card');
  }
  return HEADER_LEN + headerBlock.readUInt16BE(3);
};

const decodePayload = (full) => {
  if (full.length < HEADER_LEN || !full.subarray(0, 2).equals(MAGIC)) {
    throw new Error('no logmod card');
  }
  const payloadLen = full.readUInt16BE(3);
  const payload = full.subarray(HEADER_LEN, HEADER_LEN + payloadLen);
  let o = 0;
  const readField = () => {
    const len = payload[o++];
    const v = Buffer.from(payload.subarray(o, o + len));
    o += len;
    return v;
  };
  const userId = readField().toString('ascii');
  const iv = readField();
  const tag = readField();
  const cipher = Buffer.from(payload.subarray(o));
  return { userId, iv, tag, cipher };
};

const bytesToBlocks = (buf) => {
  const blocks = [];
  for (let i = 0; i < buf.length; i += BLOCK_SIZE) {
    const block = Buffer.alloc(BLOCK_SIZE);
    buf.copy(block, 0, i, Math.min(i + BLOCK_SIZE, buf.length));
    blocks.push(block);
  }
  return blocks;
};

const blocksToBytes = (blocks) => Buffer.concat(blocks);
```

Add `MAGIC`, `HEADER_LEN`, `encodePayload`, `decodePayload`, `payloadByteLength`, `bytesToBlocks`, `blocksToBytes` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx mocha test/mifare.test.js`
Expected: PASS (21 passing)

- [ ] **Step 5: Commit**

```bash
git add src/rfid/mifare.js test/mifare.test.js
git commit -m "feat(rfid): payload encode/decode and bytes<->blocks mapping"
```

---

### Task 5: `MifareCard` hardware wrapper (`card.js`)

**Files:**
- Create: `src/rfid/card.js`

**Interfaces:**
- Consumes: all of `mifare.js`
- Produces:
  - `class MifareCard { constructor(reader, protocol, keyHex) }`
  - `async readPayload(): Promise<string|null>` — token string, or `null` for blank/foreign card
  - `async writePayload(token: string): Promise<number>` — number of blocks written

No unit test (requires hardware). Verified via Task 8 manual harness.

- [ ] **Step 1: Implement `MifareCard`**

```js
// src/rfid/card.js
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
```

- [ ] **Step 2: Sanity-check it loads (no syntax errors)**

Run: `node -e "require('./src/rfid/card'); console.log('card.js loads OK')"`
Expected: `card.js loads OK`

- [ ] **Step 3: Commit**

```bash
git add src/rfid/card.js
git commit -m "feat(rfid): MifareCard wrapper for read/write over PC/SC"
```

---

### Task 6: Refactor `handler.js` — lifecycle, login read, write arming

**Files:**
- Modify: `src/rfid/handler.js`

**Interfaces:**
- Consumes: `MifareCard` (Task 5), `config`
- Produces:
  - `initialize(applicationWindow)` — unchanged signature
  - `writeKey(encryptedKey: string): Promise<{ success: boolean, tagId?: string, error?: string }>`

**Behavior:**
- On each card-present event: connect, read UID (`FF CA`), then:
  - if a write is armed (`pendingWrite`): `card.writePayload(...)`, resolve the pending promise with the result, clear arming.
  - else: `card.readPayload()`; if non-null → send `rfid-login {tagId, encryptedKey}`; if null → send `debug-rfid {tagId}` (preserves existing behavior).
- `writeKey` arms `pendingWrite` and waits for the next card tap (timeout `rfid.writeTimeoutMs`, default 20000). Returns `{success:false, error:'timeout'}` if no card arrives.

- [ ] **Step 1: Replace `src/rfid/handler.js` with the refactored version**

```js
// src/rfid/handler.js
const pcsclite = require('pcsclite');
const config = require('config');
const { logInfo } = require('../logging');
const MifareCard = require('./card');

const SECTOR_KEY = (config.has('rfid.sectorKey') && config.get('rfid.sectorKey')) || 'FFFFFFFFFFFF';
const WRITE_TIMEOUT_MS = (config.has('rfid.writeTimeoutMs') && config.get('rfid.writeTimeoutMs')) || 20000;
const GET_UID = Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]);

class RFIDHandler {
  initialized = false;
  pendingWrite = null; // { encryptedKey, resolve }
  applicationWindow = null;

  initialize = (applicationWindow) => {
    if (this.initialized) {
      return;
    }
    this.applicationWindow = applicationWindow;

    this.initReader()
      .then((reader) => {
        logInfo('application', 'initRFIDReader', `connected to reader ${reader.name}`);
        reader.on('status', (status) => {
          if (status.state & reader.SCARD_STATE_PRESENT) {
            this.onCardPresent(reader);
          }
        });
      })
      .catch((error) => {
        console.log(error);
      });

    this.initialized = true;
  };

  onCardPresent = (reader) => {
    reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, async (err, protocol) => {
      if (err) {
        console.error('rfid connect error', err);
        this.failPendingWrite('connect failed');
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
        reader.disconnect(reader.SCARD_LEAVE_CARD, (e) => {
          if (e) {
            console.error('rfid disconnect error', e);
          }
        });
      }
    });
  };

  handleWrite = async (card, tagId) => {
    await card.writePayload(this.pendingWrite.encryptedKey);
    this.resolvePendingWrite({ success: true, tagId });
  };

  handleLogin = async (card, tagId) => {
    const encryptedKey = await card.readPayload();
    if (encryptedKey) {
      this.applicationWindow?.webContents?.send('rfid-login', { tagId, encryptedKey });
    } else {
      this.applicationWindow?.webContents?.send('debug-rfid', { tagId });
    }
  };

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
  };

  resolvePendingWrite = (result) => {
    if (this.pendingWrite) {
      this.pendingWrite.resolve(result);
    }
  };

  failPendingWrite = (message) => {
    this.resolvePendingWrite({ success: false, error: message });
  };

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
      });
    });
  };
}

module.exports = RFIDHandler;
```

- [ ] **Step 2: Sanity-check the existing startup test still passes**

Run: `npm test`
Expected: PASS — including `Electron client startup` and all `mifare` unit tests. (The Electron app still boots and `rfidHandlerInstance.initialize` runs without throwing.)

- [ ] **Step 3: Commit**

```bash
git add src/rfid/handler.js
git commit -m "feat(rfid): handler login-read on tap + write arming via writeKey"
```

---

### Task 7: Wire `rfid-write` IPC in `application.js`

**Files:**
- Modify: `src/application.js` (inside `bindIpcEvents`, near the other `ipcMain.on` blocks, e.g. after `request-weight` at line ~327)

**Interfaces:**
- Consumes: `rfidHandlerInstance.writeKey` (Task 6), `windowInstance`, `ipcMain`

- [ ] **Step 1: Add the IPC handler**

Insert into `bindIpcEvents` (after the `request-weight` handler):

```js
    // logmod requests writing an encrypted access key to the next tapped card
    ipcMain.on('rfid-write', async (event, arg) => {
        const result = await rfidHandlerInstance.writeKey(arg && arg.encryptedKey);
        windowInstance.webContents.send('rfid-write-result', result);
    });
```

- [ ] **Step 2: Verify the app still boots**

Run: `npm test`
Expected: PASS — `Electron client startup` test green (boot end reached, no stderr).

- [ ] **Step 3: Commit**

```bash
git add src/application.js
git commit -m "feat(rfid): bind rfid-write IPC and emit rfid-write-result"
```

---

### Task 8: Manual hardware verification harness + docs

**Files:**
- Create: `docs/superpowers/plans/rfid-manual-test.md`

This task has no automated test (hardware-bound). It provides a repeatable manual harness and records results.

- [ ] **Step 1: Write a temporary write+read round-trip harness**

Create `.rfid-roundtrip.js` in the repo root (deleted at the end):

```js
// .rfid-roundtrip.js — manual hardware round-trip (Electron main process)
const { app } = require('electron');
const pcsclite = require('pcsclite');
const MifareCard = require('./src/rfid/card');

const TOKEN = process.env.RFID_TOKEN || 'EXEC.727.iprzY5/QbYv035/t.QDDMbRUrWifXtldL0Wq0Hg==.a+hFSDTPwiwYCP/v1x17mSwvbMKcPUbTwfZEiGLMx2nLNWkLeFtY7pCSpiTdA4TMhGfC6awLJ5vqadN3dENksALFfX7Xpwgz0UujwFZMu+2LBNfGDvGw6SxCVkKCKpwRmsrCi+MUY2ZpDM0p+BaydLi0/Wr+6mHzSxJq/0A841uMCIRJGaqTh0ycYj6gjEivRCAh5dD3v4foD22+2h87t0qG3BBqEsxd7hWpwoV8/Ufrgfkjft3+GSvRoOSbIuX6urlEKBf46k80o11r4FDNvIiQKNyk8uzElPcJQ99WfODAMADTJl7URU0b+6qZs2qLsagIkYypMIaSBOFXw/F0ClO+fEEIqVVEuEYSH+fw9R1P1ZgzMdtN8iuoOOFQwpW82zaE5tClLfgKyyBIuCJmk2S0H2FiGkxcDfrzC5lTo9atG1mimI9DZOcfI+IlVqJ1Ogx1U4bMGzM5XY4nW9+3UxFt6lkBog9TULhtJqq+UuPCaf5QrIqWegs2iAdVSO8T7n8ptGtuPZ5+4OZs0Z1MVJ8mS3995XUaShopWqrZXUqgidrMnXDY2Xu/11J8M7quNjl9KXvlj6qOAuf2+nh924xOx4Sx+qGrcFi8fRq+jWzqRQT6/hNNs25g0d9zLc/kQdwjG+znrPxnDWbL77+PCIbHcBSswSZsdbwXBQpz4hDhvifTZyy3MIcZ7+PEbH44urXwP/bTjhM=';

app.on('ready', () => {
  const pcsc = pcsclite();
  setTimeout(() => { console.log('RESULT timeout: no card'); app.quit(); }, 15000);
  pcsc.on('reader', (reader) => {
    console.log('RESULT reader:', reader.name);
    reader.on('status', (status) => {
      if (!(status.state & reader.SCARD_STATE_PRESENT)) return;
      reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, async (err, protocol) => {
        if (err) { console.log('RESULT connect_err', err.message); return app.quit(); }
        try {
          const card = new MifareCard(reader, protocol, 'FFFFFFFFFFFF');
          const blocks = await card.writePayload(TOKEN);
          console.log('RESULT wrote blocks:', blocks);
          const readBack = await card.readPayload();
          console.log('RESULT identical:', readBack === TOKEN);
        } catch (e) {
          console.log('RESULT error:', e.message);
        } finally {
          reader.disconnect(reader.SCARD_LEAVE_CARD, () => app.quit());
        }
      });
    });
  });
});
app.on('window-all-closed', () => {});
```

- [ ] **Step 2: Run it with a card on the reader**

Run: `timeout 25 ./node_modules/.bin/electron .rfid-roundtrip.js 2>&1 | grep RESULT`
Expected:
```
RESULT reader: Feitian 502-CL [NFC   ] ...
RESULT wrote blocks: 36
RESULT identical: true
```

- [ ] **Step 3: Record the outcome and remove the harness**

Write the observed output into `docs/superpowers/plans/rfid-manual-test.md` (reader name, blocks written, `identical: true`), then:

```bash
rm -f .rfid-roundtrip.js
git add docs/superpowers/plans/rfid-manual-test.md
git commit -m "docs(rfid): record manual hardware round-trip verification"
```

---

## Notes for the implementer

- Run `npx mocha test/mifare.test.js` after every `mifare.js` task; it must stay green.
- `mifare.js` must never import hardware modules — keep it pure so Mocha can load it in plain Node.
- The login HTTP call and token validation live in the logmod frontend/backend (different repo). This plan only emits the `rfid-login` IPC event with `{ tagId, encryptedKey }`.
- Security (clone/replay) mitigation is a backend responsibility: bind the token to the card UID (`tagId` is provided) and/or use short token validity.

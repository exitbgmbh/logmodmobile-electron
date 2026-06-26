const BLOCK_SIZE = 16;
const BLOCKS_PER_SECTOR = 4;

const FIRST_SECTOR = 1;
const LAST_SECTOR = 15;
const DATA_BLOCKS_PER_SECTOR = 3; // 4th block is the trailer

const MAGIC = Buffer.from('LM', 'ascii');
const VERSION = 1;
const HEADER_LEN = 5; // magic(2) + version(1) + payloadLen(2 BE)

const TOKEN_PREFIX = 'EXEC';

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

module.exports = {
    BLOCK_SIZE,
    BLOCKS_PER_SECTOR,
    MAGIC,
    HEADER_LEN,
    CAPACITY_BYTES,
    HEADER_BLOCK,
    sectorOf,
    parseKey,
    buildLoadKey,
    buildAuth,
    buildRead,
    buildWrite,
    planDataBlocks,
    tokenToParts,
    partsToToken,
    encodePayload,
    decodePayload,
    payloadByteLength,
    bytesToBlocks,
    blocksToBytes,
};

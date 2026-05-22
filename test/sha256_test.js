const chai = require("chai");
const path = require("path");
const crypto = require("crypto");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;

function buffer2bits(buff) {
    const bits = [];
    for (let i = 0; i < buff.length; i++) {
        for (let j = 7; j >= 0; j--) {
            bits.push((buff[i] >> j) & 1);
        }
    }
    return bits;
}

function bits2buffer(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) {
            b = (b << 1) | (bits[i + j] ? 1 : 0);
        }
        bytes.push(b);
    }
    return Buffer.from(bytes);
}

const BUILD = path.join(__dirname, "..", "build");

describe("SHA-256 (opencircom)", function () {
    let circuit256;
    this.timeout(120000);

    before(async () => {
        circuit256 = await wasm_tester(path.join(__dirname, "circuits", "sha256_256_test.circom"), {
            output: BUILD,
            recompile: false
        });
    });

    it("matches Node crypto SHA-256 for 32 zero bytes", async () => {
        const msg = Buffer.alloc(32, 0);
        const expectedHash = crypto.createHash("sha256").update(msg).digest();
        const inBits = buffer2bits(msg);
        const w = await circuit256.calculateWitness({ in: inBits }, true);
        await circuit256.checkConstraints(w);
        const outBits = [];
        for (let i = 0; i < 256; i++) {
            outBits.push(Number(w[1 + i].toString()));
        }
        const got = bits2buffer(outBits);
        assert.equal(got.toString("hex"), expectedHash.toString("hex"));
    });

    it("matches Node crypto SHA-256 for 32-byte message", async () => {
        const msg = Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "utf8");
        const expectedHash = crypto.createHash("sha256").update(msg).digest();
        const inBits = buffer2bits(msg);
        const w = await circuit256.calculateWitness({ in: inBits }, true);
        await circuit256.checkConstraints(w);
        const outBits = [];
        for (let i = 0; i < 256; i++) {
            outBits.push(Number(w[1 + i].toString()));
        }
        const got = bits2buffer(outBits);
        assert.equal(got.toString("hex"), expectedHash.toString("hex"));
    });

    it("empty message (256 zero bits) matches SHA-256 of 32 zero bytes", async () => {
        const msg = Buffer.alloc(32, 0);
        const expectedHash = crypto.createHash("sha256").update(msg).digest();
        const inBits = Array(256).fill(0);
        const w = await circuit256.calculateWitness({ in: inBits }, true);
        await circuit256.checkConstraints(w);
        const outBits = [];
        for (let i = 0; i < 256; i++) {
            outBits.push(Number(w[1 + i].toString()));
        }
        const got = bits2buffer(outBits);
        assert.equal(got.toString("hex"), expectedHash.toString("hex"));
    });
});

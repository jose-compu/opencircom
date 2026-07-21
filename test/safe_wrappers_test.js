const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;

const BUILD = path.join(__dirname, "..", "build");

function baseInput(overrides = {}) {
  return {
    a: 0,
    b: 0,
    c1: [10, 20],
    s1: 0,
    c2: [100, 200, 300, 400],
    s2: [0, 0],
    bits: [0, 0, 0, 0, 0, 0, 0, 0],
    ...overrides,
  };
}

describe("Safe wrappers (opencircom)", function () {
  let circuit;
  this.timeout(60000);

  before(async () => {
    circuit = await wasm_tester(path.join(__dirname, "circuits", "safe_wrappers_test.circom"), {
      output: BUILD,
      recompile: false,
    });
  });

  it("SafeAND: 1,1 => 1; 0,1 => 0", async () => {
    const w11 = await circuit.calculateWitness(baseInput({ a: 1, b: 1 }), true);
    await circuit.checkConstraints(w11);
    assert.equal(w11[1].toString(), "1");
    const w01 = await circuit.calculateWitness(baseInput({ a: 0, b: 1 }), true);
    await circuit.checkConstraints(w01);
    assert.equal(w01[1].toString(), "0");
  });

  it("SafeOR: 0,0 => 0; 1,0 => 1; 1,1 => 1", async () => {
    const w00 = await circuit.calculateWitness(baseInput({ a: 0, b: 0 }), true);
    await circuit.checkConstraints(w00);
    assert.equal(w00[2].toString(), "0");
    const w10 = await circuit.calculateWitness(baseInput({ a: 1, b: 0 }), true);
    assert.equal(w10[2].toString(), "1");
    const w11 = await circuit.calculateWitness(baseInput({ a: 1, b: 1 }), true);
    assert.equal(w11[2].toString(), "1");
  });

  it("SafeMux1: s=0 => c[0]; s=1 => c[1]", async () => {
    const w0 = await circuit.calculateWitness(baseInput({ s1: 0 }), true);
    await circuit.checkConstraints(w0);
    assert.equal(w0[3].toString(), "10");
    const w1 = await circuit.calculateWitness(baseInput({ s1: 1 }), true);
    await circuit.checkConstraints(w1);
    assert.equal(w1[3].toString(), "20");
  });

  it("SafeMux2: s selects c[s[0]+2*s[1]]", async () => {
    const w0 = await circuit.calculateWitness(baseInput({ s2: [0, 0] }), true);
    await circuit.checkConstraints(w0);
    assert.equal(w0[4].toString(), "100");
    const w3 = await circuit.calculateWitness(baseInput({ s2: [1, 1] }), true);
    await circuit.checkConstraints(w3);
    assert.equal(w3[4].toString(), "400");
  });

  it("SafeBits2Num(8) recomposes binary bits", async () => {
    // 42 = 0b00101010, LSB first
    const bits = [0, 1, 0, 1, 0, 1, 0, 0];
    const w = await circuit.calculateWitness(baseInput({ bits }), true);
    await circuit.checkConstraints(w);
    assert.equal(w[5].toString(), "42");
  });

  it("SafeAND rejects non-binary a", async () => {
    let failed = false;
    try {
      await circuit.calculateWitness(baseInput({ a: 2, b: 1 }), true);
    } catch (_) {
      failed = true;
    }
    assert.isTrue(failed);
  });

  it("SafeOR rejects non-binary b", async () => {
    let failed = false;
    try {
      await circuit.calculateWitness(baseInput({ a: 1, b: 3 }), true);
    } catch (_) {
      failed = true;
    }
    assert.isTrue(failed);
  });

  it("SafeMux1 rejects non-binary selector", async () => {
    let failed = false;
    try {
      await circuit.calculateWitness(baseInput({ s1: 2 }), true);
    } catch (_) {
      failed = true;
    }
    assert.isTrue(failed);
  });

  it("SafeMux2 rejects non-binary selector bit", async () => {
    let failed = false;
    try {
      await circuit.calculateWitness(baseInput({ s2: [2, 0] }), true);
    } catch (_) {
      failed = true;
    }
    assert.isTrue(failed);
  });

  it("SafeBits2Num rejects non-binary bit", async () => {
    let failed = false;
    try {
      const bits = [0, 1, 2, 0, 0, 0, 0, 0];
      await circuit.calculateWitness(baseInput({ bits }), true);
    } catch (_) {
      failed = true;
    }
    assert.isTrue(failed);
  });
});

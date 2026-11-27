const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;

const BUILD = path.join(__dirname, "..", "build");
const MAX32 = 2n ** 32n - 1n;

const idle = {
  addA: 0,
  addB: 0,
  mulA: 0,
  mulB: 0,
  mulQ: 0,
  mulR: 0,
  mul1A: 0,
  mul1B: 0,
  mul1Q: 0,
  mul1R: 0,
  cmpA: 0,
  cmpB: 0,
  bal: 0,
  next: 0,
  amt: 0,
};

describe("FixedPoint (opencircom)", function () {
  let circuit;
  this.timeout(120000);

  before(async () => {
    circuit = await wasm_tester(path.join(__dirname, "circuits", "fixed_point_test.circom"), {
      output: BUILD,
      recompile: false,
    });
  });

  it("add: 1500000 + 2250000 = 3750000", async () => {
    const w = await circuit.calculateWitness({ ...idle, addA: 1500000, addB: 2250000 }, true);
    await circuit.checkConstraints(w);
    assert.equal(w[1].toString(), "3750000");
  });

  it("add: 0 + 0 = 0", async () => {
    const w = await circuit.calculateWitness(idle, true);
    await circuit.checkConstraints(w);
    assert.equal(w[1].toString(), "0");
  });

  it("add: (2^32-1) + 0", async () => {
    const w = await circuit.calculateWitness({ ...idle, addA: MAX32 }, true);
    await circuit.checkConstraints(w);
    assert.equal(w[1].toString(), MAX32.toString());
  });

  it("mul: floor 2000000 * 3000000 => q=6000000, r=0", async () => {
    const w = await circuit.calculateWitness(
      { ...idle, mulA: 2000000, mulB: 3000000, mulQ: 6000000, mulR: 0 },
      true
    );
    await circuit.checkConstraints(w);
    assert.equal(w[2].toString(), "6000000");
  });

  it("mul scale 1: 19 * 1 => q=1, r=9", async () => {
    const w = await circuit.calculateWitness(
      { ...idle, mul1A: 19, mul1B: 1, mul1Q: 1, mul1R: 9 },
      true
    );
    await circuit.checkConstraints(w);
  });

  it("compare: 100 < 200 is 1", async () => {
    const w = await circuit.calculateWitness({ ...idle, cmpA: 100, cmpB: 200 }, true);
    await circuit.checkConstraints(w);
    assert.equal(w[3].toString(), "1");
  });

  it("compare: 200 < 100 is 0", async () => {
    const w = await circuit.calculateWitness({ ...idle, cmpA: 200, cmpB: 100 }, true);
    await circuit.checkConstraints(w);
    assert.equal(w[3].toString(), "0");
  });

  it("compare: equal operands => 0", async () => {
    const w = await circuit.calculateWitness({ ...idle, cmpA: 50, cmpB: 50 }, true);
    await circuit.checkConstraints(w);
    assert.equal(w[3].toString(), "0");
  });

  it("transfer: 10000000 = 6500000 + 3500000", async () => {
    const w = await circuit.calculateWitness(
      { ...idle, bal: 10000000, next: 6500000, amt: 3500000 },
      true
    );
    await circuit.checkConstraints(w);
  });

  it("rejects add overflow (2^32-1) + 1", async () => {
    try {
      await circuit.calculateWitness({ ...idle, addA: MAX32, addB: 1 }, true);
      assert.fail("expected constraint failure");
    } catch (e) {
      assert.match(String(e), /Error|Assert|constraint/i);
    }
  });

  it("rejects non-n-bit add operand", async () => {
    try {
      await circuit.calculateWitness({ ...idle, addA: 2n ** 32n }, true);
      assert.fail("expected constraint failure");
    } catch (e) {
      assert.match(String(e), /Error|Assert|constraint/i);
    }
  });

  it("rejects wrong mul q/r", async () => {
    try {
      await circuit.calculateWitness(
        { ...idle, mulA: 2000000, mulB: 3000000, mulQ: 5999999, mulR: 0 },
        true
      );
      assert.fail("expected constraint failure");
    } catch (e) {
      assert.match(String(e), /Error|Assert|constraint/i);
    }
  });

  it("rejects transfer amount larger than balance partition", async () => {
    try {
      await circuit.calculateWitness(
        { ...idle, bal: 10000000, next: 3000000, amt: 3500000 },
        true
      );
      assert.fail("expected constraint failure");
    } catch (e) {
      assert.match(String(e), /Error|Assert|constraint/i);
    }
  });
});
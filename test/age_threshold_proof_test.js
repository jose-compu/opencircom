const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;

const BUILD = path.join(__dirname, "..", "build");

describe("AgeThresholdProof (opencircom)", function () {
    let circuit;
    this.timeout(60000);

    before(async () => {
        circuit = await wasm_tester(
            path.join(__dirname, "circuits", "age_threshold_proof_test.circom"),
            { output: BUILD, recompile: false }
        );
    });

    it("accepts age == minAge (boundary: exactly passes)", async () => {
        const w = await circuit.calculateWitness({ birthYear: 2000, currentYear: 2026, minAge: 26 }, true);
        await circuit.checkConstraints(w);
        assert.equal(w[1].toString(), "1");
    });

    it("rejects age == minAge - 1 (boundary: one year below)", async () => {
        const w = await circuit.calculateWitness({ birthYear: 2001, currentYear: 2026, minAge: 26 }, true);
        await circuit.checkConstraints(w);
        assert.equal(w[1].toString(), "0");
    });

    it("rejects birthYear > currentYear (underflow)", async () => {
        try {
            const w = await circuit.calculateWitness({ birthYear: 2030, currentYear: 2026, minAge: 18 }, true);
            await circuit.checkConstraints(w);
            assert.fail("should have thrown for birthYear > currentYear");
        } catch (e) {
            assert.ok(e, "expected constraint failure");
        }
    });
});

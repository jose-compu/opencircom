const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;
const buildPoseidon = require("circomlibjs").buildPoseidon;

const assert = chai.assert;

const CIRCUITS = {
    1: "poseidon_compat_1.circom",
    2: "poseidon2_test.circom",
    3: "poseidon_test.circom",
    4: "poseidon4_test.circom",
    16: "poseidon_compat_16.circom",
};

const LARGE_FIELD =
    "21888242871839275222246405745257275088548364400416034343698204186575808495617";

function testVectors(width) {
    const zeros = Array(width).fill(0);
    const small = Array.from({ length: width }, (_, i) => i + 1);
    const large = Array.from({ length: width }, (_, i) =>
        i === 0 ? LARGE_FIELD : i
    );
    return [zeros, small, large];
}

describe("Poseidon compatibility with circomlib (JS reference)", function () {
    let poseidon;
    let F;
    const circuits = {};

    this.timeout(180000);

    before(async () => {
        poseidon = await buildPoseidon();
        F = poseidon.F;
        for (const [width, file] of Object.entries(CIRCUITS)) {
            circuits[width] = await wasm_tester(path.join(__dirname, "circuits", file), {
                output: path.join(__dirname, "..", "build"),
                recompile: false,
            });
        }
    });

    for (const width of [1, 2, 3, 4, 16]) {
        for (const inputs of testVectors(width)) {
            const label = JSON.stringify(inputs);
            it(`Poseidon(${width}) matches circomlib for ${label}`, async () => {
                const w = await circuits[width].calculateWitness({ in: inputs }, true);
                await circuits[width].checkConstraints(w);

                const ref = poseidon(inputs.map((x) => BigInt(x)));
                const expected = F.toObject(ref).toString();
                const actual = w[1].toString();

                assert.equal(
                    actual,
                    expected,
                    `Poseidon(${width}) mismatch for ${label}: got ${actual}, expected ${expected}`
                );
            });
        }
    }
});
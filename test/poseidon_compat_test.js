const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;

const OPEN_CIRCUITS = {
    1: "poseidon1_test.circom",
    2: "poseidon2_test.circom",
    4: "poseidon4_test.circom",
    16: "poseidon16_test.circom",
};

const CIRCOMLIB_CIRCUITS = {
    1: "poseidon_circomlib_1_test.circom",
    2: "poseidon_circomlib_2_test.circom",
    4: "poseidon_circomlib_4_test.circom",
    16: "poseidon_circomlib_16_test.circom",
};

function vectorSet(width) {
    return [
        Array(width).fill(0),
        Array.from({ length: width }, (_, i) => i + 1),
        Array.from({ length: width }, (_, i) => String((i + 1) * 17)),
    ];
}

describe("Poseidon compatibility with circomlib", function () {
    const circuits = {};
    this.timeout(120000);

    before(async () => {
        for (const width of Object.keys(OPEN_CIRCUITS)) {
            circuits[width] = {
                opencircom: await wasm_tester(path.join(__dirname, "circuits", OPEN_CIRCUITS[width]), {
                    output: path.join(__dirname, "..", "build"),
                    recompile: false,
                }),
                circomlib: await wasm_tester(path.join(__dirname, "circuits", CIRCOMLIB_CIRCUITS[width]), {
                    output: path.join(__dirname, "..", "build"),
                    recompile: false,
                }),
            };
        }
    });

    for (const width of [1, 2, 4, 16]) {
        it(`matches circomlib Poseidon(${width}) reference outputs`, async () => {
            for (const inputs of vectorSet(width)) {
                const opencircomWitness = await circuits[width].opencircom.calculateWitness({ in: inputs }, true);
                const circomlibWitness = await circuits[width].circomlib.calculateWitness({ in: inputs }, true);

                await circuits[width].opencircom.checkConstraints(opencircomWitness);
                await circuits[width].circomlib.checkConstraints(circomlibWitness);

                assert.equal(
                    opencircomWitness[1].toString(),
                    circomlibWitness[1].toString(),
                    `Poseidon(${width}) mismatch for ${JSON.stringify(inputs)}`
                );
            }
        });
    }
});

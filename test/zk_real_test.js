"use strict";

const chai = require("chai");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const wasm_tester = require("circom_tester").wasm;
const snarkjs = require("snarkjs");

const assert = chai.assert;

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const CIRCUIT_NAME = "poseidon_public_test";

function exec(cmd, opts) {
  return execSync(cmd, { encoding: "utf8", cwd: ROOT, ...opts });
}

describe("ZK real (Groth16 prove & verify)", function () {
  this.timeout(120000);

  before(async function () {
    if (!fs.existsSync(path.join(BUILD, `${CIRCUIT_NAME}_final.zkey`))) {
      console.log("Running setup_zk_tests.sh to generate ptau and zkey...");
      exec("bash scripts/setup_zk_tests.sh");
    }
    assert.isTrue(fs.existsSync(path.join(BUILD, `${CIRCUIT_NAME}_final.zkey`)), "zkey missing: run bash scripts/setup_zk_tests.sh");
  });

  it("compiles circuit, generates witness, proves and verifies with snarkjs", async function () {
    const wasmPath = path.join(BUILD, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
    const zkeyPath = path.join(BUILD, `${CIRCUIT_NAME}_final.zkey`);
    const vkeyPath = path.join(BUILD, `${CIRCUIT_NAME}_vkey.json`);
    assert.isTrue(fs.existsSync(wasmPath), "WASM missing");
    assert.isTrue(fs.existsSync(zkeyPath), "zkey missing");
    assert.isTrue(fs.existsSync(vkeyPath), "vkey missing");

    // Get correct public output: run non-public poseidon circuit to compute hash of [1,2,3]
    const poseidonOnly = await wasm_tester(path.join(__dirname, "circuits", "poseidon_test.circom"), {
      output: BUILD,
      recompile: false,
    });
    const w = await poseidonOnly.calculateWitness({ in: [1, 2, 3] }, true);
    await poseidonOnly.checkConstraints(w);
    const expectedOut = w[1].toString();

    const input = {
      in: ["1", "2", "3"],
      out: expectedOut,
    };
    const inputPath = path.join(BUILD, "zk_input.json");
    const witnessPath = path.join(BUILD, "zk_witness.wtns");
    fs.writeFileSync(inputPath, JSON.stringify(input));

    exec(`node ${path.join(BUILD, `${CIRCUIT_NAME}_js`, "generate_witness.js")} ${wasmPath} ${inputPath} ${witnessPath}`);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    assert.lengthOf(publicSignals, 1);
    assert.equal(publicSignals[0].toString(), expectedOut);

    const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
    const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    assert.isTrue(ok, "Groth16 verify must pass for valid proof");
  });

  after(async function () {
    // ffjavascript/snarkjs keep a curve worker open after prove/verify.
    if (globalThis.curve_bn128) {
      await globalThis.curve_bn128.terminate();
    }
  });
});

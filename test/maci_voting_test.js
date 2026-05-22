const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;
const BUILD = path.join(__dirname, "..", "build");

async function poseidonN(circuit, inputs) {
  const w = await circuit.calculateWitness({ in: inputs }, true);
  await circuit.checkConstraints(w);
  return w[1].toString();
}

async function poseidon2(circuit, a, b) {
  return poseidonN(circuit, [a, b]);
}

async function poseidon3(circuit, a, b, c) {
  return poseidonN(circuit, [a, b, c]);
}

async function poseidon4(circuit, a, b, c, d) {
  return poseidonN(circuit, [a, b, c, d]);
}

async function poseidon7(circuit, arr) {
  return poseidonN(circuit, arr);
}

function maciPack(stateIndex, voteOption, nonce, voteWeight, pollId) {
  const pow50 = 2n ** 50n;
  const pow100 = pow50 * pow50;
  const pow150 = pow100 * pow50;
  const pow200 = pow150 * pow50;
  return (
    BigInt(stateIndex) +
    BigInt(voteOption) * pow50 +
    BigInt(nonce) * pow100 +
    BigInt(voteWeight) * pow150 +
    BigInt(pollId) * pow200
  ).toString();
}

async function maciKeystream(poseidon3Circuit, sharedKeyHash, nonce, index) {
  return poseidon3(poseidon3Circuit, sharedKeyHash, nonce, index);
}

async function maciEncrypt(poseidon3Circuit, sharedKeyHash, nonce, plaintext) {
  const ciphertext = [];
  for (let i = 0; i < plaintext.length; i++) {
    const ks = await maciKeystream(poseidon3Circuit, sharedKeyHash, nonce, i);
    const pt = BigInt(plaintext[i]);
    const ct = (pt + BigInt(ks)).toString();
    ciphertext.push(ct);
  }
  return ciphertext;
}

describe("MACI vote building blocks (opencircom)", function () {
  let packCircuit;
  let commitCircuit;
  let decryptVerifyCircuit;
  let roundtripCircuit;
  let poseidon2Circuit;
  let poseidon3Circuit;
  let poseidon4Circuit;
  let poseidon7Circuit;
  this.timeout(120000);

  before(async () => {
    const opts = { output: BUILD, recompile: false };
    packCircuit = await wasm_tester(
      path.join(__dirname, "circuits", "maci_command_pack_test.circom"),
      opts
    );
    commitCircuit = await wasm_tester(
      path.join(__dirname, "circuits", "maci_vote_commit_test.circom"),
      opts
    );
    decryptVerifyCircuit = await wasm_tester(
      path.join(__dirname, "circuits", "maci_vote_decrypt_verify_test.circom"),
      opts
    );
    roundtripCircuit = await wasm_tester(
      path.join(__dirname, "circuits", "maci_message_roundtrip_test.circom"),
      opts
    );
    poseidon2Circuit = await wasm_tester(
      path.join(__dirname, "circuits", "poseidon2_test.circom"),
      opts
    );
    poseidon3Circuit = await wasm_tester(
      path.join(__dirname, "circuits", "poseidon3_test.circom"),
      opts
    );
    poseidon4Circuit = await wasm_tester(
      path.join(__dirname, "circuits", "poseidon4_test.circom"),
      opts
    );
    poseidon7Circuit = await wasm_tester(
      path.join(__dirname, "circuits", "poseidon7_test.circom"),
      opts
    );
  });

  describe("MACICommandPack", function () {
    it("packs five 50-bit fields into p", async () => {
      const stateIndex = 3;
      const voteOption = 1;
      const nonce = 2;
      const voteWeight = 10;
      const pollId = 99;
      const expected = maciPack(stateIndex, voteOption, nonce, voteWeight, pollId);
      const w = await packCircuit.calculateWitness(
        { stateIndex, voteOption, nonce, voteWeight, pollId },
        true
      );
      await packCircuit.checkConstraints(w);
      assert.equal(w[1].toString(), expected);
    });
  });

  describe("MACIMessageEncrypt / Decrypt", function () {
    it("encrypt-decrypt roundtrip restores plaintext", async () => {
      const sharedKeyHash = await poseidon2(poseidon2Circuit, 111, 222);
      const nonce = 2;
      const plaintext = ["100", "200", "300", "400", "500", "600", "700"];
      const w = await roundtripCircuit.calculateWitness(
        { sharedKeyHash, nonce, plaintext, expectedPlaintext: plaintext },
        true
      );
      await roundtripCircuit.checkConstraints(w);
    });
  });

  describe("MACIVoteCommit", function () {
    it("commit: ciphertext and hashes match expected", async () => {
      const stateIndex = 1;
      const voteOption = 2;
      const nonce = 1;
      const voteWeight = 5;
      const pollId = 42;
      const pubKeyX = 123456789;
      const pubKeyY = 987654321;
      const salt = 555;
      const sigR8x = 1111;
      const sigR8y = 2222;
      const sigS = 3333;
      const ks0 = 9001;
      const ks1 = 9002;
      const sharedKeyHash = await poseidon2(poseidon2Circuit, ks0, ks1);

      const packed = maciPack(stateIndex, voteOption, nonce, voteWeight, pollId);
      const commandHash = await poseidon4(
        poseidon4Circuit,
        packed,
        pubKeyX,
        pubKeyY,
        salt
      );
      const plaintext = [packed, pubKeyX, pubKeyY, salt, sigR8x, sigR8y, sigS];
      const ciphertext = await maciEncrypt(
        poseidon3Circuit,
        sharedKeyHash,
        nonce,
        plaintext
      );
      const messageHash = await poseidon7(poseidon7Circuit, ciphertext);

      const w = await commitCircuit.calculateWitness(
        {
          stateIndex,
          voteOption,
          nonce,
          voteWeight,
          pollId,
          pubKeyX,
          pubKeyY,
          salt,
          sigR8x,
          sigR8y,
          sigS,
          sharedKeyHash,
          messageHash,
          commandHash,
        },
        true
      );
      await commitCircuit.checkConstraints(w);
    });

    it("fails when messageHash does not match ciphertext", async () => {
      const inputs = {
        stateIndex: 1,
        voteOption: 0,
        nonce: 1,
        voteWeight: 1,
        pollId: 1,
        pubKeyX: 1,
        pubKeyY: 2,
        salt: 3,
        sigR8x: 4,
        sigR8y: 5,
        sigS: 6,
        sharedKeyHash: 7,
        messageHash: "0",
        commandHash: "0",
      };
      try {
        await commitCircuit.calculateWitness(inputs, true);
        assert.fail("should have thrown");
      } catch (e) {
        assert.isOk(e);
      }
    });
  });

  describe("MACIVoteDecryptVerify", function () {
    it("valid decrypted vote passes allowlist and nonce checks", async () => {
      const stateIndex = 5;
      const voteOption = 2;
      const nonce = 3;
      const voteWeight = 10;
      const pollId = 99;
      const packed = maciPack(stateIndex, voteOption, nonce, voteWeight, pollId);
      const allowedVoteOptions = [0, 2, 5];
      const w = await decryptVerifyCircuit.calculateWitness(
        {
          packed,
          voteOption,
          nonce,
          voteWeight,
          pollId,
          stateIndex,
          expectedPollId: pollId,
          minValidNonce: 2,
          allowedVoteOptions,
        },
        true
      );
      await decryptVerifyCircuit.checkConstraints(w);
      assert.equal(w[1].toString(), "1");
    });

    it("fails when voteOption not in allowlist", async () => {
      const stateIndex = 1;
      const voteOption = 7;
      const nonce = 2;
      const voteWeight = 1;
      const pollId = 1;
      const packed = maciPack(stateIndex, voteOption, nonce, voteWeight, pollId);
      const w = await decryptVerifyCircuit.calculateWitness(
        {
          packed,
          voteOption,
          nonce,
          voteWeight,
          pollId,
          stateIndex,
          expectedPollId: pollId,
          minValidNonce: 1,
          allowedVoteOptions: [0, 2, 5],
        },
        true
      );
      await decryptVerifyCircuit.checkConstraints(w);
      assert.equal(w[1].toString(), "0");
    });

    it("fails when nonce below minValidNonce", async () => {
      const stateIndex = 1;
      const voteOption = 2;
      const nonce = 1;
      const voteWeight = 1;
      const pollId = 10;
      const packed = maciPack(stateIndex, voteOption, nonce, voteWeight, pollId);
      const w = await decryptVerifyCircuit.calculateWitness(
        {
          packed,
          voteOption,
          nonce,
          voteWeight,
          pollId,
          stateIndex,
          expectedPollId: pollId,
          minValidNonce: 2,
          allowedVoteOptions: [0, 2, 5],
        },
        true
      );
      await decryptVerifyCircuit.checkConstraints(w);
      assert.equal(w[1].toString(), "0");
    });

    it("fails when pollId mismatch", async () => {
      const stateIndex = 1;
      const voteOption = 2;
      const nonce = 2;
      const voteWeight = 1;
      const pollId = 10;
      const packed = maciPack(stateIndex, voteOption, nonce, voteWeight, pollId);
      const w = await decryptVerifyCircuit.calculateWitness(
        {
          packed,
          voteOption,
          nonce,
          voteWeight,
          pollId,
          stateIndex,
          expectedPollId: 99,
          minValidNonce: 1,
          allowedVoteOptions: [0, 2, 5],
        },
        true
      );
      await decryptVerifyCircuit.checkConstraints(w);
      assert.equal(w[1].toString(), "0");
    });
  });
});

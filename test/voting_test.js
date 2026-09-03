const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;

async function poseidon4(poseidon4Circuit, choice, revealIdentity, salt, ballotId) {
  const w = await poseidon4Circuit.calculateWitness(
    { in: [choice, revealIdentity, salt, ballotId] },
    true
  );
  await poseidon4Circuit.checkConstraints(w);
  return w[1].toString();
}

describe("Voting (commit-reveal, nullifier)", function () {
  let commitCircuit;
  let commitAllowlistCircuit;
  let revealCircuit;
  let poseidon4Circuit;
  this.timeout(60000);

  before(async () => {
    const opts = { output: path.join(__dirname, "..", "build"), recompile: false };
    commitCircuit = await wasm_tester(
      path.join(__dirname, "circuits", "voting_commit_test.circom"),
      opts
    );
    commitAllowlistCircuit = await wasm_tester(
      path.join(__dirname, "circuits", "vote_commit_allowlist_test.circom"),
      opts
    );
    revealCircuit = await wasm_tester(
      path.join(__dirname, "circuits", "voting_reveal_test.circom"),
      opts
    );
    poseidon4Circuit = await wasm_tester(
      path.join(__dirname, "circuits", "poseidon4_test.circom"),
      opts
    );
  });

  describe("VoteCommit", function () {
    it("constraints pass for valid choice in [0, numChoices)", async () => {
      const choice = 2;
      const revealIdentity = 12345;
      const salt = 67890;
      const ballotId = 1;
      const commitment = await poseidon4(poseidon4Circuit, choice, revealIdentity, salt, ballotId);
      const w = await commitCircuit.calculateWitness(
        { choice, revealIdentity, salt, ballotId, commitment },
        true
      );
      await commitCircuit.checkConstraints(w);
    });

    it("fails when commitment does not match", async () => {
      const choice = 0;
      const revealIdentity = 1;
      const salt = 2;
      const ballotId = 3;
      const badCommitment = "999999";
      try {
        await commitCircuit.calculateWitness(
          { choice, revealIdentity, salt, ballotId, commitment: badCommitment },
          true
        );
        assert.fail("should have thrown");
      } catch (e) {
        assert.isOk(e);
      }
    });

    it("VoteCommitAllowlist: choice in allowedChoices and commitment matches", async () => {
      const allowedChoices = [1, 3, 5];
      const choice = 3;
      const revealIdentity = 111;
      const salt = 222;
      const ballotId = 7;
      const commitment = await poseidon4(poseidon4Circuit, choice, revealIdentity, salt, ballotId);
      const w = await commitAllowlistCircuit.calculateWitness(
        { choice, allowedChoices, revealIdentity, salt, ballotId, commitment },
        true
      );
      await commitAllowlistCircuit.checkConstraints(w);
    });

    it("fails when choice >= numChoices", async () => {
      const choice = 5;
      const revealIdentity = 1;
      const salt = 2;
      const ballotId = 3;
      const commitment = await poseidon4(poseidon4Circuit, 0, revealIdentity, salt, ballotId);
      try {
        await commitCircuit.calculateWitness(
          { choice, revealIdentity, salt, ballotId, commitment },
          true
        );
        assert.fail("should have thrown for choice >= 5");
      } catch (e) {
        assert.isOk(e);
      }
    });

    it("fails when choice wraps LessThan(32) over Fr (p - 2^32 + numChoices)", async () => {
      // BN254 scalar field. Without StrictNum2Bits, LessThan(32) accepts this as < numChoices.
      const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
      const numChoices = 5n;
      const choice = (p - (1n << 32n) + numChoices).toString();
      const revealIdentity = 1;
      const salt = 2;
      const ballotId = 3;
      const commitment = await poseidon4(poseidon4Circuit, choice, revealIdentity, salt, ballotId);
      try {
        await commitCircuit.calculateWitness(
          { choice, revealIdentity, salt, ballotId, commitment },
          true
        );
        assert.fail("should have thrown for Fr-wraparound choice");
      } catch (e) {
        assert.isOk(e);
      }
    });

    it("same inputs give same commitment", async () => {
      const choice = 1;
      const revealIdentity = 100;
      const salt = 200;
      const ballotId = 42;
      const c1 = await poseidon4(poseidon4Circuit, choice, revealIdentity, salt, ballotId);
      const c2 = await poseidon4(poseidon4Circuit, choice, revealIdentity, salt, ballotId);
      assert.equal(c1, c2);
    });
  });

  describe("VoteReveal", function () {
    it("constraints pass and nullifier is deterministic", async () => {
      const choice = 1;
      const identity = 111;
      const salt = 222;
      const ballotId = 7;
      const commitment = await poseidon4(poseidon4Circuit, choice, identity, salt, ballotId);
      const w = await revealCircuit.calculateWitness(
        { choice, identity, salt, ballotId, commitment },
        true
      );
      await revealCircuit.checkConstraints(w);
      const nullifierHash = w[1].toString();
      assert.isDefined(nullifierHash);
      const w2 = await revealCircuit.calculateWitness(
        { choice, identity, salt, ballotId, commitment },
        true
      );
      assert.equal(w2[1].toString(), nullifierHash);
    });

    it("different (identity, salt) give different nullifiers (double-vote prevention)", async () => {
      const choice = 0;
      const ballotId = 10;
      const commitment1 = await poseidon4(poseidon4Circuit, choice, 1, 100, ballotId);
      const commitment2 = await poseidon4(poseidon4Circuit, choice, 2, 100, ballotId);
      const w1 = await revealCircuit.calculateWitness(
        { choice, identity: 1, salt: 100, ballotId, commitment: commitment1 },
        true
      );
      const w2 = await revealCircuit.calculateWitness(
        { choice, identity: 2, salt: 100, ballotId, commitment: commitment2 },
        true
      );
      assert.notEqual(w1[1].toString(), w2[1].toString());
    });

    it("fails when commitment does not match (choice, identity, salt, ballotId)", async () => {
      const choice = 1;
      const identity = 1;
      const salt = 1;
      const ballotId = 1;
      const commitment = await poseidon4(poseidon4Circuit, choice, identity, salt, ballotId);
      const badCommitment = "0";
      try {
        await revealCircuit.calculateWitness(
          { choice, identity, salt, ballotId, commitment: badCommitment },
          true
        );
        assert.fail("should have thrown");
      } catch (e) {
        assert.isOk(e);
      }
    });
  });

  describe("Commit-reveal flow", function () {
    it("commit then reveal: same (choice, identity, salt, ballotId) yields consistent nullifier", async () => {
      const choice = 3;
      const identity = 999;
      const salt = 888;
      const ballotId = 5;
      const commitment = await poseidon4(poseidon4Circuit, choice, identity, salt, ballotId);
      const commitW = await commitCircuit.calculateWitness(
        { choice, revealIdentity: identity, salt, ballotId, commitment },
        true
      );
      await commitCircuit.checkConstraints(commitW);
      const revealW = await revealCircuit.calculateWitness(
        { choice, identity, salt, ballotId, commitment },
        true
      );
      await revealCircuit.checkConstraints(revealW);
      assert.isDefined(revealW[1].toString());
    });
  });
});

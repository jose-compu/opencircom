pragma circom 2.0.0;

include "../hashing/poseidon.circom";
include "../merkle/merkle_inclusion.circom";

/**
 * @title VoteReveal
 * @notice Reveal phase: proves (choice, identity, salt, ballotId) match commitment and outputs nullifier for double-vote prevention.
 * @dev Nullifier = H(H(identity, salt), ballotId). Contract must check commitment was in the committed set and nullifier not yet spent.
 * @custom:input choice Voter's choice.
 * @custom:input identity Voter identity.
 * @custom:input salt Salt (must match commit phase).
 * @custom:input ballotId Ballot identifier.
 * @custom:input commitment Commitment (must equal H(choice, identity, salt, ballotId)).
 * @custom:output nullifierHash Nullifier hash for double-vote prevention.
 * @custom:complexity Poseidon(4) + Poseidon(2) + Nullifier(1): ~780 constraints. Dominated by hashes.
 * @custom:security Contract must verify commitment was in committed set and nullifier not already spent. Same (identity, salt, ballotId) yields same nullifier (double-vote detection). choice is bound by the Poseidon commitment (range-checked in VoteCommit); ballotId is a field-element hash input.
 */
template VoteReveal() {
    signal input choice;
    signal input identity;
    signal input salt;
    signal input ballotId;
    signal input commitment;  // must equal H(choice, identity, salt, ballotId); contract verifies it was committed

    signal output nullifierHash;

    component commitmentHash = Poseidon(4);
    commitmentHash.inputs[0] <== choice;
    commitmentHash.inputs[1] <== identity;
    commitmentHash.inputs[2] <== salt;
    commitmentHash.inputs[3] <== ballotId;
    commitmentHash.out === commitment;

    component inner = Poseidon(2);
    inner.inputs[0] <== identity;
    inner.inputs[1] <== salt;

    component n = Nullifier(1);
    n.secret <== inner.out;
    n.externalNullifier <== ballotId;
    nullifierHash <== n.nullifierHash;
}

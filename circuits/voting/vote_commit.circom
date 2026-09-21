pragma circom 2.0.0;

include "../hashing/poseidon.circom";
include "../comparators.circom";
include "../utils.circom";

/**
 * @title VoteCommit
 * @notice Commit phase: proves commitment = H(choice, revealIdentity, salt, ballotId) and choice in [0, numChoices).
 * @dev Public input: commitment (contract stores it for reveal phase). Use with VoteReveal for anonymous 1-of-N voting.
 * @param numChoices Number of choices (choice must be < numChoices).
 * @custom:input choice Voter's choice (private).
 * @custom:input revealIdentity Identity used in reveal.
 * @custom:input salt Random salt.
 * @custom:input ballotId Ballot identifier.
 * @custom:input commitment Public commitment (must match H(choice, revealIdentity, salt, ballotId)).
 * @custom:complexity StrictNum2Bits(32) + LessThan(32) + Poseidon(4): ~370 constraints. Keep numChoices within 32-bit range.
 * @custom:security Commitment must be published and stored for reveal. choice is alias-checked into [0, 2^32) then constrained to [0, numChoices). ballotId is a Poseidon input (field element); uniqueness is an application/contract concern.
 */
template VoteCommit(numChoices) {
    assert(numChoices >= 1 && numChoices < (1 << 32));
    signal input choice;
    signal input revealIdentity;
    signal input salt;
    signal input ballotId;
    signal input commitment;

    // LessThan(32) is unsound unless both inputs are in [0, 2^32).
    component strictChoice = StrictNum2Bits(32);
    strictChoice.in <== choice;

    component range = LessThan(32);
    range.in[0] <== choice;
    range.in[1] <== numChoices;
    range.out === 1;

    component h = Poseidon(4);
    h.inputs[0] <== choice;
    h.inputs[1] <== revealIdentity;
    h.inputs[2] <== salt;
    h.inputs[3] <== ballotId;
    h.out === commitment;
}

/**
 * @title VoteCommitAllowlist
 * @notice Commit phase with allowlist: commitment = H(choice, revealIdentity, salt, ballotId) and choice in allowedChoices[n].
 * @dev Use with VoteReveal for anonymous 1-of-N voting when valid choices are a set (e.g. [2,5,7]). Contract verifies proof and tallies.
 * @param n Number of allowed choices.
 * @custom:input choice Voter's choice (private).
 * @custom:input allowedChoices[n] Valid choices (field elements).
 * @custom:input revealIdentity Identity used in reveal.
 * @custom:input salt Random salt.
 * @custom:input ballotId Ballot identifier.
 * @custom:input commitment Public commitment (must match H(choice, revealIdentity, salt, ballotId)).
 */
template VoteCommitAllowlist(n) {
    assert(n >= 1);
    signal input choice;
    signal input allowedChoices[n];
    signal input revealIdentity;
    signal input salt;
    signal input ballotId;
    signal input commitment;

    component allowlist = VoteInAllowlist(n);
    allowlist.vote <== choice;
    for (var i = 0; i < n; i++) {
        allowlist.allowedChoices[i] <== allowedChoices[i];
    }
    allowlist.out === 1;

    component h = Poseidon(4);
    h.inputs[0] <== choice;
    h.inputs[1] <== revealIdentity;
    h.inputs[2] <== salt;
    h.inputs[3] <== ballotId;
    h.out === commitment;
}

pragma circom 2.0.0;

include "../../circuits/voting/maci_voting.circom";

template MACIVoteDecryptVerifyTest() {
    signal input packed;
    signal input voteOption;
    signal input nonce;
    signal input voteWeight;
    signal input pollId;
    signal input stateIndex;
    signal input expectedPollId;
    signal input minValidNonce;
    signal input allowedVoteOptions[3];
    signal output valid;

    component v = MACIVoteDecryptVerify(3);
    v.packed <== packed;
    v.voteOption <== voteOption;
    v.nonce <== nonce;
    v.voteWeight <== voteWeight;
    v.pollId <== pollId;
    v.stateIndex <== stateIndex;
    v.expectedPollId <== expectedPollId;
    v.minValidNonce <== minValidNonce;
    for (var i = 0; i < 3; i++) {
        v.allowedVoteOptions[i] <== allowedVoteOptions[i];
    }
    valid <== v.valid;
}

component main {public [expectedPollId, minValidNonce]} = MACIVoteDecryptVerifyTest();

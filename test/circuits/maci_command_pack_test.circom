pragma circom 2.0.0;

include "../../circuits/voting/maci_voting.circom";

template MACICommandPackTest() {
    signal input stateIndex;
    signal input voteOption;
    signal input nonce;
    signal input voteWeight;
    signal input pollId;
    signal output packed;

    component p = MACICommandPack();
    p.stateIndex <== stateIndex;
    p.voteOption <== voteOption;
    p.nonce <== nonce;
    p.voteWeight <== voteWeight;
    p.pollId <== pollId;
    packed <== p.packed;
}

component main = MACICommandPackTest();

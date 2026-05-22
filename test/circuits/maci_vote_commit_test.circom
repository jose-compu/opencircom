pragma circom 2.0.0;

include "../../circuits/voting/maci_voting.circom";

template MACIVoteCommitTest() {
    signal input stateIndex;
    signal input voteOption;
    signal input nonce;
    signal input voteWeight;
    signal input pollId;
    signal input pubKeyX;
    signal input pubKeyY;
    signal input salt;
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;
    signal input sharedKeyHash;

    signal input messageHash;
    signal input commandHash;

    component c = MACIVoteCommit();
    c.stateIndex <== stateIndex;
    c.voteOption <== voteOption;
    c.nonce <== nonce;
    c.voteWeight <== voteWeight;
    c.pollId <== pollId;
    c.pubKeyX <== pubKeyX;
    c.pubKeyY <== pubKeyY;
    c.salt <== salt;
    c.sigR8x <== sigR8x;
    c.sigR8y <== sigR8y;
    c.sigS <== sigS;
    c.sharedKeyHash <== sharedKeyHash;

    c.messageHash === messageHash;
    c.commandHash === commandHash;
}

component main {public [messageHash, commandHash]} = MACIVoteCommitTest();

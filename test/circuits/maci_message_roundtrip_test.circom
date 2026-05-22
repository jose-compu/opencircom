pragma circom 2.0.0;

include "../../circuits/voting/maci_voting.circom";

template MACIMessageRoundtripTest() {
    signal input sharedKeyHash;
    signal input nonce;
    signal input plaintext[7];
    signal input expectedPlaintext[7];

    component enc = MACIMessageEncrypt();
    enc.sharedKeyHash <== sharedKeyHash;
    enc.nonce <== nonce;
    for (var i = 0; i < 7; i++) {
        enc.plaintext[i] <== plaintext[i];
    }

    component dec = MACIMessageDecrypt();
    dec.sharedKeyHash <== sharedKeyHash;
    dec.nonce <== nonce;
    for (var j = 0; j < 7; j++) {
        dec.ciphertext[j] <== enc.ciphertext[j];
    }

    for (var k = 0; k < 7; k++) {
        dec.plaintext[k] === expectedPlaintext[k];
    }
}

component main = MACIMessageRoundtripTest();

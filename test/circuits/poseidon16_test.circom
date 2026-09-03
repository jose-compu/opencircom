pragma circom 2.0.0;

include "../../circuits/hashing/poseidon.circom";

template Poseidon16Test() {
    signal input in[16];
    signal output out;
    component p = Poseidon(16);
    for (var i = 0; i < 16; i++) {
        p.inputs[i] <== in[i];
    }
    out <== p.out;
}

component main = Poseidon16Test();

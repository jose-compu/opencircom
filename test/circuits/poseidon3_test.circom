pragma circom 2.0.0;

include "../../circuits/hashing/poseidon.circom";

template Poseidon3Test() {
    signal input in[3];
    signal output out;
    component p = Poseidon(3);
    for (var i = 0; i < 3; i++) {
        p.inputs[i] <== in[i];
    }
    out <== p.out;
}

component main = Poseidon3Test();

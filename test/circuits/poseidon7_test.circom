pragma circom 2.0.0;

include "../../circuits/hashing/poseidon.circom";

template Poseidon7Test() {
    signal input in[7];
    signal output out;
    component p = Poseidon(7);
    for (var i = 0; i < 7; i++) {
        p.inputs[i] <== in[i];
    }
    out <== p.out;
}

component main = Poseidon7Test();

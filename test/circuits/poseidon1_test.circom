pragma circom 2.0.0;

include "../../circuits/hashing/poseidon.circom";

template Poseidon1Test() {
    signal input in[1];
    signal output out;
    component p = Poseidon(1);
    p.inputs[0] <== in[0];
    out <== p.out;
}

component main = Poseidon1Test();

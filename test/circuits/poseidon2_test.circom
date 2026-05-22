pragma circom 2.0.0;

include "../../circuits/hashing/poseidon.circom";

template Poseidon2Test() {
    signal input in[2];
    signal output out;
    component p = Poseidon(2);
    p.inputs[0] <== in[0];
    p.inputs[1] <== in[1];
    out <== p.out;
}

component main = Poseidon2Test();

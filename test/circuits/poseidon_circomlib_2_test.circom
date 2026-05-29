pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template CircomlibPoseidon2Test() {
    signal input in[2];
    signal output out;
    component p = Poseidon(2);
    for (var i = 0; i < 2; i++) {
        p.inputs[i] <== in[i];
    }
    out <== p.out;
}

component main = CircomlibPoseidon2Test();

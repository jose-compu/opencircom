pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template CircomlibPoseidon4Test() {
    signal input in[4];
    signal output out;
    component p = Poseidon(4);
    for (var i = 0; i < 4; i++) {
        p.inputs[i] <== in[i];
    }
    out <== p.out;
}

component main = CircomlibPoseidon4Test();

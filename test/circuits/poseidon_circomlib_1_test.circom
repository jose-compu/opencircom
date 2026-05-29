pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template CircomlibPoseidon1Test() {
    signal input in[1];
    signal output out;
    component p = Poseidon(1);
    p.inputs[0] <== in[0];
    out <== p.out;
}

component main = CircomlibPoseidon1Test();

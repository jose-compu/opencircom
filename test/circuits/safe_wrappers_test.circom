pragma circom 2.0.0;

include "../../circuits/gates.circom";
include "../../circuits/mux1.circom";
include "../../circuits/mux2.circom";
include "../../circuits/bitify.circom";

template SafeWrappersTest() {
    signal input a;
    signal input b;
    signal input c1[2];
    signal input s1;
    signal input c2[4];
    signal input s2[2];
    signal input bits[8];
    signal output andOut;
    signal output orOut;
    signal output mux1Out;
    signal output mux2Out;
    signal output bits2NumOut;

    component sand = SafeAND();
    sand.a <== a;
    sand.b <== b;
    andOut <== sand.out;

    component sor = SafeOR();
    sor.a <== a;
    sor.b <== b;
    orOut <== sor.out;

    component sm1 = SafeMux1();
    sm1.c[0] <== c1[0];
    sm1.c[1] <== c1[1];
    sm1.s <== s1;
    mux1Out <== sm1.out;

    component sm2 = SafeMux2();
    for (var i = 0; i < 4; i++) {
        sm2.c[i] <== c2[i];
    }
    sm2.s[0] <== s2[0];
    sm2.s[1] <== s2[1];
    mux2Out <== sm2.out;

    component sb2n = SafeBits2Num(8);
    for (var i = 0; i < 8; i++) {
        sb2n.in[i] <== bits[i];
    }
    bits2NumOut <== sb2n.out;
}

component main = SafeWrappersTest();

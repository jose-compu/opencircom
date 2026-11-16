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
    signal input c_mm1[2][2];
    signal input s_mm1;
    signal input c_mm2[2][4];
    signal input s_mm2[2];
    signal output andOut;
    signal output orOut;
    signal output mux1Out;
    signal output mux2Out;
    signal output bits2NumOut;
    signal output xorOut;
    signal output notOut;
    signal output nandOut;
    signal output norOut;
    signal output mm1Out0;
    signal output mm1Out1;
    signal output mm2Out0;
    signal output mm2Out1;

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

    component sxor = SafeXOR();
    sxor.a <== a;
    sxor.b <== b;
    xorOut <== sxor.out;

    component snot = SafeNOT();
    snot.in <== a;
    notOut <== snot.out;

    component snand = SafeNAND();
    snand.a <== a;
    snand.b <== b;
    nandOut <== snand.out;

    component snor = SafeNOR();
    snor.a <== a;
    snor.b <== b;
    norOut <== snor.out;

    component smm1 = SafeMultiMux1(2);
    for (var ch = 0; ch < 2; ch++) {
        smm1.c[ch][0] <== c_mm1[ch][0];
        smm1.c[ch][1] <== c_mm1[ch][1];
    }
    smm1.s <== s_mm1;
    mm1Out0 <== smm1.out[0];
    mm1Out1 <== smm1.out[1];

    component smm2 = SafeMultiMux2(2);
    for (var ch2 = 0; ch2 < 2; ch2++) {
        for (var j = 0; j < 4; j++) {
            smm2.c[ch2][j] <== c_mm2[ch2][j];
        }
    }
    smm2.s[0] <== s_mm2[0];
    smm2.s[1] <== s_mm2[1];
    mm2Out0 <== smm2.out[0];
    mm2Out1 <== smm2.out[1];
}

component main = SafeWrappersTest();
pragma circom 2.0.0;

include "../../circuits/arithmetic.circom";

template FixedPointTestHarness() {
    signal output sum;
    signal output product;
    signal output lt;

    signal input addA;
    signal input addB;
    signal input mulA;
    signal input mulB;
    signal input mulQ;
    signal input mulR;
    signal input mul1A;
    signal input mul1B;
    signal input mul1Q;
    signal input mul1R;
    signal input cmpA;
    signal input cmpB;
    signal input bal;
    signal input next;
    signal input amt;

    component add = FixedPointAdd(32, 6);
    add.a <== addA;
    add.b <== addB;
    sum <== add.sum;

    component mul = FixedPointMul(32, 6);
    mul.a <== mulA;
    mul.b <== mulB;
    mul.q <== mulQ;
    mul.r <== mulR;
    product <== mul.quotient;

    component mul1 = FixedPointMul(32, 1);
    mul1.a <== mul1A;
    mul1.b <== mul1B;
    mul1.q <== mul1Q;
    mul1.r <== mul1R;

    component cmp = FixedPointCompare(32, 6);
    cmp.a <== cmpA;
    cmp.b <== cmpB;
    lt <== cmp.lt;

    component strictBal = StrictNum2Bits(32);
    strictBal.in <== bal;
    component strictNext = StrictNum2Bits(32);
    strictNext.in <== next;
    component strictAmt = StrictNum2Bits(32);
    strictAmt.in <== amt;
    next + amt === bal;
}

component main = FixedPointTestHarness();
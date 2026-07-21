pragma circom 2.0.0;

/**
 * @title MultiMux2
 * @notice 4-to-1 multiplexer for n parallel signals; selector s[2] (2 bits).
 * @dev out[i] = c[i][s[0] + 2*s[1]]. Constraint count O(n).
 * @param n Number of parallel channels.
 * @custom:input c[n][4] Four choices per channel.
 * @custom:input s[2] Selector bits (0..3).
 * @custom:output out[n] Selected value per channel.
 */
template MultiMux2(n) {
    signal input c[n][4];
    signal input s[2];
    signal output out[n];
    signal a10[n];
    signal a1[n];
    signal a0[n];
    signal a[n];
    signal s10;
    s10 <== s[1] * s[0];
    for (var i = 0; i < n; i++) {
        a10[i] <== (c[i][3] - c[i][2] - c[i][1] + c[i][0]) * s10;
        a1[i] <== (c[i][2] - c[i][0]) * s[1];
        a0[i] <== (c[i][1] - c[i][0]) * s[0];
        a[i] <== c[i][0];
        out[i] <== a10[i] + a1[i] + a0[i] + a[i];
    }
}

/**
 * @title Mux2
 * @notice Single 4-to-1 multiplexer: out = c[s[0] + 2*s[1]].
 * @dev Building-block-only: does not binary-constrain s[0], s[1]. Prefer SafeMux2 for untrusted selectors.
 * @custom:input c[4] Four choices.
 * @custom:input s[2] Selector bits (must be 0/1; not enforced here).
 * @custom:output out Selected value.
 * @custom:security Prefer SafeMux2() when s may be untrusted.
 */
template Mux2() {
    signal input c[4];
    signal input s[2];
    signal output out;
    component mux = MultiMux2(1);
    for (var i = 0; i < 4; i++) {
        mux.c[0][i] <== c[i];
    }
    for (var i = 0; i < 2; i++) {
        s[i] ==> mux.s[i];
    }
    mux.out[0] ==> out;
}

/**
 * @title SafeMux2
 * @notice 4-to-1 multiplexer with binary-constrained selector bits.
 * @dev Wraps Mux2 with s[i]*(s[i]-1)===0 for i in {0,1}. Prefer over Mux2 for untrusted selectors.
 * @custom:input c[4] Four choices.
 * @custom:input s[2] Selector bits (each constrained to 0 or 1).
 * @custom:output out Selected value.
 * @custom:complexity Mux2 cost + 2 binary constraints.
 * @custom:security Selector bits are binary-constrained in-circuit.
 */
template SafeMux2() {
    signal input c[4];
    signal input s[2];
    signal output out;
    s[0] * (s[0] - 1) === 0;
    s[1] * (s[1] - 1) === 0;
    component mux = Mux2();
    for (var i = 0; i < 4; i++) {
        mux.c[i] <== c[i];
    }
    mux.s[0] <== s[0];
    mux.s[1] <== s[1];
    out <== mux.out;
}

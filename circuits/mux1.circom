pragma circom 2.0.0;

/**
 * @title MultiMux1
 * @notice 2-to-1 multiplexer for n parallel signals: out[i] = c[i][1] if s else c[i][0].
 * @dev out[i] = (c[i][1] - c[i][0])*s + c[i][0]. One constraint per output.
 * @param n Number of parallel channels.
 * @custom:input c[n][2] For each channel, two choices c[i][0], c[i][1].
 * @custom:input s Selector (0 or 1).
 * @custom:output out[n] Selected value per channel.
 */
template MultiMux1(n) {
    signal input c[n][2];
    signal input s;
    signal output out[n];
    for (var i = 0; i < n; i++) {
        out[i] <== (c[i][1] - c[i][0]) * s + c[i][0];
    }
}

/**
 * @title Mux1
 * @notice Single 2-to-1 multiplexer: out = c[1] if s else c[0].
 * @dev Building-block-only: does not binary-constrain s. Prefer SafeMux1 for untrusted selectors.
 * @custom:input c[2] Two choices c[0], c[1].
 * @custom:input s Selector (0 or 1; not enforced here).
 * @custom:output out Selected value.
 * @custom:security Prefer SafeMux1() when s may be untrusted.
 */
template Mux1() {
    signal input c[2];
    signal input s;
    signal output out;
    component mux = MultiMux1(1);
    for (var i = 0; i < 2; i++) {
        mux.c[0][i] <== c[i];
    }
    s ==> mux.s;
    mux.out[0] ==> out;
}

/**
 * @title SafeMux1
 * @notice 2-to-1 multiplexer with binary-constrained selector.
 * @dev Wraps Mux1 with s*(s-1)===0. Prefer over Mux1 for untrusted selectors.
 * @custom:input c[2] Two choices c[0], c[1].
 * @custom:input s Selector (constrained to 0 or 1).
 * @custom:output out Selected value.
 * @custom:complexity Mux1 cost + 1 binary constraint.
 * @custom:security Selector is binary-constrained in-circuit.
 */
template SafeMux1() {
    signal input c[2];
    signal input s;
    signal output out;
    s * (s - 1) === 0;
    component mux = Mux1();
    mux.c[0] <== c[0];
    mux.c[1] <== c[1];
    mux.s <== s;
    out <== mux.out;
}

pragma circom 2.0.0;

/**
 * @title Num2Bits
 * @notice Decomposes a field element into n bits (out[0] = LSB).
 * @dev Enforces in === sum(out[i]*2^i) and each out[i] in {0,1}. Use n small enough for the field modulus.
 * @param n Number of bits.
 * @custom:input in Field element to decompose.
 * @custom:output out[n] Bits (out[0] = 2^0 coefficient).
 * @custom:complexity O(n): n binary constraints + 1 linear combo. No upper bound on in; use StrictNum2Bits when in must be in [0,2^n-1].
 * @custom:security If in >= 2^n, decomposition is mod field; can break range assumptions. Use StrictNum2Bits for untrusted inputs.
 */
template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1 = 0;
    var e2 = 1;
    for (var i = 0; i < n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc1 += out[i] * e2;
        e2 = e2 + e2;
    }
    lc1 === in;
}

/**
 * @title Bits2Num
 * @notice Recomposes n bits into a single field element.
 * @dev Building-block-only: no binary check on in[i]. Prefer SafeBits2Num when bits may be untrusted.
 * @param n Number of bits.
 * @custom:input in[n] Bits (in[0] = LSB; not binary-enforced here).
 * @custom:output out Field element.
 * @custom:security Prefer SafeBits2Num(n) when in[i] may be untrusted.
 */
template Bits2Num(n) {
    signal input in[n];
    signal output out;
    var lc1 = 0;
    var e2 = 1;
    for (var i = 0; i < n; i++) {
        lc1 += in[i] * e2;
        e2 = e2 + e2;
    }
    lc1 ==> out;
}

/**
 * @title SafeBits2Num
 * @notice Recomposes n bits into a field element with each bit binary-constrained.
 * @dev Wraps Bits2Num(n) and enforces in[i]*(in[i]-1)===0 for all i. Prefer over Bits2Num for untrusted bit arrays.
 * @param n Number of bits.
 * @custom:input in[n] Bits (in[0] = LSB; each constrained to 0 or 1).
 * @custom:output out Field element.
 * @custom:complexity O(n): n binary constraints + Bits2Num.
 * @custom:security Bit inputs are binary-constrained in-circuit.
 */
template SafeBits2Num(n) {
    signal input in[n];
    signal output out;
    for (var i = 0; i < n; i++) {
        in[i] * (in[i] - 1) === 0;
    }
    component b2n = Bits2Num(n);
    for (var i = 0; i < n; i++) {
        b2n.in[i] <== in[i];
    }
    out <== b2n.out;
}

/**
 * @title Num2BitsNeg
 * @notice Bit decomposition of the negation (2^n - in) for n-bit in, or zero if in == 0.
 * @dev Used in some range-check patterns. in can be 0; then output is (2^n - 0) in n bits.
 * @param n Number of bits.
 * @custom:input in Field element.
 * @custom:output out[n] Bits of (2^n - in) mod 2^n, or zero when in == 0.
 */
template Num2BitsNeg(n) {
    signal input in;
    signal output out[n];
    var lc1 = 0;
    component isZero = IsZero();
    var neg = n == 0 ? 0 : (1 << n) - in;
    for (var i = 0; i < n; i++) {
        out[i] <-- (neg >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc1 += out[i] * (1 << i);
    }
    in ==> isZero.in;
    lc1 + isZero.out * (1 << n) === (1 << n) - in;
}

/**
 * @title IsZero
 * @notice Returns 1 if in == 0, else 0.
 * @dev Uses inverse: out = 1 - in * inv with in * out === 0. No range assumption on in.
 * @custom:input in Field element.
 * @custom:output out 1 if in == 0, 0 otherwise.
 * @custom:complexity 2 constraints (inverse + product). Constant cost.
 * @custom:security Uses non-deterministic inverse; safe in R1CS. Do not use to compare against a secret without care (timing/aux inputs).
 */
template IsZero() {
    signal input in;
    signal output out;
    signal inv;
    inv <-- in != 0 ? 1 / in : 0;
    out <== -in * inv + 1;
    in * out === 0;
}

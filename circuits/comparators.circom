pragma circom 2.0.0;

include "bitify.circom";

/**
 * @title LessThan
 * @notice Returns 1 if in[0] < in[1], else 0.
 * @dev Both inputs must be in [0, 2^n). Uses (2^n + in[0] - in[1]) bit decomposition.
 * @param n Bit width (<= 252).
 * @custom:input in[2] Two values to compare.
 * @custom:output out 1 if in[0] < in[1], 0 otherwise.
 * @custom:complexity Num2Bits(n+1): O(n) constraints. Both inputs must be < 2^n or result is undefined.
 * @custom:security Enforce input bounds externally (e.g. StrictNum2Bits) when inputs are untrusted.
 */
template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    component n2b = Num2Bits(n + 1);
    n2b.in <== in[0] + (1 << n) - in[1];
    out <== 1 - n2b.out[n];
}

/**
 * @title LessEqThan
 * @notice Returns 1 if in[0] <= in[1], else 0.
 * @dev Implemented as LessThan(in[0], in[1] + 1).
 * @param n Bit width.
 * @custom:input in[2] Two values to compare.
 * @custom:output out 1 if in[0] <= in[1], 0 otherwise.
 */
template LessEqThan(n) {
    signal input in[2];
    signal output out;
    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1] + 1;
    lt.out ==> out;
}

/**
 * @title GreaterThan
 * @notice Returns 1 if in[0] > in[1], else 0.
 * @dev Implemented as LessThan(in[1], in[0]).
 * @param n Bit width.
 * @custom:input in[2] Two values to compare.
 * @custom:output out 1 if in[0] > in[1], 0 otherwise.
 */
template GreaterThan(n) {
    signal input in[2];
    signal output out;
    component lt = LessThan(n);
    lt.in[0] <== in[1];
    lt.in[1] <== in[0];
    lt.out ==> out;
}

/**
 * @title GreaterEqThan
 * @notice Returns 1 if in[0] >= in[1], else 0.
 * @dev Implemented as LessThan(in[1], in[0] + 1).
 * @param n Bit width.
 * @custom:input in[2] Two values to compare.
 * @custom:output out 1 if in[0] >= in[1], 0 otherwise.
 */
template GreaterEqThan(n) {
    signal input in[2];
    signal output out;
    component lt = LessThan(n);
    lt.in[0] <== in[1];
    lt.in[1] <== in[0] + 1;
    lt.out ==> out;
}

/**
 * @title IsEqual
 * @notice Returns 1 if in[0] == in[1], else 0.
 * @dev Uses IsZero(in[1] - in[0]).
 * @custom:input in[2] Two values to compare.
 * @custom:output out 1 if equal, 0 otherwise.
 */
template IsEqual() {
    signal input in[2];
    signal output out;
    component isz = IsZero();
    in[1] - in[0] ==> isz.in;
    isz.out ==> out;
}

/**
 * @title ForceEqualIfEnabled
 * @notice If enabled is 1, constrains in[0] == in[1]; if 0, no constraint.
 * @dev enabled constrained binary; (1 - IsZero(in[1]-in[0])) * enabled === 0.
 * @custom:input enabled 0 or 1 (binary-constrained) to enable the equality check.
 * @custom:input in[2] Two values; must be equal when enabled.
 */
template ForceEqualIfEnabled() {
    signal input enabled;
    signal input in[2];
    enabled * (enabled - 1) === 0;
    component isz = IsZero();
    in[1] - in[0] ==> isz.in;
    (1 - isz.out) * enabled === 0;
}

/**
 * @title AssertNotEqual
 * @notice Constrains in[0] !== in[1] (aliasing-safe: two signals must differ).
 * @dev Fails at constraint check if in[0] == in[1]. Use to prevent equal values where distinctness is required.
 * @custom:input in[2] Two values that must not be equal.
 * @custom:complexity 1 IsZero + 1 constraint; very cheap.
 * @custom:security Use to prevent aliasing (e.g. path elements in Merkle). Fails if in[0]==in[1].
 */
template AssertNotEqual() {
    signal input in[2];
    component eq = IsEqual();
    eq.in[0] <== in[0];
    eq.in[1] <== in[1];
    eq.out === 0;
}

/**
 * @title StrictNum2Bits
 * @notice Bit decomposition with strict range: in must be in [0, 2^n - 1].
 * @dev Same as Num2Bits(n) plus constraint in < 2^n so the value is a true n-bit non-negative integer (no field overflow).
 * @param n Number of bits (<= 251).
 * @custom:input in Field element to decompose.
 * @custom:output out[n] Bits (out[0] LSB).
 * @custom:complexity Num2Bits(n) + LessThan(n+1): O(n). ~17 constraints for n=8.
 * @custom:security Ensures in is a true n-bit integer; use before range-sensitive operations.
 */
template StrictNum2Bits(n) {
    assert(n <= 251);
    signal input in;
    signal output out[n];
    component n2b = Num2Bits(n);
    n2b.in <== in;
    for (var i = 0; i < n; i++) {
        out[i] <== n2b.out[i];
    }
    component lt = LessThan(n + 1);
    lt.in[0] <== in;
    lt.in[1] <== (1 << n);
    lt.out === 1;
}

/**
 * @title RangeProof
 * @notice Proves that x is in the range [a, b] (inclusive), all n-bit.
 * @dev Constrains (x - a) and (b - x) to be n-bit and x - a <= b - a. Use n large enough so 2^n > b - a.
 * @param n Bit width for range (<= 251).
 * @custom:input x Value to prove in range.
 * @custom:input a Lower bound (inclusive).
 * @custom:input b Upper bound (inclusive).
 * @custom:output out 1 (convenience).
 * @custom:complexity 2 StrictNum2Bits(n) + LessEqThan(n): O(n). Use n large enough that 2^n > b - a.
 * @custom:security All of x, a, b can be private; ensure n is chosen so the range is correct (no overflow).
 */
template RangeProof(n) {
    assert(n <= 251);
    signal input x;
    signal input a;
    signal input b;
    signal output out;  // 1 (always) for convenience
    component strictLo = StrictNum2Bits(n);
    component strictHi = StrictNum2Bits(n);
    component leq = LessEqThan(n);
    strictLo.in <== x - a;
    strictHi.in <== b - x;
    leq.in[0] <== x - a;
    leq.in[1] <== b - a;
    leq.out === 1;
    out <== 1;
}

/**
 * @title AgeThresholdProof
 * @notice Proves currentYear - birthYear >= minAge without revealing birthYear.
 * @dev Uses StrictNum2Bits to enforce year ranges; GreaterEqThan for age comparison.
 *      The intermediate signal `age` is also StrictNum2Bits-checked, which catches
 *      underflow when birthYear > currentYear. minAge is not range-checked (typically
 *      a small public constant like 18 or 21).
 * @param n Bit width for years (must be ≤ 251 and ≥ ceil(log2(currentYear+1))).
 *          Use n=32 for years up to ~2106.
 * @custom:input birthYear Private birth year.
 * @custom:input currentYear Current year (public when sourced from chain timestamp or oracle).
 * @custom:input minAge Minimum age threshold (public, e.g. 18).
 * @custom:output valid 1 if currentYear - birthYear >= minAge, else 0.
 * @custom:complexity 3×StrictNum2Bits(n) + 1×GreaterEqThan(n): ~3n + n + 2 constraints ≡ O(n).
 * @custom:security If currentYear is prover-supplied (private), the prover can forge a valid
 *                  proof for any birthYear. Always source currentYear from a trusted context
 *                  (e.g. block.timestamp in a smart contract). See SECURITY.md for details.
 */
template AgeThresholdProof(n) {
    assert(n <= 251);
    signal input birthYear;
    signal input currentYear;
    signal input minAge;
    signal output valid;

    component snbBirth = StrictNum2Bits(n);
    snbBirth.in <== birthYear;

    component snbCurrent = StrictNum2Bits(n);
    snbCurrent.in <== currentYear;

    signal age;
    age <== currentYear - birthYear;

    component snbAge = StrictNum2Bits(n);
    snbAge.in <== age;

    component snbMinAge = StrictNum2Bits(n);
    snbMinAge.in <== minAge;

    component geq = GreaterEqThan(n);
    geq.in[0] <== age;
    geq.in[1] <== minAge;
    valid <== geq.out;
}

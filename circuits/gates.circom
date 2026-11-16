pragma circom 2.0.0;

/**
 * @title XOR
 * @notice Boolean XOR: out = 1 iff exactly one of a, b is 1.
 * @dev Building-block-only: does not binary-constrain a, b. Prefer SafeXOR for untrusted inputs.
 * @custom:input a First bit (must be 0 or 1; not enforced here).
 * @custom:input b Second bit (must be 0 or 1; not enforced here).
 * @custom:output out a XOR b.
 * @custom:complexity 1 constraint.
 * @custom:security Prefer SafeXOR() when a, b may be untrusted.
 */
template XOR() {
    signal input a;
    signal input b;
    signal output out;
    out <== a + b - 2 * a * b;
}

/**
 * @title AND
 * @notice Boolean AND: out = a * b.
 * @dev Building-block-only: does not binary-constrain a, b. Prefer SafeAND for untrusted inputs.
 * @custom:input a First bit (must be 0 or 1; not enforced here).
 * @custom:input b Second bit (must be 0 or 1; not enforced here).
 * @custom:output out a AND b.
 * @custom:security Prefer SafeAND() when a, b may be untrusted.
 */
template AND() {
    signal input a;
    signal input b;
    signal output out;
    out <== a * b;
}

/**
 * @title SafeAND
 * @notice Boolean AND with binary-constrained inputs: out = a * b, a,b ∈ {0,1}.
 * @dev Wraps AND with a*(a-1)===0 and b*(b-1)===0. Prefer over AND for untrusted selectors/bits.
 * @custom:input a First bit (constrained to 0 or 1).
 * @custom:input b Second bit (constrained to 0 or 1).
 * @custom:output out a AND b.
 * @custom:complexity 3 constraints (2 binary + 1 AND).
 * @custom:security Inputs are binary-constrained in-circuit.
 */
template SafeAND() {
    signal input a;
    signal input b;
    signal output out;
    a * (a - 1) === 0;
    b * (b - 1) === 0;
    component g = AND();
    g.a <== a;
    g.b <== b;
    out <== g.out;
}

/**
 * @title SafeXOR
 * @notice Boolean XOR with binary-constrained inputs.
 * @dev Wraps XOR with a*(a-1)===0 and b*(b-1)===0. Prefer over XOR for untrusted selectors/bits.
 * @custom:input a First bit (constrained to 0 or 1).
 * @custom:input b Second bit (constrained to 0 or 1).
 * @custom:output out a XOR b.
 * @custom:complexity 3 constraints (2 binary + 1 XOR).
 * @custom:security Inputs are binary-constrained in-circuit.
 */
template SafeXOR() {
    signal input a;
    signal input b;
    signal output out;
    a * (a - 1) === 0;
    b * (b - 1) === 0;
    component g = XOR();
    g.a <== a;
    g.b <== b;
    out <== g.out;
}

/**
 * @title OR
 * @notice Boolean OR: out = 1 iff at least one of a, b is 1.
 * @dev Building-block-only: does not binary-constrain a, b. Prefer SafeOR for untrusted inputs.
 * @custom:input a First bit (must be 0 or 1; not enforced here).
 * @custom:input b Second bit (must be 0 or 1; not enforced here).
 * @custom:output out a OR b.
 * @custom:security Prefer SafeOR() when a, b may be untrusted.
 */
template OR() {
    signal input a;
    signal input b;
    signal output out;
    out <== a + b - a * b;
}

/**
 * @title SafeOR
 * @notice Boolean OR with binary-constrained inputs.
 * @dev Wraps OR with a*(a-1)===0 and b*(b-1)===0. Prefer over OR for untrusted selectors/bits.
 * @custom:input a First bit (constrained to 0 or 1).
 * @custom:input b Second bit (constrained to 0 or 1).
 * @custom:output out a OR b.
 * @custom:complexity 3 constraints (2 binary + 1 OR).
 * @custom:security Inputs are binary-constrained in-circuit.
 */
template SafeOR() {
    signal input a;
    signal input b;
    signal output out;
    a * (a - 1) === 0;
    b * (b - 1) === 0;
    component g = OR();
    g.a <== a;
    g.b <== b;
    out <== g.out;
}

/**
 * @title NOT
 * @notice Boolean NOT: out = 1 - in.
 * @dev Building-block-only: does not binary-constrain in. Prefer SafeNOT for untrusted inputs.
 * @custom:input in Input bit (must be 0 or 1; not enforced here).
 * @custom:output out 1 if in == 0, 0 if in == 1.
 * @custom:security Prefer SafeNOT() when in may be untrusted.
 */
template NOT() {
    signal input in;
    signal output out;
    out <== 1 + in - 2 * in;
}

/**
 * @title SafeNOT
 * @notice Boolean NOT with binary-constrained input.
 * @dev Wraps NOT with in*(in-1)===0. Prefer over NOT for untrusted bits.
 * @custom:input in Input bit (constrained to 0 or 1).
 * @custom:output out 1 if in == 0, 0 if in == 1.
 * @custom:complexity 2 constraints (1 binary + 1 NOT).
 * @custom:security Input is binary-constrained in-circuit.
 */
template SafeNOT() {
    signal input in;
    signal output out;
    in * (in - 1) === 0;
    component g = NOT();
    g.in <== in;
    out <== g.out;
}

/**
 * @title NAND
 * @notice Boolean NAND: out = 1 - a*b.
 * @dev Building-block-only: does not binary-constrain a, b. Prefer SafeNAND for untrusted inputs.
 * @custom:input a First bit (must be 0 or 1; not enforced here).
 * @custom:input b Second bit (must be 0 or 1; not enforced here).
 * @custom:output out NOT(a AND b).
 * @custom:security Prefer SafeNAND() when a, b may be untrusted.
 */
template NAND() {
    signal input a;
    signal input b;
    signal output out;
    out <== 1 - a * b;
}

/**
 * @title SafeNAND
 * @notice Boolean NAND with binary-constrained inputs.
 * @dev Wraps NAND with a*(a-1)===0 and b*(b-1)===0. Prefer over NAND for untrusted bits.
 * @custom:input a First bit (constrained to 0 or 1).
 * @custom:input b Second bit (constrained to 0 or 1).
 * @custom:output out NOT(a AND b).
 * @custom:complexity 3 constraints (2 binary + 1 NAND).
 * @custom:security Inputs are binary-constrained in-circuit.
 */
template SafeNAND() {
    signal input a;
    signal input b;
    signal output out;
    a * (a - 1) === 0;
    b * (b - 1) === 0;
    component g = NAND();
    g.a <== a;
    g.b <== b;
    out <== g.out;
}

/**
 * @title NOR
 * @notice Boolean NOR: out = 1 iff both a and b are 0.
 * @dev Building-block-only: does not binary-constrain a, b. Prefer SafeNOR for untrusted inputs.
 * @custom:input a First bit (must be 0 or 1; not enforced here).
 * @custom:input b Second bit (must be 0 or 1; not enforced here).
 * @custom:output out NOT(a OR b).
 * @custom:security Prefer SafeNOR() when a, b may be untrusted.
 */
template NOR() {
    signal input a;
    signal input b;
    signal output out;
    out <== a * b + 1 - a - b;
}

/**
 * @title SafeNOR
 * @notice Boolean NOR with binary-constrained inputs.
 * @dev Wraps NOR with a*(a-1)===0 and b*(b-1)===0. Prefer over NOR for untrusted bits.
 * @custom:input a First bit (constrained to 0 or 1).
 * @custom:input b Second bit (constrained to 0 or 1).
 * @custom:output out NOT(a OR b).
 * @custom:complexity 3 constraints (2 binary + 1 NOR).
 * @custom:security Inputs are binary-constrained in-circuit.
 */
template SafeNOR() {
    signal input a;
    signal input b;
    signal output out;
    a * (a - 1) === 0;
    b * (b - 1) === 0;
    component g = NOR();
    g.a <== a;
    g.b <== b;
    out <== g.out;
}

/**
 * @title MultiAND
 * @notice N-way AND: out = 1 iff all in[i] are 1.
 * @dev Recursive structure; constraint count O(n). Inputs must be 0 or 1.
 * @param n Number of inputs.
 * @custom:input in[n] Input bits.
 * @custom:output out 1 iff all in[i] == 1.
 * @custom:complexity O(n) constraints (recursive AND tree). Inputs must be binary.
 * @custom:security None; combine with IsEqual/OneOfN for set checks.
 */
template MultiAND(n) {
    signal input in[n];
    signal output out;
    component and1;
    component and2;
    component ands[2];
    if (n == 1) {
        out <== in[0];
    } else if (n == 2) {
        and1 = AND();
        and1.a <== in[0];
        and1.b <== in[1];
        out <== and1.out;
    } else {
        and2 = AND();
        var n1 = n \ 2;
        var n2 = n - n \ 2;
        ands[0] = MultiAND(n1);
        ands[1] = MultiAND(n2);
        for (var i = 0; i < n1; i++) ands[0].in[i] <== in[i];
        for (var i = 0; i < n2; i++) ands[1].in[i] <== in[n1 + i];
        and2.a <== ands[0].out;
        and2.b <== ands[1].out;
        out <== and2.out;
    }
}

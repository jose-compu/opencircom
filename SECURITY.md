# Security considerations for opencircom circuits

## General

- **No circomlib dependency**: This library is self-contained. Same algorithms (e.g. Poseidon) use the same constants as the public spec; verify hashing test vectors if you need cross-project compatibility.
- **Constraint system**: All templates are written to produce valid R1CS; use trusted setup and verification keys.

## Pre-deployment checklist

Wiring and configuration errors cause more production failures than broken hash functions. Work through this list before a trusted setup.

### Before trusted setup

- [ ] All untrusted inputs use `StrictNum2Bits` or `RangeProof`
- [ ] Comparator `n` is at least the bit width of the maximum input value
- [ ] Selectors (`sel`, `condition`, `enabled`) are binary-constrained (`Safe*` or an explicit `x*(x-1)===0`)
- [ ] Merkle roots committed on-chain match the circuit public inputs
- [ ] Each nullifier uses a unique `externalNullifier` per action or domain
- [ ] No secret signals are marked public
- [ ] Poseidon width is consistent across prover, verifier, and any off-chain tree
- [ ] Run `opencircom audit` in CI when that command is available (`#2`)

### Known building blocks that require wrappers

Raw `AND`, `OR`, `XOR`, `NOT`, `NAND`, `NOR`, `Mux1`, `Mux2`, `MultiMux1`, `MultiMux2`, and `Bits2Num` do **not** binary-constrain inputs (0.5.0 audit). Prefer `SafeAND`, `SafeOR`, `SafeXOR`, `SafeNOT`, `SafeNAND`, `SafeNOR`, `SafeMux1`, `SafeMux2`, `SafeMultiMux1(n)`, `SafeMultiMux2(n)`, `SafeBits2Num`.

### References

- Underconstrained-circuit incidents (ZK Hack writeups)
- opencircom CHANGELOG 0.5.0, 0.8.0, 0.8.1

## Per-component notes

### Comparators (`LessThan`, `GreaterThan`, `AgeThresholdProof`, etc.)

- Parameter `n`: inputs must be in range `[0, 2^n - 1]`. Use `n` large enough (e.g. 64 or 253) for your application.
- `IsZero` uses a witness for the inverse; ensure your backend produces valid proofs.
- `AgeThresholdProof(n)` only checks `currentYear - birthYear >= minAge`. Treat `currentYear` and `minAge` as a **trust-model** input (public signal or authenticated oracle). The circuit does not prove that the year is wall-clock time. A future `birthYear` is rejected; an under-age witness yields `valid=0`.

### Bitify (`Num2Bits`, `Bits2Num`, `SafeBits2Num`)

- `Num2Bits(n)` proves `in` equals the sum of bits; use `n` such that `in < 2^n` in your field.
- `Bits2Num(n)` does **not** binary-constrain `in[i]` (building block). Prefer `SafeBits2Num(n)` when bit arrays may be untrusted.
- For full field range (254-bit) use `AliasCheck` with `Num2Bits(254)` outputs.

### Gates & mux (`AND`, `OR`, `Mux1`, `Mux2`, `MultiMux1`, `MultiMux2` and Safe*)

- Raw gates and mux templates assume binary inputs/selectors by design and do **not** enforce them (documented in the 0.5.0 audit). `MultiMux1`/`MultiMux2` data inputs remain unconstrained field elements even on Safe* variants.
- Prefer `SafeAND()`, `SafeOR()`, `SafeXOR()`, `SafeNOT()`, `SafeNAND()`, `SafeNOR()`, `SafeMux1()`, `SafeMux2()`, `SafeMultiMux1(n)`, `SafeMultiMux2(n)` for untrusted bits or selectors; each adds `x*(x-1)===0` constraints on bits/selectors before the underlying building block.

### Poseidon / MiMC

- Poseidon constants are from the Hades design (see `poseidon_constants.circom`). Do not modify without re-deriving security.
- MiMC round constants are fixed for the BN254 scalar field.

### Merkle (`MerkleInclusionProof`)

- `pathIndices` are enforced binary in-circuit.
- Tree root must be committed on-chain or in a contract; verify root in the contract.

### Nullifier

- `Nullifier(secret, externalNullifier)` is for one-time use per (`secret`, externalNullifier). Use a unique `externalNullifier` per action (e.g. poll id, withdrawal nonce).
- `externalNullifier` and `ballotId` are Poseidon inputs (field elements). Distinct Fr values already hash distinctly; a bit-width bound does not add uniqueness.

### Voting (`VoteCommit`, `VoteReveal`)

- `VoteCommit(numChoices)` alias-checks `choice` with `StrictNum2Bits(32)` before `LessThan(32)`. Do not compare untrusted values with `LessThan(n)` alone (wraparound over Fr can satisfy `out === 1` for `choice >= 2^n`).
- `VoteReveal` binds `choice` via `Poseidon(choice, identity, salt, ballotId) === commitment`. Enforce the ballot range at commit (or in the contract). `ballotId` uniqueness is an application-layer requirement.

### MACI building blocks

- **Off-circuit coordinator**: Baby JubJub ECDH shared key, EdDSA sign `h_cm`, full MACI DuplexSponge encryption, message batch processing, and state/ballot tree updates remain application-layer ([MACI v1 spec](https://maci.pse.dev/docs/v1.2/spec)).
- **In-circuit encryption** uses additive Poseidon keystream, not MACI DuplexSponge; interoperable command packing and `h_cm` match MACI v1.
- **`MACIVoteDecryptVerify`**: enforce `minValidNonce` from ballot state (in-circuit: `StrictNum2Bits(50)` then `GreaterEqThan(50)`); reject votes outside `allowedVoteOptions`; bind `expectedPollId`.
- Ciphertext limbs are field elements from additive Poseidon keystream; they are not n-bit integers and must not be range-clipped.
- **Nonce monotonicity**: MACI applies messages in reverse order; coordinator must track ballot nonces correctly.

## Audits

This library has not undergone a formal audit. Use in production at your own risk. Prefer additional review for high-value applications.

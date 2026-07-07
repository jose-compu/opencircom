# Security considerations for opencircom circuits

## General

- **No circomlib dependency**: This library is self-contained. Same algorithms (e.g. Poseidon) use the same constants as the public spec; verify hashing test vectors if you need cross-project compatibility.
- **Constraint system**: All templates are written to produce valid R1CS; use trusted setup and verification keys.

## Per-component notes

### Comparators (`LessThan`, `GreaterThan`, etc.)

- Parameter `n`: inputs must be in range `[0, 2^n - 1]`. Use `n` large enough (e.g. 64 or 253) for your application.
- `IsZero` uses a witness for the inverse; ensure your backend produces valid proofs.

### Bitify (`Num2Bits`, `Bits2Num`)

- `Num2Bits(n)` proves `in` equals the sum of bits; use `n` such that `in < 2^n` in your field.
- For full field range (254-bit) use `AliasCheck` with `Num2Bits(254)` outputs.

### Poseidon / MiMC

- Poseidon constants are from the Hades design (see `poseidon_constants.circom`). Do not modify without re-deriving security.
- MiMC round constants are fixed for the BN254 scalar field.

### Merkle (`MerkleInclusionProof`)

- `pathIndices` are enforced binary in-circuit.
- Tree root must be committed on-chain or in a contract; verify root in the contract.

### Nullifier

- `Nullifier(secret, externalNullifier)` is for one-time use per (`secret`, externalNullifier). Use a unique `externalNullifier` per action (e.g. poll id, withdrawal nonce).

### AgeThresholdProof

- **currentYear trust**: `currentYear` must come from a trusted source (e.g. `block.timestamp` in a smart contract, or a verified oracle). If `currentYear` is prover-supplied (private signal), the prover can forge a valid proof for any `birthYear` — age verification becomes meaningless.
- **minAge**: This signal is intentionally not range-checked (typically a small public constant like 18 or 21). A large `minAge > 2^n` causes the circuit to always output 0, which is a safe failure.
- **Underflow protection**: `birthYear > currentYear` produces a field-underflow caught by `StrictNum2Bits` on the intermediate `age` signal. The prover cannot exploit this to produce a false positive.
- **Bit width**: Choose `n` large enough for your application's year range (e.g. `n=32` covers years up to ~2106). Too small an `n` truncates years and may produce false positives.

### MACI building blocks

- **Off-circuit coordinator**: Baby JubJub ECDH shared key, EdDSA sign `h_cm`, full MACI DuplexSponge encryption, message batch processing, and state/ballot tree updates remain application-layer ([MACI v1 spec](https://maci.pse.dev/docs/v1.2/spec)).
- **In-circuit encryption** uses additive Poseidon keystream, not MACI DuplexSponge; interoperable command packing and `h_cm` match MACI v1.
- **`MACIVoteDecryptVerify`**: enforce `minValidNonce` from ballot state; reject votes outside `allowedVoteOptions`; bind `expectedPollId`.
- **Nonce monotonicity**: MACI applies messages in reverse order; coordinator must track ballot nonces correctly.

## Audits

This library has not undergone a formal audit. Use in production at your own risk. Prefer additional review for high-value applications.

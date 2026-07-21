# Security considerations for opencircom circuits

## General

- **No circomlib dependency**: This library is self-contained. Same algorithms (e.g. Poseidon) use the same constants as the public spec; verify hashing test vectors if you need cross-project compatibility.
- **Constraint system**: All templates are written to produce valid R1CS; use trusted setup and verification keys.

## Per-component notes

### Comparators (`LessThan`, `GreaterThan`, etc.)

- Parameter `n`: inputs must be in range `[0, 2^n - 1]`. Use `n` large enough (e.g. 64 or 253) for your application.
- `IsZero` uses a witness for the inverse; ensure your backend produces valid proofs.

### Bitify (`Num2Bits`, `Bits2Num`, `SafeBits2Num`)

- `Num2Bits(n)` proves `in` equals the sum of bits; use `n` such that `in < 2^n` in your field.
- `Bits2Num(n)` does **not** binary-constrain `in[i]` (building block). Prefer `SafeBits2Num(n)` when bit arrays may be untrusted.
- For full field range (254-bit) use `AliasCheck` with `Num2Bits(254)` outputs.

### Gates & mux (`AND`, `OR`, `Mux1`, `Mux2` and Safe*)

- Raw `AND`, `OR`, `Mux1`, `Mux2` assume binary inputs/selectors by design and do **not** enforce them (documented in the 0.5.0 audit).
- Prefer `SafeAND()`, `SafeOR()`, `SafeMux1()`, `SafeMux2()` for untrusted bits or selectors; each adds `x*(x-1)===0` constraints before the underlying building block.

### Poseidon / MiMC

- Poseidon constants are from the Hades design (see `poseidon_constants.circom`). Do not modify without re-deriving security.
- MiMC round constants are fixed for the BN254 scalar field.

### Merkle (`MerkleInclusionProof`)

- `pathIndices` are enforced binary in-circuit.
- Tree root must be committed on-chain or in a contract; verify root in the contract.

### Nullifier

- `Nullifier(secret, externalNullifier)` is for one-time use per (`secret`, externalNullifier). Use a unique `externalNullifier` per action (e.g. poll id, withdrawal nonce).

### MACI building blocks

- **Off-circuit coordinator**: Baby JubJub ECDH shared key, EdDSA sign `h_cm`, full MACI DuplexSponge encryption, message batch processing, and state/ballot tree updates remain application-layer ([MACI v1 spec](https://maci.pse.dev/docs/v1.2/spec)).
- **In-circuit encryption** uses additive Poseidon keystream, not MACI DuplexSponge; interoperable command packing and `h_cm` match MACI v1.
- **`MACIVoteDecryptVerify`**: enforce `minValidNonce` from ballot state; reject votes outside `allowedVoteOptions`; bind `expectedPollId`.
- **Nonce monotonicity**: MACI applies messages in reverse order; coordinator must track ballot nonces correctly.

## Audits

This library has not undergone a formal audit. Use in production at your own risk. Prefer additional review for high-value applications.

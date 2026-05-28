# Pre-Deployment Security Checklist

Use this checklist before a trusted setup, verifier deployment, or production release that depends on opencircom templates. Many ZK circuit incidents come from configuration, wiring, or public-signal mistakes rather than broken primitives.

## Before Trusted Setup

- [ ] All untrusted numeric inputs are range constrained with `StrictNum2Bits(n)` or `RangeProof(n)`.
- [ ] Comparator parameters use an `n` value that covers the maximum possible input bit width.
- [ ] Selector-like signals such as `sel`, `condition`, and `enabled` are constrained to `{0,1}`.
- [ ] Merkle roots committed on-chain match the circuit public inputs and verifier expectations.
- [ ] Nullifiers use a unique `externalNullifier` for each action, poll, domain, or withdrawal flow.
- [ ] Secret or private witness signals are not accidentally exposed as public inputs.
- [ ] Poseidon width and input ordering are consistent across the prover, verifier, and any off-chain tree or hashing code.
- [ ] The same circuit source and include paths are used for compilation, witness generation, trusted setup, and verifier generation.
- [ ] Generated verifier contracts are reviewed before deployment, especially public input ordering.
- [ ] `opencircom audit` is run in CI when available.

## Building Blocks That Need Application-Level Wrappers

Some low-level templates are intentionally reusable primitives and should be wrapped with application-specific constraints:

- `Gates`, `Mux1`, `Mux2`, and `MuxN`: ensure selector inputs are binary-constrained at the boundary where they enter your circuit.
- `Bits2Num`: use with bit arrays that are already constrained; do not treat it as a range proof by itself.
- `LessThan(n)` and `GreaterThan(n)`: choose `n` for the largest possible input, not just the expected happy path.
- `Nullifier`: bind the nullifier domain to the exact action you want to make single-use.
- Merkle templates: bind roots to the correct on-chain registry, poll, or allowlist source.

## Release Review

- [ ] The README, verifier docs, and deployment scripts all describe the same public input order.
- [ ] Test circuits cover boundary values such as zero, max range, duplicate leaves, and invalid selectors.
- [ ] Contract tests reject proofs with swapped public inputs or stale Merkle roots.
- [ ] The changelog is checked for security-relevant fixes before upgrading opencircom versions.
- [ ] High-value deployments receive review beyond the project maintainers.

## References

- [SECURITY.md](../SECURITY.md)
- [CHANGELOG](../CHANGELOG)
- ZK Hack writeups on underconstrained circuits and wiring mistakes

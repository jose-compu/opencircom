# Contributing to opencircom

Thanks for contributing! Keep changes focused and link the issue they address.
For security considerations, read [SECURITY.md](SECURITY.md).

## Prerequisites

- **Node.js 18.18.0 or newer** and npm, as required by [package.json](package.json).
  [CI](.github/workflows/ci.yml) currently uses Node.js 20.
- **Circom 2.x** installed separately and available on `PATH`; npm does not
  install the compiler. CI uses Circom 2.2.3.
- Git and a Unix-like environment with Bash, `xxd`, `openssl`, and
  `/dev/urandom`. The test setup scripts use these tools; on Windows, use WSL.

Check the installed tools with `node --version`, `npm --version`, and
`circom --version` before running the tests.

## Clone, install, and test

```bash
git clone https://github.com/jose-compu/opencircom.git
cd opencircom
npm ci
npm test
```

`npm ci` installs the locked dependencies, including the development tools.
Run these commands from the repository root. To submit a PR, work on a branch
in your own fork rather than pushing to this repository's main branch.

The `test` script in [package.json](package.json) is exactly:

```bash
npm run compile:test && npm run setup:zk && mocha
```

1. `compile:test` runs `bash scripts/compile_test_circuits.sh`. It compiles every
   `test/circuits/*.circom` wrapper to R1CS and WASM in `build/`.
2. `setup:zk` runs `bash scripts/setup_zk_tests.sh`. It creates a small Powers of
   Tau and the proving/verification keys for the public Poseidon test when the
   corresponding cached files are absent.
3. Mocha runs `test/*.js`, as configured in [.mocharc.json](.mocharc.json),
   including the Groth16 proof/verification test.

The first run does more work because it generates the ZK artifacts. These are
for local tests only, not a production trusted setup. If you change the public
Poseidon wrapper or its dependencies, remove the generated `build/` directory
before rerunning `npm test` so cached keys cannot refer to the old circuit.

## How JS tests map to circuits

Reusable templates live under `circuits/`. A wrapper in `test/circuits/`
includes a library circuit, instantiates templates with concrete parameters,
and defines `component main`. The JS tests load those wrappers with
`circom_tester`, calculate witnesses, check constraints, and assert outputs.

Examples (the mapping is not always one JS file to one wrapper):

| JS test | Wrapper circuit(s) | Library circuit |
| --- | --- | --- |
| `test/poseidon_test.js` | `test/circuits/poseidon_test.circom` | `circuits/hashing/poseidon.circom` |
| `test/comparators_test.js` | `test/circuits/comparators_test.circom` | `circuits/comparators.circom` |
| `test/range_and_strict_test.js` | `test/circuits/strict_num2bits_test.circom`, `test/circuits/range_proof_test.circom` | `circuits/comparators.circom` |
| `test/zk_real_test.js` | `test/circuits/poseidon_public_test.circom`, plus `test/circuits/poseidon_test.circom` for the expected hash | `circuits/hashing/poseidon.circom` |

Follow the wrapper path passed to `wasm_tester` in a JS test, then the wrapper's
`include` statements, to find the relevant implementation. The Groth16 test
also uses the compiled public wrapper and keys prepared by `setup:zk`.
Tests using `recompile: false` rely on the files in `build/`, so rerun
`npm run compile:test` after circuit edits; running Mocha alone does not rebuild
them. Use the full `npm test` workflow before submitting a circuit change.

For a new template, add or extend a wrapper under `test/circuits/` and add a
Mocha test under `test/`. Cover expected outputs, boundary values, and invalid
inputs where the template is intended to reject them. Check witness constraints
as well as outputs; do not assume that a computed witness proves soundness.

## PR checklist

- [ ] Explain the change and link the relevant issue; avoid unrelated edits.
- [ ] Add or update circuit wrappers and JS tests when behavior changes.
- [ ] Run `npm test` and report the result and tool versions. If a check could
      not run, state the limitation instead of claiming it passed.
- [ ] Update relevant documentation when usage or assumptions change.
- [ ] Review the diff: do not commit `node_modules/`, `build/`, `test/build/`,
      generated keys/proofs, or secrets. Keep dependency/lockfile changes out
      of unrelated PRs.

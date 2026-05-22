#!/bin/bash
# Compile every test wrapper circuit under test/circuits/ (skips missing files).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p build

if ! command -v circom >/dev/null 2>&1; then
  echo "Error: circom not found on PATH. Install circom 2.x first."
  exit 1
fi

echo "Compiling test circuits (opencircom)..."
count=0
for f in "$ROOT"/test/circuits/*.circom; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  echo "  $name"
  circom "$f" --r1cs --wasm -o build -l circuits
  count=$((count + 1))
done
echo "Done. Compiled $count circuit(s)."

#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TEST_DIR = path.join(ROOT, "test", "circuits");
const OUT_DIR = path.join(ROOT, "build", "bench");
const OUT_JSON = path.join(ROOT, "docs", "benchmarks", "constraints.json");

const CIRCOM_INCLUDES = ["-l", path.join(ROOT, "circuits")];

/** Depth >= 20 Merkle-style params are skipped (slow / CI-unfriendly). */
function shouldSkip(filePath, source) {
  if (/Merkle(?:Inclusion|Update|Sparse|Incremental)?(?:Proof|Inclusion|Exclusion)?\s*\(\s*(?:2[0-9]|[3-9]\d)\s*\)/.test(source)) {
    return "Merkle depth >= 20";
  }
  if (/SparseMerkle(?:Inclusion|Exclusion)\s*\(\s*(?:2[0-9]|[3-9]\d)\s*\)/.test(source)) {
    return "sparse Merkle depth >= 20";
  }
  if (/SemaphoreMembership\s*\(\s*(?:2[0-9]|[3-9]\d)\s*\)/.test(source)) {
    return "Semaphore tree depth >= 20";
  }
  if (/AllowlistMembership\s*\(\s*(?:2[0-9]|[3-9]\d)\s*\)/.test(source)) {
    return "allowlist Merkle depth >= 20";
  }
  return null;
}

function getCircomVersion() {
  const out = spawnSync("circom", ["--version"], { encoding: "utf8" });
  if (out.status !== 0) {
    console.error("circom not found on PATH");
    process.exit(1);
  }
  const line = (out.stdout || out.stderr || "").trim();
  const m = line.match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : line;
}

function parseCircomStats(stdout) {
  const stats = {};
  const patterns = [
    ["nonLinearConstraints", /non-linear constraints:\s*(\d+)/],
    ["linearConstraints", /linear constraints:\s*(\d+)/],
    ["publicInputs", /public inputs:\s*(\d+)/],
    ["privateInputs", /private inputs:\s*(\d+)/],
    ["publicOutputs", /public outputs:\s*(\d+)/],
  ];
  for (const [key, re] of patterns) {
    const m = stdout.match(re);
    if (!m) {
      throw new Error(`Missing circom stat "${key}" in compiler output`);
    }
    stats[key] = Number(m[1], 10);
  }
  return stats;
}

function compileCircuit(absPath) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const args = [absPath, "--r1cs", "-o", OUT_DIR, ...CIRCOM_INCLUDES];
  const out = spawnSync("circom", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const combined = [out.stdout, out.stderr].filter(Boolean).join("\n");
  if (out.status !== 0) {
    throw new Error(combined.trim() || `circom exited ${out.status}`);
  }
  return parseCircomStats(combined);
}

function main() {
  const circomVersion = getCircomVersion();
  if (!circomVersion.startsWith("2.2.")) {
    console.warn(`Warning: expected Circom 2.2.x, got ${circomVersion}`);
  }

  const files = fs
    .readdirSync(TEST_DIR)
    .filter((f) => f.endsWith(".circom"))
    .sort();

  const circuits = [];
  for (const file of files) {
    const abs = path.join(TEST_DIR, file);
    const source = fs.readFileSync(abs, "utf8");
    const skipReason = shouldSkip(abs, source);
    const entry = {
      file,
      path: `test/circuits/${file}`,
      skipped: Boolean(skipReason),
      skipReason: skipReason || null,
    };
    if (skipReason) {
      console.log(`skip ${file}: ${skipReason}`);
      circuits.push(entry);
      continue;
    }
    try {
      const stats = compileCircuit(abs);
      Object.assign(entry, stats);
      console.log(
        `${file}: non-linear=${stats.nonLinearConstraints} linear=${stats.linearConstraints}`
      );
    } catch (err) {
      entry.error = String(err.message || err);
      console.error(`fail ${file}: ${entry.error}`);
      process.exitCode = 1;
    }
    circuits.push(entry);
  }

  const payload = {
    packageVersion: require(path.join(ROOT, "package.json")).version,
    circomVersion,
    generatedAt: new Date().toISOString(),
    source: "test/circuits/*.circom",
    circuits,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT_JSON}`);

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main();
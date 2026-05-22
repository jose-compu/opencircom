#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PKG_ROOT = path.join(__dirname, "..");
const CIRCUITS_DIR = path.join(PKG_ROOT, "circuits");
const TEST_CIRCUITS_DIR = path.join(PKG_ROOT, "test", "circuits");

function usage() {
  console.log(`opencircom — Circom circuit library CLI

Usage:
  opencircom path [--json]              Print circuits include path (-l flag)
  opencircom compile <file.circom>      Compile one circuit
  opencircom compile --all-test         Compile all test/circuits/*.circom
  opencircom list [--json]              List exported templates
  opencircom init [name]                Scaffold a minimal circuit + test

Options (compile):
  -o, --output <dir>    Output directory (default: ./build)
  -l, --include <dir>   Extra include path (repeatable)
  --r1cs                Emit R1CS (default: on)
  --wasm                Emit WASM (default: on)
  --sym                 Emit sym file

Requires circom on PATH (peer dependency). Node >= 18.
`);
}

function circuitsDir() {
  return CIRCUITS_DIR;
}

function findCircom() {
  const r = spawnSync("circom", ["--version"], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error("Error: circom not found on PATH. Install circom 2.x and retry.");
    console.error("  https://docs.circom.io/getting-started/installation/");
    process.exit(1);
  }
  return "circom";
}

function listCircomFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listCircomFiles(full));
    } else if (entry.name.endsWith(".circom")) {
      out.push(full);
    }
  }
  return out.sort();
}

function parseTemplates(circomPath) {
  const text = fs.readFileSync(circomPath, "utf8");
  const rel = path.relative(CIRCUITS_DIR, circomPath);
  const templates = [];
  const re = /\/\*\*([\s\S]*?)\*\/\s*template\s+(\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const name = m[2];
    const params = m[3].trim();
    const title = (block.match(/@title\s+(.+)/) || [])[1] || name;
    const notice = (block.match(/@notice\s+(.+)/) || [])[1] || "";
    templates.push({ name, params, title, notice, file: rel.split(path.sep).join("/") });
  }
  if (templates.length === 0) {
    const plain = /template\s+(\w+)\s*\(([^)]*)\)/g;
    while ((m = plain.exec(text)) !== null) {
      templates.push({
        name: m[1],
        params: m[2].trim(),
        title: m[1],
        notice: "",
        file: rel.split(path.sep).join("/"),
      });
    }
  }
  return templates;
}

function cmdPath(json) {
  const dir = circuitsDir();
  if (json) {
    console.log(JSON.stringify({ circuitsDir: dir }, null, 2));
  } else {
    console.log(dir);
  }
}

function cmdList(json) {
  const files = listCircomFiles(CIRCUITS_DIR);
  const templates = files.flatMap(parseTemplates);
  if (json) {
    console.log(JSON.stringify(templates, null, 2));
  } else {
    for (const t of templates) {
      const params = t.params ? `(${t.params})` : "()";
      console.log(`${t.name}${params}`);
      if (t.notice) console.log(`  ${t.notice}`);
      console.log(`  ${t.file}`);
    }
    console.log(`\n${templates.length} template(s)`);
  }
}

function compileOne(file, opts) {
  const circom = findCircom();
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error(`Error: file not found: ${abs}`);
    process.exit(1);
  }
  const outDir = path.resolve(opts.output);
  fs.mkdirSync(outDir, { recursive: true });

  const args = [abs, "-o", outDir, "-l", circuitsDir()];
  for (const inc of opts.include) {
    args.push("-l", path.resolve(inc));
  }
  if (opts.r1cs) args.push("--r1cs");
  if (opts.wasm) args.push("--wasm");
  if (opts.sym) args.push("--sym");

  console.log(`> ${circom} ${args.join(" ")}`);
  const r = spawnSync(circom, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}

function cmdCompile(args) {
  const opts = { output: "build", include: [], r1cs: true, wasm: true, sym: false };
  const files = [];
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "--all-test") {
      files.push(...listCircomFiles(TEST_CIRCUITS_DIR));
      i++;
    } else if (a === "-o" || a === "--output") {
      opts.output = args[++i];
      i++;
    } else if (a === "-l" || a === "--include") {
      opts.include.push(args[++i]);
      i++;
    } else if (a === "--r1cs") {
      opts.r1cs = true;
      i++;
    } else if (a === "--no-r1cs") {
      opts.r1cs = false;
      i++;
    } else if (a === "--wasm") {
      opts.wasm = true;
      i++;
    } else if (a === "--no-wasm") {
      opts.wasm = false;
      i++;
    } else if (a === "--sym") {
      opts.sym = true;
      i++;
    } else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    } else {
      files.push(a);
      i++;
    }
  }

  if (files.length === 0) {
    console.error("Error: specify a .circom file or --all-test");
    usage();
    process.exit(1);
  }

  let failed = 0;
  for (const f of files) {
    try {
      compileOne(f, opts);
    } catch (e) {
      console.error(e.message);
      failed++;
    }
  }
  if (failed > 0) process.exit(1);
  console.log(`Compiled ${files.length} circuit(s) -> ${path.resolve(opts.output)}`);
}

function cmdInit(name) {
  const base = name || "my_circuit";
  const safe = base.replace(/[^a-zA-Z0-9_]/g, "_");
  const circuitFile = `${safe}.circom`;
  const testFile = path.join("test", `${safe}_test.js`);

  if (fs.existsSync(circuitFile)) {
    console.error(`Error: ${circuitFile} already exists`);
    process.exit(1);
  }

  const circuit = `pragma circom 2.0.0;

include "opencircom/circuits/hashing/poseidon.circom";

template ${safe.charAt(0).toUpperCase() + safe.slice(1)}() {
    signal input secret;
    signal output commitment;

    component h = Poseidon(1);
    h.inputs[0] <== secret;
    commitment <== h.out;
}

component main {public [commitment]} = ${safe.charAt(0).toUpperCase() + safe.slice(1)}();
`;

  const testJs = `const path = require("path");
const chai = require("chai");
const wasm_tester = require("circom_tester").wasm;

const assert = chai.assert;
const BUILD = path.join(__dirname, "..", "build");

describe("${safe}", function () {
  let circuit;
  this.timeout(60000);

  before(async () => {
    circuit = await wasm_tester(path.join(__dirname, "..", "${circuitFile}"), {
      output: BUILD,
      include: [require("opencircom").circuitsDir],
      recompile: true,
    });
  });

  it("computes Poseidon commitment", async () => {
    const w = await circuit.calculateWitness({ secret: 42 }, true);
    await circuit.checkConstraints(w);
    assert.isDefined(w[1]);
  });
});
`;

  fs.writeFileSync(circuitFile, circuit);
  fs.mkdirSync(path.dirname(testFile), { recursive: true });
  fs.writeFileSync(testFile, testJs);

  console.log(`Created ${circuitFile}`);
  console.log(`Created ${testFile}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  npx opencircom compile ${circuitFile} -l node_modules/opencircom/circuits`);
  console.log(`  npx mocha ${testFile}`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  switch (cmd) {
    case "path":
      cmdPath(rest.includes("--json"));
      break;
    case "list":
      cmdList(rest.includes("--json"));
      break;
    case "compile":
      cmdCompile(rest);
      break;
    case "init":
      cmdInit(rest[0]);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main();

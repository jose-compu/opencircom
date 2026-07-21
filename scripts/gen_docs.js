#!/usr/bin/env node
"use strict";

/**
 * opencircom docs generator
 *
 * Parses circuits/ .circom files for template block comments (OpenZeppelin-style) and
 * template signatures, then writes docs/api/ with one file per category.
 *
 * Comment format (optional block above each template):
 *   /**
 *    * @title TemplateName
 *    * @notice One-line user-facing description.
 *    * @dev Technical details, constraints, caveats.
 *    * @param n Description of template parameter.
 *    * @custom:input name Description or type.
 *    * @custom:output name Description or type.
 *    *\/
 *
 * Single-line // comments above a template are also used as @notice if no block exists.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CIRCUITS_DIR = path.join(ROOT, "circuits");
const DOCS_DIR = path.join(ROOT, "docs", "api");

const CATEGORY_ORDER = ["arithmetic", "comparators", "bitify", "gates", "mux", "utils", "string_data", "hashing", "merkle", "voting"];
const CATEGORY_TITLES = {
  arithmetic: "Arithmetic",
  comparators: "Comparators & range",
  bitify: "Bitify",
  gates: "Gates",
  mux: "Mux & select",
  utils: "Utils",
  string_data: "String & data",
  hashing: "Hashing",
  merkle: "Merkle",
  voting: "Voting",
};

function readDirRecursive(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") {
        out.push(...readDirRecursive(full, base));
      }
    } else if (e.isFile() && e.name.endsWith(".circom")) {
      out.push(rel);
    }
  }
  return out.sort();
}

function getCategory(relPath) {
  const parts = relPath.split(path.sep);
  if (parts[0] === "hashing") return "hashing";
  if (parts[0] === "merkle") return "merkle";
  if (parts[0] === "voting") return "voting";
  const name = path.basename(relPath, ".circom");
  if (["mux1", "mux2", "muxn", "switcher"].includes(name)) return "mux";
  if (name === "arithmetic") return "arithmetic";
  if (name === "comparators") return "comparators";
  if (name === "bitify") return "bitify";
  if (name === "gates") return "gates";
  if (name === "utils") return "utils";
  if (name === "string_data") return "string_data";
  return "other";
}

function parseBlockComment(block) {
  const out = { title: "", notice: "", dev: [], param: {}, customInput: {}, customOutput: {}, complexity: "", security: "" };
  const lines = block.replace(/^\s*\/\*\*?\s*/, "").replace(/\s*\*\/\s*$/, "").split(/\n/);
  for (const line of lines) {
    const t = line.replace(/^\s*\*?\s*/, "").trim();
    if (t.startsWith("@title ")) out.title = t.slice(6).trim();
    else if (t.startsWith("@notice ")) out.notice = t.slice(7).trim();
    else if (t.startsWith("@dev ")) out.dev.push(t.slice(5).trim());
    else if (t.startsWith("@param ")) {
      const rest = t.slice(6).trim();
      const space = rest.indexOf(" ");
      const name = space > 0 ? rest.slice(0, space) : rest;
      out.param[name] = space > 0 ? rest.slice(space + 1) : "";
    } else if (t.startsWith("@custom:input ")) {
      const rest = t.slice(13).trim();
      const space = rest.indexOf(" ");
      const name = space > 0 ? rest.slice(0, space) : rest;
      out.customInput[name] = space > 0 ? rest.slice(space + 1) : "";
    } else if (t.startsWith("@custom:output ")) {
      const rest = t.slice(15).trim();
      const space = rest.indexOf(" ");
      const name = space > 0 ? rest.slice(0, space) : rest;
      out.customOutput[name] = space > 0 ? rest.slice(space + 1) : "";
    } else if (t.startsWith("@custom:complexity ")) out.complexity = t.slice(18).trim();
    else if (t.startsWith("@custom:security ")) out.security = t.slice(16).trim();
  }
  return out;
}

function parseSingleLineComment(line) {
  const m = line.match(/^\s*\/\/\s*(.+)$/);
  return m ? m[1].trim() : null;
}

function extractSignals(body) {
  const inputs = [];
  const outputs = [];
  const lines = body.split(/\n/);
  for (const line of lines) {
    const inM = line.match(/signal\s+input\s+(\w+)(\s*\[\s*\w+\s*\])?/);
    const outM = line.match(/signal\s+output\s+(\w+)(\s*\[\s*\w+\s*\])?/);
    if (inM) inputs.push({ name: inM[1], arr: inM[2] ? inM[2].replace(/\s/g, "") : null });
    if (outM) outputs.push({ name: outM[1], arr: outM[2] ? outM[2].replace(/\s/g, "") : null });
  }
  return { inputs, outputs };
}

function parseFile(content, relPath) {
  const templates = [];
  const fullContent = content;
  const templateRegex = /template\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let match;
  const positions = [];
  while ((match = templateRegex.exec(content)) !== null) {
    positions.push({
      name: match[1],
      params: match[2].trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const bodyStart = p.end;
    let bodyEnd = content.length;
    let braceDepth = 1;
    for (let j = bodyStart; j < content.length; j++) {
      if (content[j] === "{") braceDepth++;
      else if (content[j] === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          bodyEnd = j;
          break;
        }
      }
    }
    const body = content.slice(bodyStart, bodyEnd);
    const before = content.slice(0, positions[i].start);
    const blockMatch = before.match(/\/\*\*[\s\S]*?\*\//g);
    const commentBlock = blockMatch ? blockMatch[blockMatch.length - 1] : "";
    const doc = commentBlock
      ? parseBlockComment(commentBlock)
      : { title: "", notice: "", dev: [], param: {}, customInput: {}, customOutput: {}, complexity: "", security: "" };
    if (!doc.title) doc.title = p.name;
    const sig = extractSignals(body);
    templates.push({
      name: p.name,
      params: p.params,
      ...doc,
      inputs: sig.inputs,
      outputs: sig.outputs,
      file: relPath,
    });
  }
  return templates;
}

function collectByCategory(files) {
  const byCat = {};
  for (const rel of files) {
    const full = path.join(CIRCUITS_DIR, rel);
    const content = fs.readFileSync(full, "utf8");
    const templates = parseFile(content, rel);
    const cat = getCategory(rel);
    if (!byCat[cat]) byCat[cat] = { files: [], templates: [] };
    if (!byCat[cat].files.includes(rel)) byCat[cat].files.push(rel);
    for (const t of templates) {
      t.file = rel;
      byCat[cat].templates.push(t);
    }
  }
  return byCat;
}

function mdEscape(s) {
  return String(s).replace(/\|/g, "\\|");
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function templateSearchText(t) {
  const parts = [t.name, t.notice, t.file, t.params, t.complexity, t.security];
  if (t.dev) parts.push(...t.dev);
  for (const [k, v] of Object.entries(t.param)) parts.push(k, v);
  for (const i of t.inputs) parts.push(i.name);
  for (const o of t.outputs) parts.push(o.name);
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function renderTemplateHtml(t) {
  const params = t.params ? `(${htmlEscape(t.params)})` : "()";
  const id = `${t.name}-${t.file.replace(/[^\w]+/g, "-")}`;
  let s = `<article class="template-doc" id="${htmlEscape(id)}" data-search="${htmlEscape(templateSearchText(t))}">\n`;
  s += `<h3 class="template-name"><code>${htmlEscape(t.name)}${params}</code></h3>\n`;
  if (t.notice) s += `<p class="template-notice">${htmlEscape(t.notice)}</p>\n`;
  if (t.dev && t.dev.length) s += `<p class="template-dev"><strong>Dev:</strong> ${htmlEscape(t.dev.join(" "))}</p>\n`;
  if (t.complexity) s += `<p class="template-meta"><strong>Complexity:</strong> ${htmlEscape(t.complexity)}</p>\n`;
  if (t.security) s += `<p class="template-meta template-security"><strong>Security:</strong> ${htmlEscape(t.security)}</p>\n`;
  if (Object.keys(t.param).length) {
    s += `<dl class="template-dl">\n<dt>Parameters</dt><dd><ul>`;
    for (const [k, v] of Object.entries(t.param)) {
      s += `<li><code>${htmlEscape(k)}</code> — ${htmlEscape(v || "—")}</li>`;
    }
    s += `</ul></dd>\n`;
  }
  s += `<dt>Inputs</dt><dd><ul>`;
  if (t.inputs.length) {
    for (const i of t.inputs) {
      const arr = i.arr ? htmlEscape(i.arr) : "";
      const desc = t.customInput[i.name] ? ` — ${htmlEscape(t.customInput[i.name])}` : "";
      s += `<li><code>${htmlEscape(i.name)}${arr}</code>${desc}</li>`;
    }
  } else {
    s += `<li><em>from template body</em></li>`;
  }
  s += `</ul></dd>\n<dt>Outputs</dt><dd><ul>`;
  if (t.outputs.length) {
    for (const o of t.outputs) {
      const arr = o.arr ? htmlEscape(o.arr) : "";
      const desc = t.customOutput[o.name] ? ` — ${htmlEscape(t.customOutput[o.name])}` : "";
      s += `<li><code>${htmlEscape(o.name)}${arr}</code>${desc}</li>`;
    }
  } else {
    s += `<li><em>from template body</em></li>`;
  }
  s += `</ul></dd></dl>\n`;
  s += `<p class="template-file">Defined in <code>circuits/${htmlEscape(t.file)}</code></p>\n`;
  s += `</article>\n`;
  return s;
}

function renderCategoryHtml(cat, data) {
  const title = CATEGORY_TITLES[cat] || cat;
  const slug = cat === "other" ? "other" : cat;
  let s = `<section class="docs-category" id="cat-${htmlEscape(slug)}">\n`;
  s += `<h2>${htmlEscape(title)}</h2>\n`;
  s += `<p class="docs-category-intro">${data.templates.length} template${data.templates.length === 1 ? "" : "s"} in this category.</p>\n`;
  for (const t of data.templates) s += renderTemplateHtml(t);
  s += `</section>\n`;
  return s;
}

function renderSidebarNav(byCat) {
  let s = `<div class="sidebar-group"><p class="sidebar-heading">Guide</p><ul>`;
  const guides = [
    ["overview", "Overview"],
    ["install", "Installation"],
    ["includes", "Include paths"],
    ["hardhat", "Hardhat"],
    ["foundry", "Foundry"],
    ["cli-ref", "CLI reference"],
    ["testing", "Testing"],
    ["security", "Security"],
    ["comments", "Comment format"],
  ];
  for (const [id, label] of guides) {
    s += `<li><a href="#${id}">${htmlEscape(label)}</a></li>`;
  }
  s += `</ul></div><div class="sidebar-group"><p class="sidebar-heading">Circuit reference</p><ul>`;
  for (const cat of CATEGORY_ORDER) {
    if (!byCat[cat]) continue;
    const title = CATEGORY_TITLES[cat] || cat;
    s += `<li><a href="#cat-${htmlEscape(cat)}">${htmlEscape(title)}</a></li>`;
  }
  if (byCat.other) s += `<li><a href="#cat-other">Other</a></li>`;
  s += `</ul></div>`;
  return s;
}

function countTemplates(byCat) {
  let n = 0;
  for (const cat of Object.keys(byCat)) n += byCat[cat].templates.length;
  return n;
}

function renderDocumentationHtml(byCat) {
  const templateCount = countTemplates(byCat);
  const categoryBlocks = CATEGORY_ORDER.filter((c) => byCat[c]).map((c) => renderCategoryHtml(c, byCat[c])).join("\n");
  const otherBlock = byCat.other ? renderCategoryHtml("other", byCat.other) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="OpenCircom v0.8.0 documentation — installation, CLI, Hardhat/Foundry integration, security, and full circuit template reference." />
  <title>Documentation — OpenCircom</title>
  <link rel="icon" href="assets/img/logo.png" type="image/png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body class="docs-page">
  <header class="site-header">
    <div class="container">
      <a class="logo-link" href="index.html">
        <img src="assets/img/logo.png" alt="OpenCircom" />
        <span class="logo-text">open<span>circom</span></span>
      </a>
      <nav>
        <a href="index.html#concept">Concept</a>
        <a href="index.html#circuits">Circuits</a>
        <a href="documentation.html" class="nav-active">Documentation</a>
        <a href="index.html#start">Quick start</a>
        <a href="https://github.com/jose-compu/opencircom" target="_blank" rel="noopener">GitHub</a>
        <a class="btn btn-primary" href="https://www.npmjs.com/package/opencircom" target="_blank" rel="noopener">npm install</a>
      </nav>
    </div>
  </header>

  <div class="docs-layout">
    <aside class="docs-sidebar" aria-label="Documentation navigation">
      <label class="docs-search-label" for="docs-search">Search templates</label>
      <input type="search" id="docs-search" class="docs-search" placeholder="Filter by name, signal, file…" autocomplete="off" />
      ${renderSidebarNav(byCat)}
    </aside>

    <main class="docs-content">
      <header class="docs-header">
        <p class="section-label">Documentation</p>
        <h1>OpenCircom reference</h1>
        <p class="docs-lead">v0.8.0 — ${templateCount} circuit templates, CLI tooling, integration guides, and auto-generated template reference from <code>circuits/**/*.circom</code>.</p>
      </header>

      <section class="docs-section" id="overview">
        <h2>Overview</h2>
        <p>OpenCircom is a library of reusable <strong>Circom 2.x</strong> templates for zero-knowledge applications: hashing (Poseidon, MiMC, SHA-256), comparators, Merkle proofs, identity (Semaphore-style), voting, MACI v1 building blocks, and utilities. There is <strong>no dependency on circomlib</strong>; implementations are self-contained and covered by 163+ real Groth16 tests.</p>
        <p>Install via npm, add the circuits folder to your Circom include path (<code>-l</code>), and compose templates in your own circuits. Use the <a href="https://github.com/jose-compu/opencircom-hardhat-boilerplate" target="_blank" rel="noopener">Hardhat</a> or <a href="https://github.com/jose-compu/opencircom-foundry-boilerplate" target="_blank" rel="noopener">Foundry</a> boilerplates for a full compile → verifier → test pipeline.</p>
      </section>

      <section class="docs-section" id="install">
        <h2>Installation</h2>
        <pre class="code-block"><code class="language-bash">npm install opencircom</code></pre>
        <p>Peer dependency: <strong>circom 2.x</strong> must be installed and available on <code>PATH</code>. OpenCircom does not bundle the compiler.</p>
        <p>Package version: <code>^0.8.0</code>. Circuits live under <code>node_modules/opencircom/circuits/</code>.</p>
      </section>

      <section class="docs-section" id="includes">
        <h2>Include paths &amp; compilation</h2>
        <p>Reference templates with paths relative to the include directory:</p>
        <pre class="code-block"><code class="language-circom">include "opencircom/circuits/hashing/poseidon.circom";
include "opencircom/circuits/merkle/merkle_inclusion.circom";</code></pre>
        <p>Compile with the opencircom circuits on the include path:</p>
        <pre class="code-block"><code class="language-bash"># Manual
circom your.circom --r1cs --wasm -o build -l node_modules/opencircom/circuits

# CLI (adds include path automatically)
npx opencircom compile circuits/YourCircuit.circom -o build

# Print include path only
npx opencircom path</code></pre>
        <p>If you clone or submodule the repo as <code>opencircom/</code> in your project root, use <code>-l opencircom/circuits</code> instead.</p>
      </section>

      <section class="docs-section" id="hardhat">
        <h2>Hardhat integration</h2>
        <ol class="docs-steps">
          <li>Add <code>opencircom</code> as an npm dependency.</li>
          <li>In your Circom build step, pass <code>-l node_modules/opencircom/circuits</code>.</li>
          <li>Use snarkjs (or your flow) to generate the Groth16 verifier Solidity contract.</li>
          <li>Deploy or import the verifier in Hardhat tests and call it from your application contracts.</li>
        </ol>
        <p>See the <a href="https://github.com/jose-compu/opencircom-hardhat-boilerplate" target="_blank" rel="noopener"><strong>opencircom-hardhat-boilerplate</strong></a> starter repo for a wired pipeline (compile circuits, generate verifier, JS tests).</p>
      </section>

      <section class="docs-section" id="foundry">
        <h2>Foundry integration</h2>
        <ol class="docs-steps">
          <li>Install via npm: <code>npm install opencircom</code>, or add as a Git submodule under <code>lib/opencircom</code>.</li>
          <li>Run <code>circom</code> with <code>-l node_modules/opencircom/circuits</code> (or <code>-l lib/opencircom/circuits</code>).</li>
          <li>Generate the Solidity verifier with snarkjs; place the <code>.sol</code> file in <code>src/</code>.</li>
          <li>Run <code>forge build</code> and <code>forge test</code>.</li>
        </ol>
        <p>See the <a href="https://github.com/jose-compu/opencircom-foundry-boilerplate" target="_blank" rel="noopener"><strong>opencircom-foundry-boilerplate</strong></a> for submodule setup, npm compile scripts, and Solidity tests.</p>
      </section>

      <section class="docs-section" id="cli-ref">
        <h2>CLI reference</h2>
        <p>The <code>opencircom</code> CLI ships with the npm package (v0.7.0+; current <code>^0.8.0</code>):</p>
        <div class="docs-table-wrap">
          <table class="docs-table">
            <thead><tr><th>Command</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>npx opencircom path</code></td><td>Print absolute path to <code>circuits/</code> for manual <code>-l</code> flags.</td></tr>
              <tr><td><code>npx opencircom compile &lt;file&gt; -o &lt;dir&gt;</code></td><td>Compile a circuit with opencircom on the include path.</td></tr>
              <tr><td><code>npx opencircom compile --all-test -o &lt;dir&gt;</code></td><td>Compile every wrapper in <code>test/circuits/</code> (used by <code>npm test</code>).</td></tr>
              <tr><td><code>npx opencircom list</code></td><td>List exported templates with descriptions from circuit comments.</td></tr>
              <tr><td><code>npx opencircom init &lt;name&gt;</code></td><td>Scaffold a minimal Poseidon commitment circuit and mocha test file.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="docs-section" id="testing">
        <h2>Testing</h2>
        <p>Tests compile real circuits, run a small Powers of Tau ceremony, generate Groth16 proofs with snarkjs, and verify — no mocks on the proof path.</p>
        <pre class="code-block"><code class="language-bash">git clone https://github.com/jose-compu/opencircom.git
cd opencircom
npm install
npm test</code></pre>
        <p><code>npm test</code> runs <code>compile:test</code> (all test circuits) then <code>setup:zk</code> (ptau + zkey). First run can take about a minute.</p>
        <p>Coverage includes hashing, comparators, Merkle (inclusion, sparse, incremental, update, allowlist), identity, nullifiers, voting, MACI, arithmetic, utils, string validation, and full Groth16 prove/verify flows.</p>
      </section>

      <section class="docs-section" id="security">
        <h2>Security</h2>
        <ul class="docs-list">
          <li><strong>Range checks:</strong> Use <code>StrictNum2Bits(n)</code> or <code>RangeProof(n)</code> for untrusted inputs; <code>LessThan(n)</code> assumes inputs &lt; 2<sup>n</sup>.</li>
          <li><strong>Binary selectors / bits:</strong> Prefer <code>SafeAND</code>, <code>SafeOR</code>, <code>SafeMux1</code>, <code>SafeMux2</code>, <code>SafeBits2Num(n)</code> for untrusted inputs. Raw AND/OR/Mux1/Mux2/Bits2Num are building blocks without binary constraints.</li>
          <li><strong>Merkle:</strong> <code>pathIndices[i]</code> are constrained binary in-circuit; <code>Switcher</code> constrains <code>sel</code> to {0,1}.</li>
          <li><strong>Nullifier:</strong> Use a unique <code>externalNullifier</code> per action to avoid cross-action replay.</li>
          <li><strong>Hashing:</strong> Poseidon uses standard Hades parameters; constants in <code>circuits/hashing/poseidon_constants.circom</code>.</li>
          <li><strong>Audit (0.5.0) / Safe wrappers (0.8.0):</strong> Binary constraints and range checks hardened in Switcher, ForceEqualIfEnabled, IncrementalMerkleInclusion, DivRem, and PadPKCS7; Safe* templates added for gates, mux, and Bits2Num.</li>
          <li><strong>MACI:</strong> EdDSA, ECDH shared keys, and full DuplexSponge encryption remain off-circuit (coordinator layer). See <a href="https://maci.pse.dev/docs/v1.2/spec">MACI v1 spec</a>.</li>
        </ul>
        <p>Full notes: <a href="https://github.com/jose-compu/opencircom/blob/main/SECURITY.md">SECURITY.md</a> on GitHub.</p>
      </section>

      <section class="docs-section" id="comments">
        <h2>Comment format</h2>
        <p>Templates are documented with OpenZeppelin-style block comments. Run <code>npm run docs</code> to regenerate this page and markdown under <code>docs/api/</code>.</p>
        <pre class="code-block"><code>/**
 * @title TemplateName
 * @notice One-line user-facing description.
 * @dev Technical details, constraints, caveats.
 * @param n Description of template parameter.
 * @custom:input name Description or type.
 * @custom:output name Description or type.
 * @custom:complexity Constraint count, big-O, or performance note.
 * @custom:security Security considerations or caveats.
 */</code></pre>
      </section>

      <section class="docs-section docs-reference" id="reference">
        <h2>Circuit template reference</h2>
        <p class="section-intro">Auto-generated from source. Use the sidebar search to filter by template name, signal, or file path.</p>
        <p class="docs-no-results hidden" id="docs-no-results">No templates match your search.</p>
        ${categoryBlocks}
        ${otherBlock}
      </section>
    </main>
  </div>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <img src="assets/img/logo.png" alt="" width="28" height="28" />
        <span class="footer-tagline">
          <span class="t-blue">Reusable.</span>
          <span class="t-silver">Secure.</span>
          <span class="t-dim">No circomlib.</span>
        </span>
      </div>
      <div class="footer-links">
        <a href="index.html">Home</a>
        <a href="https://github.com/jose-compu/opencircom">GitHub</a>
        <a href="https://www.npmjs.com/package/opencircom">npm</a>
        <a href="https://github.com/jose-compu/opencircom/blob/main/LICENSE">MIT License</a>
      </div>
      <p class="footer-copy">OpenCircom v0.8.0 · Generated by <code>npm run docs</code></p>
    </div>
  </footer>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="js/docs.js"></script>
</body>
</html>
`;
}

function renderTemplateMd(t) {
  const params = t.params ? `(${t.params})` : "()";
  let s = `### \`${t.name}${params}\`\n\n`;
  if (t.notice) s += `**Notice:** ${mdEscape(t.notice)}\n\n`;
  if (t.dev && t.dev.length) s += `**Dev:** ${t.dev.map(mdEscape).join(" ")}\n\n`;
  if (t.complexity) s += `**Complexity / constraints:** ${mdEscape(t.complexity)}\n\n`;
  if (t.security) s += `**Security:** ${mdEscape(t.security)}\n\n`;
  if (Object.keys(t.param).length) {
    s += "**Parameters:**\n";
    for (const [k, v] of Object.entries(t.param)) s += `- \`${k}\`: ${mdEscape(v || "—")}\n`;
    s += "\n";
  }
  s += "**Inputs:**\n";
  if (t.inputs.length) for (const i of t.inputs) s += `- \`${i.name}${i.arr || ""}\`${t.customInput[i.name] ? " — " + mdEscape(t.customInput[i.name]) : ""}\n`;
  else s += "- *(from template body)*\n";
  s += "\n**Outputs:**\n";
  if (t.outputs.length) for (const o of t.outputs) s += `- \`${o.name}${o.arr || ""}\`${t.customOutput[o.name] ? " — " + mdEscape(t.customOutput[o.name]) : ""}\n`;
  else s += "- *(from template body)*\n";
  s += `\n*Defined in \`${t.file}\`*\n\n`;
  return s;
}

function renderCategoryMd(cat, data) {
  const title = CATEGORY_TITLES[cat] || cat;
  let s = `# ${title}\n\n`;
  s += `Circuits in this category:\n\n`;
  for (const t of data.templates) {
    s += renderTemplateMd(t);
  }
  return s;
}

function main() {
  if (!fs.existsSync(CIRCUITS_DIR)) {
    console.error("circuits/ not found");
    process.exit(1);
  }
  const files = readDirRecursive(CIRCUITS_DIR);
  const byCat = collectByCategory(files);
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

  let index = `# opencircom — Circuit documentation\n\n`;
  index += `Generated from \`circuits/**/*.circom\` using OpenZeppelin-style block comments.\n\n`;
  index += `## Categories\n\n`;
  for (const cat of CATEGORY_ORDER) {
    if (!byCat[cat]) continue;
    const title = CATEGORY_TITLES[cat] || cat;
    const slug = cat === "other" ? "other" : cat;
    index += `- [${title}](./${slug}.md)\n`;
  }
  index += `\n## Comment format\n\n`;
  index += `Use block comments above each template:\n\n`;
  index += "```\n/**\n * @title TemplateName\n * @notice One-line user-facing description.\n";
  index += " * @dev Technical details, constraints, caveats.\n";
  index += " * @param n Description of template parameter.\n";
  index += " * @custom:input name Description or type.\n";
  index += " * @custom:output name Description or type.\n";
  index += " * @custom:complexity Constraint count, big-O, or performance note.\n";
  index += " * @custom:security Security considerations or caveats.\n";
  index += " */\n```\n\n";
  fs.writeFileSync(path.join(DOCS_DIR, "README.md"), index, "utf8");

  for (const cat of CATEGORY_ORDER) {
    if (!byCat[cat]) continue;
    const md = renderCategoryMd(cat, byCat[cat]);
    fs.writeFileSync(path.join(DOCS_DIR, `${cat}.md`), md, "utf8");
  }
  if (byCat.other) {
    const md = renderCategoryMd("other", byCat.other);
    fs.writeFileSync(path.join(DOCS_DIR, "other.md"), md, "utf8");
  }

  const htmlPath = path.join(ROOT, "docs", "documentation.html");
  fs.writeFileSync(htmlPath, renderDocumentationHtml(byCat), "utf8");
  console.log("Docs written to docs/api/");
  console.log("Documentation page written to docs/documentation.html");
}

main();

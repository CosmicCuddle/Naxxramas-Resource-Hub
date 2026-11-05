// Public, read-only GitHub Pages smoke test. No credentials, admin login,
// application form submissions, uploads, edits or private connection files.
"use strict";
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");

const site = "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/";
const liveGuide = site + "?section=Game%20Clients";

async function getPublic(path, limit) {
  const url = site + path;
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(40000),
      redirect: "follow",
      headers: { "Cache-Control": "no-cache" }
    });
  } catch (error) {
    throw new Error("PUBLIC_SITE_UNREACHABLE: " + path + ": " + error.message);
  }
  if (!response.ok) {
    throw new Error("PUBLIC_SITE_HTTP_ERROR: " + path + ": HTTP " + response.status);
  }
  if (!response.url.startsWith(site)) {
    throw new Error("PUBLIC_SITE_UNEXPECTED_REDIRECT: " + path);
  }
  const body = await response.text();
  if (body.length > limit) throw new Error("PUBLIC_SITE_OVERSIZED_RESPONSE: " + path);
  return body;
}

function whichChrome() {
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [name], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("NO_BROWSER: Chrome/Chromium unavailable in test runner");
}

function renderLivePage() {
  const browser = whichChrome();
  const args = [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    "--disable-dev-shm-usage", "--disable-extensions",
    "--disable-background-networking", "--no-first-run",
    "--virtual-time-budget=45000", "--window-size=1440,900",
    "--dump-dom", liveGuide
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let dom = "", stderr = "", settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done(new Error("LIVE_BROWSER_TIMEOUT: no completed page render"));
    }, 120000);
    function done(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    }
    child.stdout.on("data", chunk => {
      dom += chunk.toString();
      if (dom.length > 100 * 1024 * 1024) {
        child.kill("SIGKILL");
        done(new Error("LIVE_BROWSER_OVERSIZED_DOM"));
      }
    });
    child.stderr.on("data", chunk => {
      stderr = (stderr + chunk.toString()).slice(-800);
    });
    child.on("error", done);
    child.on("close", code => {
      if (code !== 0) done(new Error("LIVE_BROWSER_FAILED: exit " + code + " " + stderr));
      else done(null, dom);
    });
  });
}

async function main() {
  const [index, script, css] = await Promise.all([
    getPublic("", 150000),
    getPublic("assets/naxx-game-clients-guide.js", 300000),
    getPublic("assets/naxx-game-clients-guide.css", 100000)
  ]);
  for (const filename of ["site-content.html", "naxx-game-clients-guide.js", "naxx-game-clients-guide.css"]) {
    assert.ok(index.includes(filename), "PUBLIC_LOADER_MISSING: " + filename);
  }
  for (const token of [
    "ChromieCraft", "Warmane", "20260228080116",
    "3.3.5a", "12340", "patch-V.mpq", "patch-Z.mpq",
    "acceptance email", "realmlist.wtf"
  ]) {
    assert.ok(script.includes(token), "PUBLIC_GUIDE_MISSING: " + token);
  }
  assert.ok(!script.includes("Eternion"), "DEFERRED_SOURCE_SHOULD_NOT_APPEAR");
  assert.ok(css.includes("visual-admin-active"), "PUBLIC_ADMIN_STYLE_MISSING");
  console.log("PASS: public loader, Game Clients assets and privacy-safe guide text are served");

  const dom = await renderLivePage();
  assert.ok(dom.includes('id="naxx-game-client-guide"'),
    "LIVE_GUIDE_NOT_RENDERED: Game Clients route did not mount the guide");
  assert.ok(dom.includes('id="naxx-client-explainer-title"'),
    "LIVE_EXPLANATION_BANNER_MISSING");
  assert.ok(dom.includes("ChromieCraft") && dom.includes("Warmane"),
    "LIVE_DOWNLOAD_CARDS_MISSING");
  assert.ok(dom.includes("adminPasswordInput"),
    "LIVE_ORIGINAL_ADMIN_CONTROL_MISSING");
  console.log("PASS: public Game Clients page renders the guide and preserves native admin controls");
  console.log("PASS: public live smoke test finished (read-only; actual admin sign-in NOT attempted)");
}

main().catch(error => {
  console.error("FAIL: " + error.message);
  process.exitCode = 1;
});

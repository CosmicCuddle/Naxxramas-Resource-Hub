'use strict';
/* node --test editor/tests/navigation.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const json = JSON.parse(fs.readFileSync(path.join(root, 'content/navigation.json'), 'utf8'));
const code = fs.readFileSync(path.join(root, 'assets/naxx-three-pages.js'), 'utf8');
const needle = '  loadNavigationSettings();\n})();';
assert.ok(code.endsWith(needle + '\n'), 'The navigation script startup has changed; review the test harness.');
const hooked = code.replace(needle, '  loadNavigationSettings();\n  window.__test = { currentPages: function(){ return pages; }, validNavPage: validNavPage };\n})();');

function execute(reply) {
  const events = [], errors = [];
  const document = {
    currentScript: { src: 'https://example.org/Naxxramas-Resource-Hub/assets/naxx-three-pages.js?v=3' },
    readyState: 'loading',
    addEventListener(name) { events.push(name); },
    getElementById() { return null; }
  };
  const window = {
    console: { error(...args) { errors.push(args); } },
    addEventListener(name) { events.push(name); }
  };
  const ctx = {
    URL, document, window,
    location: {
      href: 'https://example.org/Naxxramas-Resource-Hub/',
      pathname: '/Naxxramas-Resource-Hub/'
    },
    fetch(url, config) {
      events.push(url.href);
      assert.equal(config.cache, 'default');
      return Promise.resolve(reply);
    }
  };
  vm.runInNewContext(hooked, ctx, { filename: 'assets/naxx-three-pages.js' });
  return { values: window.__test, events, errors };
}

test('navigation JSON exactly matches currently approved menu keys and icons', () => {
  assert.equal(json.format, 'naxx-navigation-v1');
  assert.deepEqual(json.pages.map((p) => p.slug), ['new-players', 'rules', 'apply']);
  assert.equal(json.pages[0].icon, 'inv_misc_book_09.jpg');
  assert.equal(json.pages[1].icon, 'inv_misc_note_05.jpg');
  assert.equal(json.pages[2].icon, 'inv_misc_key_03.jpg');
  assert.ok(json.pages.every((p) => p.group === 'General'));
});

test('navigation loads only repository-owned JSON and preserves exact page slugs', async () => {
  const changed = structuredClone(json);
  changed.pages[0].label = 'First Steps';
  const page = execute({ ok: true, json: async () => changed });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(page.events.includes('https://example.org/Naxxramas-Resource-Hub/content/navigation.json'));
  assert.equal(page.values.currentPages()[0].label, 'First Steps');
  assert.equal(page.values.currentPages()[0].slug, 'new-players');
});

test('unsafe or invalid navigation metadata falls back to original values', async () => {
  const bad = structuredClone(json);
  bad.pages[1].icon = '../javascript:alert(1)';
  const page = execute({ ok: true, json: async () => bad });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.values.currentPages()[1].icon, 'inv_misc_note_05.jpg');
  assert.ok(page.errors.length > 0);
});

test('missing metadata does not block initial navigation', async () => {
  const page = execute({ ok: false, status: 404 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.values.currentPages()[2].label, 'Apply to Join');
  assert.ok(page.errors.length > 0);
});

test('navigation script still leaves application privacy and Tally logic untouched', () => {
  assert.match(code, /APPLICATION_EMBED_APPROVED = true/);
  assert.match(code, /https:\/\/tally\.so\/embed\/q5Lqr8\?/);
  assert.match(code, /new MutationObserver/);
  assert.match(code, /data-naxx-guide-content/);
});

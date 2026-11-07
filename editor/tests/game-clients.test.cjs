'use strict';
/* node --test editor/tests/game-clients.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const guideSource = fs.readFileSync(path.join(root, 'game-clients/content.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'assets/naxx-game-clients-guide.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('separate Game Clients content preserves the approved page and private-connection warning', () => {
  assert.match(guideSource, /<article id="naxx-game-client-guide"/);
  assert.match(guideSource, /<\/article>\s*$/);
  assert.match(guideSource, /ChromieCraft/);
  assert.match(guideSource, /Warmane/);
  assert.doesNotMatch(guideSource, /Eternion/i);
  assert.match(guideSource, /patch-V\.mpq/);
  assert.match(guideSource, /patch-Z\.mpq/);
  assert.match(guideSource, /realm address is private/i);
  assert.doesNotMatch(guideSource, /(?:\b\d{1,3}\.){3}\d{1,3}\b/);
  assert.doesNotMatch(guideSource, /<script\b/i);
});
test('small website loader is preserved, with only the new guide script version', () => {
  assert.ok(Buffer.byteLength(loader) < 10000);
  assert.match(loader, /new URL\("site-content\.html", siteRoot\)/);
  assert.match(loader, /assets\/naxx-game-clients-guide\.js\?v=2/);
  assert.match(loader, /document\.write\(html\)/);
  assert.doesNotMatch(loader, /var guideHTML\s*=/);
});
function fixture(ok) {
  const history = [];
  const cardToggles = [];
  let inserted = false, active = true, removed = false;
  const card = {
    querySelector(selector) {
      assert.equal(selector, '.game-client-title');
      return { textContent: 'ChromieCraft' };
    },
    classList: { toggle(name, value) { cardToggles.push([name, value]); } }
  };
  const grid = {
    firstChild: null,
    classList: { toggle(name, selected) { history.push(['gridClass', name, selected]); } },
    querySelectorAll(selector) {
      assert.equal(selector, '.game-client-card');
      return [card];
    },
    insertAdjacentHTML(where, html) {
      assert.equal(where, 'afterbegin');
      assert.equal(html, guideSource);
      inserted = true;
      history.push(['inserted', html.length]);
    },
    insertBefore(el) { inserted = true; history.push(['fallback', el.textContent]); }
  };
  const document = {
    currentScript: { src: 'https://example.org/Naxxramas-Resource-Hub/assets/naxx-game-clients-guide.js?v=2' },
    readyState: 'complete',
    querySelector() { return null; },
    getElementById(id) {
      if (id === 'resourceGrid') return grid;
      if (id === 'naxx-game-client-guide' && inserted) {
        return { remove() { inserted = false; removed = true; } };
      }
      return null;
    },
    createElement(tag) { assert.equal(tag, 'div'); return { id: '', className: '', textContent: '' }; }
  };
  const window = { addEventListener(name, callback) { if (name === 'pageshow') this.pageshow = callback; }, console: { error: () => {} } };
  let fetches = 0;
  const context = {
    document, window, URL,
    location: { href: 'https://example.org/Naxxramas-Resource-Hub/' },
    currentSection: 'Game Clients',
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe() {} },
    fetch: async (url, opts) => {
      fetches++;
      history.push(['fetch', url.href, opts.cache]);
      if (!ok) return { ok: false, status: 404 };
      return { ok: true, text: async () => guideSource };
    }
  };
  vm.runInNewContext(script, context, { filename: 'assets/naxx-game-clients-guide.js' });
  return {
    history, cardToggles, get fetches() { return fetches; },
    get inserted() { return inserted; },
    get removed() { return removed; },
    navigateAway() { context.currentSection = 'Home'; window.pageshow(); }
  };
}

test('visitor sees the HTML fragment from the same repository path', async () => {
  const page = fixture(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.fetches, 1);
  assert.ok(page.history.some((event) =>
    event[0] === 'fetch' && event[1] === 'https://example.org/Naxxramas-Resource-Hub/game-clients/content.html'));
  assert.ok(page.history.some((event) => event[0] === 'inserted'));
  assert.ok(page.cardToggles.some((event) => event[0] === 'naxx-legacy-client-card' && event[1] === true));
  assert.equal(page.inserted, true);
  page.navigateAway();
  assert.equal(page.inserted, false);
  assert.equal(page.removed, true);
});

test('missing new HTML file leaves the original card visible and shows a warning', async () => {
  const page = fixture(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.fetches, 1);
  assert.ok(page.history.some((event) => event[0] === 'fallback' && /could not be loaded/i.test(event[1])));
  assert.ok(!page.cardToggles.some((event) => event[0] === 'naxx-legacy-client-card' && event[1] === true));
});

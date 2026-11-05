'use strict';
/* node --test editor/tests/pages.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const editorJs = fs.readFileSync(path.join(root, 'editor', 'editor.js'), 'utf8');
const needle = '  setButtons();\n  showFields();\n})();';
assert.ok(editorJs.endsWith(needle + '\n'), 'Editor startup changed: update the test harness.');
const hookedJs = editorJs.replace(needle, '  window.__test = { scan: scan, applyPage: applyPage, validHref: validHref };\n})();');
function element() {
  return {
    value: '', textContent: '', disabled: true, files: [],
    classList: { toggle() {} },
    addEventListener() {}, replaceChildren() {}, appendChild() {}, append() {},
    click() {}, remove() {}
  };
}
const nodes = new Map();
const document = {
  getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
  createElement(name) {
    const node = element();
    if (name === 'textarea') Object.defineProperty(node, 'innerHTML', {
      set(html) {
        this.value = html.replace(/&amp;/g, '&').replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      }
    });
    return node;
  }
};
const window = {};
vm.runInNewContext(hookedJs, {
  window, document, URL, Map, Set, Array
}, { filename: 'editor/editor.js' });
const { scan, applyPage, validHref } = window.__test;

['new-players/content.html', 'rules/content.html', 'apply/content.html', 'game-clients/content.html'].forEach((relative) => {
  test(relative + ': preserves all unedited source bytes', () => {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const runs = scan(source);
    assert.ok(runs.filter((run) => run.kind === 'text').length > 20);
    assert.ok(runs.filter((run) => run.kind === 'href').length > 0);
    assert.equal(applyPage({ source, runs, edits: new Map() }), source);
    const item = runs.find((run) => run.kind === 'text' && /^[a-zA-Z]/.test(run.original));
    assert.ok(item);
    const next = item.value + ' additional wording';
    const result = applyPage({ source, runs, edits: new Map([[item.id, next]]) });
    assert.equal(result, source.slice(0, item.start) + next + source.slice(item.end));
  });
});

test('can edit an existing HTML link without changing surrounding markup', () => {
  const source = fs.readFileSync(path.join(root, 'new-players/content.html'), 'utf8');
  const runs = scan(source);
  const item = runs.find((run) => run.kind === 'href' && run.value === '../rules/');
  assert.ok(item);
  const result = applyPage({ source, runs, edits: new Map([[item.id, '../apply/']]) });
  assert.equal(result, source.slice(0, item.start) + '../apply/' + source.slice(item.end));
  assert.ok(result.includes('<a class="naxx-guide-link" href="../apply/">'));
});

test('text is escaped and never converted to executable HTML', () => {
  const source = fs.readFileSync(path.join(root, 'rules/content.html'), 'utf8');
  const runs = scan(source);
  const item = runs.find((run) => run.kind === 'text' && run.value.startsWith('Naxxramas is built'));
  assert.ok(item);
  const updated = applyPage({ source, runs, edits: new Map([[item.id, '<script>alert(1)</script>']]) });
  assert.ok(updated.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!updated.includes('<script>alert(1)</script>'));
});

test('intentional text clearing retains surrounding tags', () => {
  const source = fs.readFileSync(path.join(root, 'rules/content.html'), 'utf8');
  const runs = scan(source);
  const first = runs.find((run) => run.kind === 'text');
  const updated = applyPage({ source, runs, edits: new Map([[first.id, '']]) });
  assert.equal(updated, source.slice(0, first.start) + source.slice(first.end));
});

test('unsafe href schemes are rejected', () => {
  assert.equal(validHref('../apply/'), true);
  assert.equal(validHref('https://example.com/'), true);
  assert.equal(validHref('mailto:help@example.com'), true);
  assert.equal(validHref('javascript:alert(1)'), false);
  assert.equal(validHref('data:text/html,foo'), false);
  const source = fs.readFileSync(path.join(root, 'apply/content.html'), 'utf8');
  const runs = scan(source);
  const href = runs.find((run) => run.kind === 'href');
  assert.throws(() => applyPage({ source, runs, edits: new Map([[href.id, 'javascript:alert(1)']]) }));
});

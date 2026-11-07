'use strict';
/* node --test editor/tests/preview.test.cjs — no network or browser required */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'preview.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'editor.js'), 'utf8');

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function textNode(value) { return { nodeType: 3, nodeValue: value }; }
function rawElement(tagName, children = [], classes = []) {
  return { nodeType: 1, tagName: tagName.toUpperCase(), childNodes: children, classList: classes };
}
class OutputElement {
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
    this.childNodes = [];
    this.attrs = {};
    this.textContent = '';
  }
  appendChild(node) { this.childNodes.push(node); }
  set className(name) { this.attrs.class = name; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  get outerHTML() {
    const attrs = Object.entries(this.attrs).map(([k, v]) => ' ' + k + '="' + esc(v) + '"').join('');
    return '<' + this.tagName + attrs + '>' + esc(this.textContent) +
      this.childNodes.map((n) => n.nodeType === 3 ? esc(n.nodeValue) : n.outerHTML).join('') +
      '</' + this.tagName + '>';
  }
}
function makeHarness(nodes) {
  const mockDocument = {
    implementation: {
      createHTMLDocument() {
        return {
          createElement: (name) => new OutputElement(name),
          createTextNode: textNode
        };
      }
    },
    createElement(name) {
      assert.equal(name, 'template', 'Preview must use an inert template parser.');
      const template = { content: { childNodes: nodes } };
      Object.defineProperty(template, 'innerHTML', { set(value) { assert.equal(typeof value, 'string'); } });
      return template;
    }
  };
  const window = {};
  vm.runInNewContext(source, { window, document: mockDocument, Set, Array }, { filename: 'editor/preview.js' });
  return window.NaxxEditorPreview;
}

test('offline preview strips executable, third-party and navigation-capable elements', () => {
  const nodes = [
    rawElement('section', [
      rawElement('h2', [textNode('Rules & respect')]),
      rawElement('a', [textNode('Click here')]),
      rawElement('script', [textNode('window.evil()')]),
      rawElement('iframe', [textNode('private application')]),
      rawElement('img'),
      rawElement('form', [textNode('private form')]),
      rawElement('input'),
      rawElement('svg', [textNode('script payload')])
    ], ['naxx-guide-card', 'unsafe" class="bad'])
  ];
  const preview = makeHarness(nodes).render('<section>Ignored by fake parser</section>', 'Rules <Preview>');
  assert.match(preview, /Rules &lt;Preview&gt;/);
  assert.match(preview, /Rules &amp; respect/);
  assert.match(preview, /naxx-guide-card/);
  assert.doesNotMatch(preview, /window\.evil|private form|private application|script payload/);
  assert.doesNotMatch(preview, /<iframe\b|<script\b|<form\b|<input\b|<img\b|href=/i);
  assert.match(preview, /External application form deliberately hidden/);
  assert.match(preview, /External image hidden/);
  assert.match(preview, /default-src 'none'/);
  assert.match(preview, /frame-src 'none'/);
  assert.match(preview, /connect-src 'none'/);
  assert.match(preview, /form-action 'none'/);
});

test('preview refuses unexpectedly large input', () => {
  const preview = makeHarness([]);
  assert.throws(() => preview.render('a'.repeat(2 * 1024 * 1024 + 1), 'Too much content'));
});

test('UI uses a sandboxed offline iframe and explicit reversible controls', () => {
  assert.match(page, /src="preview\.js"/);
  assert.match(page, /id="preview-frame"[^>]*sandbox=""/);
  assert.match(page, /id="preview-page"/);
  assert.match(page, /id="revert-page"/);
  assert.match(page, /id="revert-nav"/);
  assert.match(page, /id="revert-all"/);
  assert.match(editor, /NaxxEditorPreview\.render\(html, title\)/);
  assert.match(editor, /preview-frame'\)\.srcdoc/);
  assert.match(editor, /window\.confirm\('Discard ALL local edits/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
});

'use strict';
/* node --test editor/tests/revert-controls.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'editor.js'), 'utf8');
const final = '  setButtons();\n  showFields();\n  showNavigation();\n})();';
assert.ok(js.endsWith(final + '\n'));
const script = js.replace(final,
  '  window.__harness = {' +
  ' install: function(pages, nav) { state = pages; navState = nav; showFields(); showNavigation(); setButtons(); },' +
  ' snapshot: function() { return {state:state, navState:navState}; }' +
  ' };\n' + final);
function fakeElement() {
  return {
    handlers: {}, style: {}, value: '', checked: false, hidden: true, disabled: true,
    textContent: '', srcdoc: '',
    classList: { toggle(){} },
    addEventListener(name, cb) { this.handlers[name] = cb; },
    appendChild(){}, append(){}, replaceChildren(){},
    removeAttribute(name) { if (name === 'srcdoc') this.srcdoc = ''; }
  };
}
const elements = new Map();
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  },
  createElement() { return fakeElement(); }
};
let decision = true, previews = 0;
const window = { confirm() { return decision; } };
const NaxxEditorPreview = { render(markup, heading) {
  previews++;
  assert.ok(markup.includes('Reviewed'));
  assert.ok(typeof heading === 'string');
  return '<!doctype html><title>Offline only</title>';
}};
vm.runInNewContext(script, {
  window, document, URL, Map, Set, Array, NaxxEditorPreview
}, { filename: 'editor/editor.js' });
const filenames = ['new-players/content.html', 'rules/content.html', 'apply/content.html', 'game-clients/content.html'];
function setup() {
  const pages = new Map(filenames.map((filename) => [
    filename,
    {
      source: 'Original',
      runs: [{id:'T:0',kind:'text',label:'Text',start:0,end:8,original:'Original',value:'Original'}],
      edits: new Map()
    }
  ]));
  const original = {format:'naxx-navigation-v1',pages:[
    {slug:'new-players',label:'New Players',title:'New Player Guide',intro:'Start',icon:'inv_misc_book_09.jpg',group:'General'},
    {slug:'rules',label:'Server Rules',title:'Server Rules',intro:'Rules',icon:'inv_misc_note_05.jpg',group:'General'},
    {slug:'apply',label:'Apply to Join',title:'Apply',intro:'Apply',icon:'inv_misc_key_03.jpg',group:'General'}
  ]};
  const nav = {original, current: structuredClone(original)};
  pages.get(filenames[0]).edits.set('T:0','Reviewed');
  pages.get(filenames[1]).edits.set('T:0','Also changed');
  nav.current.pages[0].label = 'First Steps';
  window.__harness.install(pages, nav);
  return {pages, nav};
}
function click(id) {
  const fn = document.getElementById(id).handlers.click;
  assert.equal(typeof fn,'function',id+' should handle clicking');
  fn();
}
test('Preview Current Page does not discard edits or publish content', () => {
  const {pages} = setup();
  click('preview-page');
  assert.equal(previews,1);
  assert.equal(elements.get('preview-wrap').hidden,false);
  assert.match(elements.get('preview-frame').srcdoc,/Offline only/);
  assert.equal(pages.get(filenames[0]).edits.get('T:0'),'Reviewed');
});
test('cancelled revert leaves all unsaved edits untouched', () => {
  const {pages,nav} = setup();
  decision = false;
  click('revert-all');
  assert.equal(pages.get(filenames[0]).edits.size,1);
  assert.equal(nav.current.pages[0].label,'First Steps');
  decision = true;
});
test('Revert Page affects only the selected page', () => {
  const {pages,nav} = setup();
  click('revert-page');
  assert.equal(pages.get(filenames[0]).edits.size,0);
  assert.equal(pages.get(filenames[1]).edits.size,1);
  assert.equal(nav.current.pages[0].label,'First Steps');
});
test('Revert Navigation preserves HTML edits', () => {
  const {pages,nav} = setup();
  click('revert-nav');
  assert.equal(nav.current.pages[0].label,'New Players');
  assert.equal(pages.get(filenames[0]).edits.size,1);
});
test('Revert All removes edits and closes preview only after confirmation', () => {
  const {pages,nav} = setup();
  click('preview-page');
  click('revert-all');
  assert.ok(Array.from(pages.values()).every((page) => page.edits.size === 0));
  assert.equal(nav.current.pages[0].label,'New Players');
  assert.equal(elements.get('preview-wrap').hidden,true);
  assert.equal(elements.get('preview-frame').srcdoc,'');
  assert.equal(elements.get('export-changes').disabled,true);
});

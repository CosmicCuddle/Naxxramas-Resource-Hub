'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const vm=require('node:vm');
const {PAGES,NAV,runs,plan,validHref}=require('../tools/plan-page-draft.cjs');
const root=path.resolve(__dirname,'..','..');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function draft(){
  const files=PAGES.map(name=>({
    path:name,sourceSha256:sha(fs.readFileSync(path.join(root,name))),edits:{}
  }));
  const navFile=fs.readFileSync(path.join(root,NAV));
  return {
    format:'naxx-local-draft-v3',
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00.000Z',
    files,navigation:{
      path:NAV,sourceSha256:sha(navFile),
      document:JSON.parse(navFile.toString('utf8'))
    }
  };
}
function chooseText(fileIndex=0){
  const source=fs.readFileSync(path.join(root,PAGES[fileIndex]),'utf8');
  const found=runs(source).find(e=>e.kind==='text');
  assert.ok(found);
  return found;
}
test('all original page fragments and navigation are verified with zero proposed modifications',()=>{
  const result=plan(root,draft());
  assert.equal(result.sourceVerified,true);
  assert.equal(result.verified.length,5);
  assert.equal(result.changed.length,0);
  assert.equal(result.exportAllowedWithoutReview,false);
  assert.equal(result.sourceCommitVerified,false);
  assert.equal(result.published,false);
  assert.ok(result.verified.every(x=>/^[a-f0-9]{64}$/.test(x.sourceSha256)));
});
test('page edit and navigation edit preserve their Git relative paths and original hashes',()=>{
  const d=draft();
  const first=chooseText();
  d.files[0].edits[first.id]='Safe edited & corrected <label> with \"quotes\"';
  d.navigation.document.pages[0].label='Updated New Players';
  const result=plan(root,d);
  assert.deepEqual(result.changed.map(x=>x.path),
    ['content/navigation.json','new-players/content.html']);
  assert.equal(result.changed.find(x=>x.path===PAGES[0]).modifiedFields,1);
  const output=result.changed.find(x=>x.path===PAGES[0]).bytes.toString('utf8');
  assert.ok(output.includes('Safe edited &amp; corrected &lt;label&gt; with "quotes"'));
  assert.ok(!output.includes('<label> with'));
  const nav=JSON.parse(result.changed.find(x=>x.kind==='navigation').bytes);
  assert.equal(nav.pages[0].label,'Updated New Players');
  assert.equal(nav.pages[0].slug,'new-players');
  assert.equal(result.changed.find(x=>x.path===PAGES[0]).sourceSha256,
    d.files[0].sourceSha256);
});
test('HTML link values are validated rather than admitting script links',()=>{
  const d=draft();
  const raw=fs.readFileSync(path.join(root,PAGES[0]),'utf8');
  const href=runs(raw).find(x=>x.kind==='href');
  assert.ok(href);
  d.files[0].edits[href.id]='javascript:alert(1)';
  assert.throws(()=>plan(root,d),/unsafe hyperlink/);
  d.files[0].edits[href.id]='../rules/?hello=1&thing=2';
  const result=plan(root,d);
  assert.ok(result.changed[0].bytes.toString('utf8').includes('hello=1&amp;thing=2'));
  assert.equal(validHref('https://example.org'),true);
  assert.equal(validHref('data:text/html,unsafe'),false);
  assert.equal(validHref('//other.example.org'),false);
});
test('wrong source hash, swapped paths and fabricated text positions fail closed',()=>{
  const bad=draft();bad.files[0].sourceSha256='0'.repeat(64);
  assert.throws(()=>plan(root,bad),/source hash mismatch/);
  const swapped=draft();swapped.files[0].path='index.html';
  assert.throws(()=>plan(root,swapped),/Unapproved page path/);
  const invented=draft();invented.files[0].edits['T:99999999']='fake';
  assert.throws(()=>plan(root,invented),/unrecognised/);
  const duplicate=draft();duplicate.files[1].path=PAGES[0];
  assert.throws(()=>plan(root,duplicate),/Unapproved page path/);
  const branch=draft();branch.sourceBranchHint='main';
  assert.throws(()=>plan(root,branch),/Unrecognised or unverified/);
});
test('navigation routing and icon filenames cannot be redirected by a draft',()=>{
  const malicious=draft();
  malicious.navigation.document.pages[1].slug='evil-path';
  assert.throws(()=>plan(root,malicious),/Unapproved navigation structure/);
  const icon=draft();icon.navigation.document.pages[1].icon='https://example.org/evil.jpg';
  assert.throws(()=>plan(root,icon),/Unsafe navigation image/);
  const nested=draft();nested.navigation.document.pages[1].extra='override';
  assert.throws(()=>plan(root,nested),/Unapproved navigation structure/);
});
test('script/style/textarea content is never offered as a page text edit',()=>{
  const source='<p>Editable text</p><script>DO_NOT_EDIT()</script><style>.s { a: b }</style><textarea>NO</textarea><a href="../rules/">Read rules</a>';
  const r=runs(source);
  assert.ok(r.some(x=>x.kind==='text'&&x.original==='Editable text'));
  assert.ok(r.some(x=>x.kind==='text'&&x.original==='Read rules'));
  assert.ok(r.some(x=>x.kind==='href'&&x.original==='../rules/'));
  assert.ok(!r.some(x=>x.original.includes('DO_NOT_EDIT')||x.original.includes('.s { a')||x.original.includes('NO')));
});

test('offline draft scanner matches actual webpage editor token positions in all four original pages',()=>{
  const editor=fs.readFileSync(path.join(root,'editor','editor.js'),'utf8');
  const begin=editor.indexOf('  function tagEnd(source, start) {');
  const end=editor.indexOf('  function editedFields(page) {',begin);
  assert.ok(begin>=0&&end>begin);
  // Execute only the trusted editor scanner, NEVER the original website JS.
  const source='(function(){function decodeText(s){return s;}\n'+
    editor.slice(begin,end)+'\nreturn scan;})()';
  const actualScanner=vm.runInNewContext(source,{}, {timeout:2000});
  for(const rel of PAGES){
    const html=fs.readFileSync(path.join(root,rel),'utf8');
    const expected=actualScanner(html);
    const checked=runs(html);
    assert.ok(checked.length>=10);
    assert.deepEqual(checked.map(x=>[x.id,x.kind,x.start,x.end,x.original]),
      expected.map(x=>[x.id,x.kind,x.start,x.end,x.original]));
  }
});

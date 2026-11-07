'use strict';
/* Browser preview uses fictional resources only; no original website,
 * credentials, files, publication, download or website Admin actions.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const demo=require('../revision-demo-core.js');
const reader=require('../revision-source-reader.js');
const html=fs.readFileSync(path.join(root,'revision-demo-preview.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'revision-demo-preview.js'),'utf8');
const core=fs.readFileSync(path.join(root,'revision-demo-core.js'),'utf8');
function fakeElement(){
  return {value:'',textContent:'',disabled:true,handlers:{},dataset:{},
    addEventListener(name,fn){this.handlers[name]=fn;},
    click(){return this.handlers.click?.();}};
}
function interfaceHarness(){
  const elements=new Map();
  const document={getElementById(id){
    if(!elements.has(id))elements.set(id,fakeElement());
    return elements.get(id);
  }};
  let approve=false,confirmCount=0;
  const sample={first:{snapshot:{manifest:{revision:1,sourceSha256:'a'.repeat(64)}},fictional:true},
    second:{snapshot:{manifest:{revision:2,sourceSha256:'b'.repeat(64)}},fictional:true}};
  const standIn={
    async examples(){return sample;},
    resource(f,index){return {title:'Title '+f.snapshot.manifest.revision+' / '+index,
      content:'Content '+f.snapshot.manifest.revision+' / '+index};},
    async prepare(f,crypto,index,title,content){
      if(title==='BAD')throw Error('Invalid title');
      return {format:'naxx-private-versioned-resource-draft-v1',
        revision:f.snapshot.manifest.revision,
        sourceSha256:f.snapshot.manifest.sourceSha256,changes:[{index,title,content}]};
    },
    check(draft,current){return draft.revision!==current.snapshot.manifest.revision?
      {decision:'stale',message:'Older draft refused. Kept for comparison.'}:
      {decision:'matching',message:'Matching fictional metadata only.'};}
  };
  const window={NaxxRevisionDemo:standIn,crypto:{},
    confirm(){confirmCount++;return approve;}};
  vm.runInNewContext(ui,{window,document,Number,Object},
    {filename:'editor/revision-demo-preview.js'});
  return {window,elements,chooseApproval(v){approve=v;},
    get confirms(){return confirmCount;},el:id=>elements.get(id)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('fiction-only page is independent and refuses network, files, forms and publish controls',()=>{
  for(const name of ['resource-title-core.js','revision-source-reader.js',
    'revision-draft-review.js','revision-demo-core.js',
    'revision-demo-preview.js'])assert.match(html,
      new RegExp('src="'+name.replaceAll('.','\\.')+'"'));
  for(const id of ['revision-one','revision-two','resource-index',
    'edit-title','edit-content','prepare-draft','check-draft',
    'clear-draft','held-summary','demo-status']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/role="status"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/focus-visible/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/NOT A REAL SAVE/);
  assert.match(html,/independently authenticated GitHub commit/);
  assert.doesNotMatch(html,/<input[^>]+type="file"/);
  assert.doesNotMatch(html,/<form[\s>]/);
  for(const code of [ui,core]){
    for(const unsafe of ['fetch(', 'XMLHttpRequest', 'sendBeacon(',
      'localStorage','writeFileSync(','github.com/','createObjectURL('])
      assert.equal(code.includes(unsafe),false,unsafe);
  }
});
test('real browser-compatible demo modules exercise both fictional revisions and reject stale drafts',async()=>{
  const samples=await demo.examples(webcrypto);
  assert.equal(samples.independentGitTrust,false);
  assert.equal(samples.first.snapshot.manifest.revision,1);
  assert.equal(samples.second.snapshot.manifest.revision,2);
  assert.equal(samples.second.snapshot.manifest.parentSha256,
    samples.first.snapshot.manifest.sourceSha256);
  assert.equal(samples.first.snapshot.fragments.length,414);
  assert.equal(samples.second.snapshot.fragments.length,414);
  const first=await reader.inspect(samples.first.snapshot,
    samples.first.trust,webcrypto);
  const second=await reader.inspect(samples.second.snapshot,
    samples.second.trust,webcrypto);
  assert.equal(first.resourcesVerified,414);
  assert.equal(second.resourcesVerified,414);
  assert.equal(first.githubReady,false);
  const fromOne=demo.resource(samples.first,0);
  const draft=await demo.prepare(samples.first,webcrypto,0,
    'Fictional revised title',fromOne.content);
  assert.equal(draft.revision,1);
  assert.equal(draft.changes[0].index,0);
  assert.equal(draft.changes[0].title,'Fictional revised title');
  assert.equal(draft.changes[0].expectedSha256,
    samples.first.snapshot.manifest.resources[0].sha256);
  assert.equal(demo.check(draft,samples.first).decision,'matching');
  assert.equal(demo.check(draft,samples.second).decision,'stale');
  assert.equal(samples.first.snapshot.fragments[0],
    samples.second.snapshot.fragments[0]);
  assert.notEqual(samples.first.snapshot.fragments[413],
    samples.second.snapshot.fragments[413]);
});
test('real example draft builder refuses empty or unsafe edits without altering fictional data',async()=>{
  const samples=await demo.examples(webcrypto),original=demo.resource(samples.first,0);
  const before=JSON.stringify(samples.first.snapshot);
  await assert.rejects(demo.prepare(samples.first,webcrypto,0,
    original.title,original.content),/Nothing changed/);
  await assert.rejects(demo.prepare(samples.first,webcrypto,0,
    '<script>unsafe</script>',original.content),/invalid/i);
  await assert.rejects(demo.prepare(samples.first,webcrypto,0,
    original.title,'<iframe>unsafe</iframe>'),/invalid/i);
  await assert.rejects(demo.prepare(samples.first,webcrypto,414,
    'Impossible index','Body'),/Choose a fictional resource/);
  assert.equal(JSON.stringify(samples.first.snapshot),before);
});
test('fictional UI can hold draft, refuse stale revision, and keep it for comparison',async()=>{
  const h=interfaceHarness();
  await tick();
  assert.equal(h.el('prepare-draft').disabled,false);
  assert.equal(h.el('edit-title').value,'Title 1 / 0');
  assert.equal(h.el('check-draft').disabled,true);
  h.el('edit-title').value='My imaginary title';
  await h.el('prepare-draft').click();
  assert.match(h.el('held-summary').textContent,/Version 1/);
  assert.equal(h.el('check-draft').disabled,false);
  h.el('revision-two').click();
  assert.equal(h.confirms,0,
    'already reviewed text is held safely and must not ask to discard it');
  h.el('check-draft').click();
  assert.match(h.el('demo-status').textContent,/Older draft refused/);
  assert.equal(h.el('demo-status').dataset.kind,'stale');
  assert.match(h.el('held-summary').textContent,/Version 1/);
  assert.equal(h.el('edit-title').value,'Title 2 / 0');
  h.el('clear-draft').click();
  assert.match(h.el('held-summary').textContent,/No fictional draft/);
  assert.equal(h.el('check-draft').disabled,true);
});
test('cancelled version and resource changes preserve unreviewed text',async()=>{
  const h=interfaceHarness();await tick();
  h.el('edit-title').value='Unreviewed typed title';
  h.el('revision-two').click();
  assert.equal(h.confirms,1);
  assert.equal(h.el('edit-title').value,'Unreviewed typed title');
  assert.match(h.el('revision-label').textContent,/Version 1/);
  h.el('resource-index').value='413';
  h.el('resource-index').handlers.change();
  assert.equal(h.confirms,2);
  assert.equal(h.el('resource-index').value,'0');
  assert.equal(h.el('edit-title').value,'Unreviewed typed title');
  h.chooseApproval(true);
  h.el('revision-two').click();
  assert.match(h.el('revision-label').textContent,/Version 2/);
  assert.equal(h.el('edit-title').value,'Title 2 / 0');
});
test('invalid example input is reported without corrupting a held draft',async()=>{
  const h=interfaceHarness();await tick();
  h.el('edit-title').value='Safe example';
  await h.el('prepare-draft').click();
  assert.match(h.el('held-summary').textContent,/Version 1/);
  h.el('edit-title').value='BAD';
  await h.el('prepare-draft').click();
  assert.match(h.el('demo-status').textContent,/Invalid title/);
  assert.match(h.el('held-summary').textContent,/Version 1/);
});

test('new typing after holding a reviewed example requires consent before changing version',async()=>{
  const h=interfaceHarness();await tick();
  h.el('edit-title').value='Reviewed title';
  await h.el('prepare-draft').click();
  assert.match(h.el('held-summary').textContent,/Version 1/);
  h.el('edit-title').value='Changed again since review';
  h.el('edit-title').handlers.input();
  h.el('revision-two').click();
  assert.equal(h.confirms,1);
  assert.match(h.el('revision-label').textContent,/Version 1/);
  assert.equal(h.el('edit-title').value,'Changed again since review');
  assert.match(h.el('held-summary').textContent,/Version 1/);
  h.chooseApproval(true);
  h.el('revision-two').click();
  assert.equal(h.confirms,2);
  assert.match(h.el('revision-label').textContent,/Version 2/);
  assert.match(h.el('held-summary').textContent,/Version 1/);
});

test('second prepared example cannot silently overwrite the first held draft',async()=>{
  const h=interfaceHarness();await tick();
  h.el('edit-title').value='First reviewed example';
  await h.el('prepare-draft').click();
  const held=h.el('held-summary').textContent;
  assert.match(held,/Version 1/);
  h.el('edit-title').value='Second proposed example';
  h.el('edit-title').handlers.input();
  await h.el('prepare-draft').click();
  assert.equal(h.confirms,1);
  assert.equal(h.el('held-summary').textContent,held);
  assert.match(h.el('demo-status').textContent,/Replacement cancelled/);
  h.chooseApproval(true);
  await h.el('prepare-draft').click();
  assert.equal(h.confirms,2);
  assert.match(h.el('demo-status').textContent,/reviewed locally/);
  h.el('revision-two').click();
  assert.match(h.el('held-summary').textContent,/Version 1/);
});

test('clearing held fictional draft during slow verification cannot resurrect it',async()=>{
  const h=interfaceHarness();await tick();
  h.el('edit-title').value='Original held example';
  await h.el('prepare-draft').click();
  assert.match(h.el('held-summary').textContent,/Version 1/);
  let finish;
  h.window.NaxxRevisionDemo.prepare=()=>new Promise(resolve=>{finish=resolve;});
  h.el('edit-title').value='New attempt awaiting SHA verification';
  h.el('edit-title').handlers.input();
  const pending=h.el('prepare-draft').click();
  assert.equal(h.el('prepare-draft').disabled,true);
  h.el('clear-draft').click();
  const message=h.el('demo-status').textContent;
  assert.match(message,/cleared from memory/);
  assert.match(h.el('held-summary').textContent,/No fictional draft/);
  finish({format:'naxx-private-versioned-resource-draft-v1',
    revision:1,sourceSha256:'a'.repeat(64),changes:[{
      index:0,title:'Attempt after Clear',content:'Not trusted'}]});
  await pending;
  assert.match(h.el('held-summary').textContent,/No fictional draft/);
  assert.equal(h.el('check-draft').disabled,true);
  assert.equal(h.el('demo-status').textContent,message);
  assert.equal(h.confirms,0);
});
test('switching fictional versions during SHA verification ignores old review and old status',async()=>{
  const h=interfaceHarness();await tick();
  let finish;
  h.window.NaxxRevisionDemo.prepare=()=>new Promise(resolve=>{finish=resolve;});
  h.el('edit-title').value='Potentially stale example';
  h.el('edit-title').handlers.input();
  const pending=h.el('prepare-draft').click();
  h.chooseApproval(true);
  h.el('revision-two').click();
  const message=h.el('demo-status').textContent;
  assert.match(h.el('revision-label').textContent,/Version 2/);
  assert.match(message,/Version 2 displayed/);
  finish({format:'naxx-private-versioned-resource-draft-v1',
    revision:1,sourceSha256:'a'.repeat(64),changes:[{index:0,title:'Old pending'}]});
  await pending;
  assert.equal(h.el('demo-status').textContent,message);
  assert.match(h.el('held-summary').textContent,/No fictional draft/);
  assert.equal(h.el('check-draft').disabled,true);
});
test('typing during fictional verification invalidates old review without status rollback',async()=>{
  const h=interfaceHarness();await tick();
  let finish;
  h.window.NaxxRevisionDemo.prepare=()=>new Promise(resolve=>{finish=resolve;});
  h.el('edit-title').value='Original request';
  const pending=h.el('prepare-draft').click();
  h.el('edit-title').value='New typing after review started';
  h.el('edit-title').handlers.input();
  const message=h.el('demo-status').textContent;
  assert.match(message,/text changed during checking/);
  finish({format:'naxx-private-versioned-resource-draft-v1',
    revision:1,sourceSha256:'a'.repeat(64),changes:[{index:0,title:'Old request'}]});
  await pending;
  assert.equal(h.el('demo-status').textContent,message);
  assert.equal(h.el('edit-title').value,'New typing after review started');
  assert.match(h.el('held-summary').textContent,/No fictional draft/);
});

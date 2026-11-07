'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.resolve(__dirname,'..','editor.js');
const source=fs.readFileSync(file,'utf8');
const tail='  setButtons();\n  showFields();\n  showNavigation();\n})();';
assert.ok(source.endsWith(tail+'\n'));
const patched=source.replace(tail,
  '  window.__pageRestoreHarness={install:function(pages,nav){state=pages;navState=nav;showFields();showNavigation();setButtons();},snapshot:function(){return {state:state,navState:navState};}};\n'+tail);
const paths=['new-players/content.html','rules/content.html',
  'apply/content.html','game-clients/content.html'];
const SHA='a'.repeat(64);
function navigation(){
  return {format:'naxx-navigation-v1',pages:[
    {slug:'new-players',group:'General',label:'New Players',title:'Welcome',intro:'Begin here',icon:'inv_misc_book_09.jpg'},
    {slug:'rules',group:'General',label:'Rules',title:'Rules',intro:'Server rules',icon:'inv_misc_note_05.jpg'},
    {slug:'apply',group:'General',label:'Apply',title:'Apply',intro:'Application',icon:'inv_misc_key_03.jpg'}
  ]};
}
function draft(){
  return {format:'naxx-local-draft-v3',sourceCommitVerified:false,
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    files:paths.map((p,i)=>({path:p,sourceSha256:SHA,
      edits:i===0?{'T:0':'Recovered text'}:{}})),
    navigation:{path:'content/navigation.json',sourceSha256:SHA,
      document:navigation()}};
}
function harness(){
  const elements=new Map();
  function fake(){
    return {handlers:{},style:{},value:'',textContent:'',hidden:true,
      disabled:true,checked:false,srcdoc:'',
      classList:{toggle(){}},addEventListener(name,cb){this.handlers[name]=cb;},
      append(){},appendChild(){},replaceChildren(){},
      removeAttribute(name){if(name==='srcdoc')this.srcdoc='';}};
  }
  const document={
    getElementById(id){
      if(!elements.has(id))elements.set(id,fake());
      return elements.get(id);
    },createElement(){return fake();}
  };
  let confirms=0,approve=true;
  const window={confirm(){confirms++;return approve;}};
  vm.runInNewContext(patched,{window,document,URL,Map,Set,Array},
    {filename:'editor/editor.js'});
  const original=navigation();
  const state=new Map(paths.map(p=>[p,{
    source:'Original',hash:SHA,
    runs:[{id:'T:0',kind:'text',value:'Original',start:0,end:8,
        original:'Original',label:'Content'},
      {id:'H:20',kind:'href',value:'../rules/',original:'../rules/',
        start:20,end:29,label:'Link',quote:'"'}],
    edits:new Map()
  }]));
  const nav={hash:SHA,source:'navigation',original,
    current:structuredClone(original)};
  window.__pageRestoreHarness.install(state,nav);
  return {
    window,elements,state,nav,
    draft:()=>JSON.stringify(draft()),
    get confirmations(){return confirms;},
    setConfirm(v){approve=v;}
  };
}
test('page draft requires source-verified pages before any mutation',()=>{
  const h=harness();
  assert.equal(typeof h.window.NaxxLocalPageReview.restoreDraftText,'function');
  assert.throws(()=>h.window.NaxxLocalPageReview.restoreDraftText(''),
    /empty or too large/);
  assert.throws(()=>h.window.NaxxLocalPageReview.restoreDraftText('{'),
    /Unexpected end|Expected property|JSON/);
});
test('cancelled valid import preserves unsaved HTML edits and navigation and clears no data',()=>{
  const h=harness();
  h.state.get(paths[0]).edits.set('T:0','Current unexported edit');
  h.nav.current.pages[1].label='Current custom label';
  h.setConfirm(false);
  const outcome=h.window.NaxxLocalPageReview.restoreDraftText(h.draft());
  assert.equal(outcome,false);
  assert.equal(h.confirmations,1);
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),'Current unexported edit');
  assert.equal(h.nav.current.pages[1].label,'Current custom label');
  assert.match(h.elements.get('status').textContent,/cancelled/);
});
test('validated page draft only replaces its own page and navigation in memory after consent',()=>{
  const h=harness();
  h.state.get(paths[0]).edits.set('T:0','Old unsaved edit');
  h.setConfirm(true);
  h.elements.get('preview-wrap').hidden=false;
  const result=h.window.NaxxLocalPageReview.restoreDraftText(h.draft());
  assert.equal(result,true);
  assert.equal(h.confirmations,1);
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),'Recovered text');
  assert.equal(h.state.get(paths[1]).edits.size,0);
  assert.equal(h.elements.get('preview-wrap').hidden,true);
  assert.match(h.elements.get('status').textContent,/Nothing was published/);
});
test('wrong source checksum or forged page path cannot replace previous edits',()=>{
  const h=harness();
  h.state.get(paths[0]).edits.set('T:0','Keep this');
  const wrong=draft();
  wrong.files[0].sourceSha256='b'.repeat(64);
  assert.throws(()=>h.window.NaxxLocalPageReview.restoreDraftText(JSON.stringify(wrong)),
    /does not match/);
  const forged=draft();
  forged.files[1].path=paths[0];
  assert.throws(()=>h.window.NaxxLocalPageReview.restoreDraftText(JSON.stringify(forged)),
    /does not match|duplicate/);
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),'Keep this');
  assert.equal(h.confirmations,0);
});
test('unsafe recovered link and unexpected navigation route never reach overwrite confirmation',()=>{
  const h=harness();
  h.state.get(paths[0]).edits.set('T:0','Keep this too');
  const badHref=draft();badHref.files[0].edits['H:20']='javascript:alert(1)';
  assert.throws(()=>h.window.NaxxLocalPageReview.restoreDraftText(JSON.stringify(badHref)),
    /invalid or unsafe/);
  const wrongNav=draft();wrongNav.navigation.document.pages[1].slug='../rules';
  assert.throws(()=>h.window.NaxxLocalPageReview.restoreDraftText(JSON.stringify(wrongNav)),
    /routes and group/);
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),'Keep this too');
  assert.equal(h.confirmations,0);
});
test('page draft direct restore stays offline and requires explicit consent',()=>{
  const s=fs.readFileSync(file,'utf8');
  assert.match(s,/restoreDraftText: restorePageDraftText/);
  assert.match(s,/Replace your current unsaved page and navigation edits/);
  assert.match(s,/if \(hasChanges\(\) && !window\.confirm/);
  assert.doesNotMatch(s,/fetch\(|XMLHttpRequest|localStorage\.setItem/);
});

test('newest page JSON draft wins when an older file read completes late',async()=>{
  const h=harness(),picker=h.elements.get('draft-file');
  let releaseOld;
  const older=JSON.parse(h.draft());
  older.files[0].edits['T:0']='Older draft content';
  picker.files=[{size:512,text:()=>new Promise(resolve=>{releaseOld=resolve;})}];
  const first=picker.handlers.change();
  const newer=JSON.parse(h.draft());
  newer.files[0].edits['T:0']='Newer draft content';
  picker.files=[{size:512,text:async()=>JSON.stringify(newer)}];
  await picker.handlers.change();
  const message=h.elements.get('status').textContent;
  releaseOld(JSON.stringify(older));
  await first;
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),'Newer draft content');
  assert.equal(h.elements.get('status').textContent,message);
  assert.equal(h.confirmations,0,'obsolete draft must not ask for overwrite permission');
});
test('older failed page JSON read never masks a newer successful restore',async()=>{
  const h=harness(),picker=h.elements.get('draft-file');
  let rejectOld;
  picker.files=[{size:512,text:()=>new Promise((_,reject)=>{rejectOld=reject;})}];
  const first=picker.handlers.change();
  const newer=JSON.parse(h.draft());
  newer.files[0].edits['T:0']='Newest recovered text';
  picker.files=[{size:512,text:async()=>JSON.stringify(newer)}];
  await picker.handlers.change();
  const status=h.elements.get('status').textContent;
  rejectOld(Error('Obsolete page draft could not be read.'));
  await first;
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),'Newest recovered text');
  assert.equal(h.elements.get('status').textContent,status);
});
test('empty page draft picker event does not interrupt a valid in-flight draft',async()=>{
  const h=harness(),picker=h.elements.get('draft-file');
  let release;
  picker.files=[{size:512,text:()=>new Promise(resolve=>{release=resolve;})}];
  const loading=picker.handlers.change();
  picker.files=[];
  await picker.handlers.change();
  release(h.draft());
  await loading;
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),'Recovered text');
  assert.match(h.elements.get('status').textContent,/Draft restored locally/);
});
test('page edits made while JSON is loading remain subject to late consent',async()=>{
  const h=harness(),picker=h.elements.get('draft-file');
  let release;
  picker.files=[{size:512,text:()=>new Promise(resolve=>{release=resolve;})}];
  const loading=picker.handlers.change();
  h.state.get(paths[0]).edits.set('T:0','Typed while old draft loading');
  h.nav.current.pages[0].label='Keep unsaved navigation';
  h.setConfirm(false);
  release(h.draft());
  await loading;
  assert.equal(h.confirmations,1);
  assert.equal(h.state.get(paths[0]).edits.get('T:0'),
    'Typed while old draft loading');
  assert.equal(h.nav.current.pages[0].label,'Keep unsaved navigation');
  assert.match(h.elements.get('status').textContent,/cancelled/);
});

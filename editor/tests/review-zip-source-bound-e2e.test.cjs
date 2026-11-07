'use strict';
/* Private, in-memory Save -> ZIP -> Verify -> Restore integration.
 * Real ZIP bytes, real review inspector, real local page editor restore.
 * Uses fictional edits/fingerprints and no original website or GitHub write.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..','..');
const SHA='a'.repeat(64);
const PAGE_PATHS=['new-players/content.html','rules/content.html',
  'apply/content.html','game-clients/content.html'];
const navOriginal=JSON.parse(fs.readFileSync(
  path.join(root,'content/navigation.json'),'utf8'));
const reader=require('../review-package-reader.js');
function zipTools(){
  const sandbox={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,Set,Array,
    crypto:webcrypto,document:{getElementById(){return null;}}};
  for(const name of ['export-zip.js','review-package.js']){
    const src=fs.readFileSync(path.join(root,'editor',name),'utf8');
    vm.runInNewContext(src,sandbox,{filename:name});
  }
  return {writer:sandbox.NaxxEditorZip,review:sandbox.NaxxEditorReview};
}
function pageDraft(change='ZIP restored page text'){
  const nav=structuredClone(navOriginal);
  nav.pages[0].label='Review ZIP proposed navigation';
  return {format:'naxx-local-draft-v3',
    sourceCommitVerified:false,sourceBranchHint:'private review only',
    createdAt:'2026-11-07T00:00:00.000Z',
    files:PAGE_PATHS.map((p,i)=>({
      path:p,sourceSha256:SHA,edits:i===0?{'T:0':change}:{}}
    )),
    navigation:{path:'content/navigation.json',
      sourceSha256:SHA,document:nav}
  };
}
function resourceDraft(){
  return {format:'naxx-local-resource-draft-v2',
    baselineSha256:'34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8',
    changes:[{index:0,title:'Fictional private recovery title'}]
  };
}
function fakeElement(){
  return {listeners:{},value:'',files:[],disabled:true,hidden:true,
    textContent:'',checked:false,style:{},
    classList:{toggle(){}},
    addEventListener(name,fn){this.listeners[name]=fn;},
    click(){return this.listeners.click?.();},
    append(){},appendChild(){},replaceChildren(){},
    removeAttribute(){},remove(){},setAttribute(){}
  };
}
function pageEditor(){
  const src=fs.readFileSync(path.join(root,'editor','editor.js'),'utf8');
  const end='  setButtons();\n  showFields();\n  showNavigation();\n})();';
  assert.ok(src.endsWith(end+'\n'));
  const patched=src.replace(end,
    '  window.__qa={install(pages,nav){state=pages;navState=nav;'+
    'showFields();showNavigation();setButtons();},'+
    'snapshot(){return {state,navState};}};\n'+end);
  const nodes=new Map();
  const document={
    getElementById(id){if(!nodes.has(id))nodes.set(id,fakeElement());return nodes.get(id);},
    createElement(){return fakeElement();}
  };
  let confirms=0,allow=true;
  const window={confirm(){confirms++;return allow;}};
  vm.runInNewContext(patched,{window,document,Map,Set,Array,URL},
    {filename:'editor/editor.js'});
  const pages=new Map(PAGE_PATHS.map(p=>[p,{
    source:'Fictional original',hash:SHA,
    runs:[{id:'T:0',kind:'text',value:'Original page text',original:'Original page text',
      label:'Example text',start:0,end:18}],
    edits:new Map()
  }]));
  const nav={source:'Fictional original navigation',hash:SHA,
    original:structuredClone(navOriginal),
    current:structuredClone(navOriginal)};
  window.__qa.install(pages,nav);
  return {window,nodes,pages,nav,
    approve(value){allow=value;},get confirmations(){return confirms;}};
}
function restoreUi(page,writer,review){
  const nodes=new Map();
  const document={
    getElementById(id){if(!nodes.has(id))nodes.set(id,fakeElement());return nodes.get(id);}
  };
  const resourceCalls=[];
  const window={NaxxReviewArchive:reader,NaxxEditorZip:writer,
    NaxxEditorReview:review,
    NaxxLocalPageReview:page.window.NaxxLocalPageReview,
    NaxxLocalResourceReview:{restoreDraftText(text){
      resourceCalls.push(JSON.parse(text));return true;
    }}};
  vm.runInNewContext(
    fs.readFileSync(path.join(root,'editor','review-package-reader-ui.js'),'utf8'),
    {window,document,Uint8Array,Blob,URL,setTimeout:()=>{}},
    {filename:'editor/review-package-reader-ui.js'});
  const picker=nodes.get('open-review-zip');
  return {nodes,picker,resourceCalls,
    async choose(bytes){
      picker.files=[{name:'local-private-review.zip',size:bytes.length,
        arrayBuffer:async()=>bytes.buffer.slice(
          bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}];
      return picker.listeners.change();
    },
    press(id){return nodes.get(id).click();},
    message(){return nodes.get('open-review-status').textContent;}
  };
}
async function build(draft,resources=resourceDraft(),tools=zipTools()){
  const result=await tools.review.build(draft,resources,tools.writer);
  return {bytes:new Uint8Array(await result.blob.arrayBuffer()),...tools};
}
test('actual saved ZIP reopens through real reader/UI into source-checked page editor',async()=>{
  const {bytes,writer,review}=await build(pageDraft());
  const page=pageEditor(),ui=restoreUi(page,writer,review);
  assert.equal(page.pages.get(PAGE_PATHS[0]).edits.size,0);
  await ui.choose(bytes);
  assert.equal(ui.nodes.get('restore-zip-page').disabled,false);
  assert.equal(ui.nodes.get('restore-zip-resource').disabled,false);
  ui.press('restore-zip-page');
  ui.press('restore-zip-resource');
  assert.equal(page.pages.get(PAGE_PATHS[0]).edits.get('T:0'),
    'ZIP restored page text');
  assert.equal(page.nav.current.pages[0].label,
    'Review ZIP proposed navigation');
  assert.equal(ui.resourceCalls.length,1);
  assert.equal(ui.resourceCalls[0].changes[0].index,0);
  assert.match(ui.message(),/Nothing was published/);
  assert.equal(page.confirmations,0);
});
test('outdated-source ZIP cannot overwrite existing edits or navigation',async()=>{
  const tools=zipTools(),draft=pageDraft();
  draft.files[0].sourceSha256='b'.repeat(64); // shape-valid, wrong source
  const {bytes}=await build(draft,resourceDraft(),tools);
  const page=pageEditor(),ui=restoreUi(page,tools.writer,tools.review);
  page.pages.get(PAGE_PATHS[0]).edits.set('T:0','Unsaved current edit');
  page.nav.current.pages[0].label='Current unsaved navigation';
  await ui.choose(bytes);
  assert.equal(ui.nodes.get('restore-zip-page').disabled,false);
  ui.press('restore-zip-page');
  assert.equal(page.pages.get(PAGE_PATHS[0]).edits.get('T:0'),
    'Unsaved current edit');
  assert.equal(page.nav.current.pages[0].label,
    'Current unsaved navigation');
  assert.equal(page.confirmations,0);
  assert.match(ui.message(),/could not be restored/);
});
test('cancelling authentic ZIP restoration preserves newer local edits',async()=>{
  const tools=zipTools(),{bytes}=await build(pageDraft(),resourceDraft(),tools);
  const page=pageEditor(),ui=restoreUi(page,tools.writer,tools.review);
  page.pages.get(PAGE_PATHS[0]).edits.set('T:0','Keep unsaved work');
  page.approve(false);
  await ui.choose(bytes);
  ui.press('restore-zip-page');
  assert.equal(page.confirmations,1);
  assert.equal(page.pages.get(PAGE_PATHS[0]).edits.get('T:0'),'Keep unsaved work');
  assert.match(ui.message(),/cancelled/);
});
test('damaged ZIP cannot enable either restore button or replace local edits',async()=>{
  const tools=zipTools(),{bytes}=await build(pageDraft(),resourceDraft(),tools);
  const page=pageEditor(),ui=restoreUi(page,tools.writer,tools.review);
  page.pages.get(PAGE_PATHS[0]).edits.set('T:0','Safe local work');
  const corrupted=new Uint8Array(bytes);
  corrupted[corrupted.length-23]^=1; // breaks the central directory/ZIP end
  await ui.choose(corrupted);
  assert.equal(ui.nodes.get('restore-zip-page').disabled,true);
  assert.equal(ui.nodes.get('restore-zip-resource').disabled,true);
  ui.press('restore-zip-page');
  assert.equal(page.pages.get(PAGE_PATHS[0]).edits.get('T:0'),'Safe local work');
  assert.equal(page.confirmations,0);
  assert.match(ui.message(),/could not be verified/);
});

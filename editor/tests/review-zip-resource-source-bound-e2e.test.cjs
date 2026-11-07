'use strict';
/* Real local ZIP build/inspect/UI -> real resource-title UI and source-bound
 * resource draft restore. A synthetic already-verified 414-record model is
 * injected; this does NOT replace full 31 MB source verification.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..','..');
const engine=require('../resource-title-core.js');
const inspector=require('../review-package-reader.js');
const BASE=engine.BASE_SHA;
function tools(){
  const scope={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,Set,Array,
    crypto:webcrypto,document:{getElementById(){return null;}}};
  for(const script of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(path.join(root,'editor',script),'utf8'),
      scope,{filename:script});
  return {writer:scope.NaxxEditorZip,review:scope.NaxxEditorReview};
}
const sourceModel=()=>({
  baselineSha256:BASE,
  resources:Array.from({length:414},(_,i)=>({
    index:i,id:'fictional-'+i,title:'Original fictional '+i,
    content:'Original fictional content '+i+'\n\nSecond paragraph.',
    section:'Fictional category',protectedMeta:{customKey:'unchanged-'+i}
  }))
});
function elt(id=''){
  return {id,handlers:{},files:[],children:[],value:'',textContent:'',
    disabled:true,hidden:true,classList:{toggle(){}},style:{},
    addEventListener(name,fn){this.handlers[name]=fn;},
    click(){return this.handlers.click?.();},
    appendChild(child){this.children.push(child);return child;},
    append(){},replaceChildren(){this.children=[];},
    remove(){},removeAttribute(){},setAttribute(){}
  };
}
function resourceEditor({loaded=true,sourceSha=BASE}={}){
  const nodes=new Map(),model=sourceModel();
  model.baselineSha256=sourceSha;
  const document={
    getElementById(id){if(!nodes.has(id))nodes.set(id,elt(id));return nodes.get(id);},
    createElement(tag){return elt(tag);}
  };
  const engineProxy={...engine,open:async()=>model};
  let approval=true,confirmations=0;
  const window={NaxxResourceTitles:engineProxy,crypto:{},
    confirm(){confirmations++;return approval;}};
  vm.runInNewContext(fs.readFileSync(
    path.join(root,'editor','resource-title-ui.js'),'utf8'),
    {window,document,URL:{createObjectURL(){return 'blob:fake';},revokeObjectURL(){}},
      Blob,setTimeout:()=>{}},{filename:'editor/resource-title-ui.js'});
  const load=async()=>{
    const picker=nodes.get('resource-source-file');
    picker.files=[{name:'site-content.html',size:engine.BASE_LENGTH,
      text:async()=>'<fictional source provided to a mocked verifier>'}];
    await picker.handlers.change();
  };
  return {model,window,nodes,load:loaded?load:async()=>{},
    approve(v){approval=v;},get confirmations(){return confirmations;},
    press(id){return nodes.get(id).handlers.click?.();},
    value(id){return nodes.get(id).value;},
    status(){return nodes.get('resource-status').textContent;}
  };
}
function zipUi(editor,writer,review){
  const nodes=new Map();
  const document={getElementById(id){
    if(!nodes.has(id))nodes.set(id,elt(id));return nodes.get(id);
  }};
  const window={
    NaxxReviewArchive:inspector,NaxxEditorZip:writer,NaxxEditorReview:review,
    NaxxLocalResourceReview:editor.window.NaxxLocalResourceReview,
    NaxxLocalPageReview:{restoreDraftText(){throw Error('No page restoration in resource test.');}}
  };
  vm.runInNewContext(fs.readFileSync(
    path.join(root,'editor','review-package-reader-ui.js'),'utf8'),
    {window,document,Uint8Array,Blob,URL,setTimeout:()=>{}},
    {filename:'editor/review-package-reader-ui.js'});
  return {nodes,
    async choose(bytes){
      const picker=nodes.get('open-review-zip');
      picker.files=[{name:'local-review.zip',size:bytes.byteLength,
        arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,
          bytes.byteOffset+bytes.byteLength)}];
      return picker.handlers.change();
    },
    restore(){return nodes.get('restore-zip-resource').handlers.click();},
    message(){return nodes.get('open-review-status').textContent;}
  };
}
function resourceDraft(changes=[
  {index:0,title:'Private recovery title',
    content:'Fictional revised content.\n\nSecond paragraph.'},
  {index:413,content:'Last fictional resource updated in local draft.'}
]){
  return {format:'naxx-local-resource-draft-v2',
    baselineSha256:BASE,changes};
}
async function archive(draft=resourceDraft()){
  const {writer,review}=tools();
  const built=await review.build(null,draft,writer);
  return {writer,review,bytes:new Uint8Array(await built.blob.arrayBuffer())};
}
test('real ZIP reader restores resource titles/multiline content at first and last index without changing custom metadata',async()=>{
  const {writer,review,bytes}=await archive(),editor=resourceEditor();
  await editor.load();
  const before=JSON.stringify(editor.model.resources);
  const ui=zipUi(editor,writer,review);
  await ui.choose(bytes);
  assert.equal(ui.nodes.get('restore-zip-resource').disabled,false);
  assert.equal(ui.nodes.get('restore-zip-page').disabled,true);
  ui.restore();
  assert.equal(editor.value('resource-title-edit'),'Private recovery title');
  assert.equal(editor.value('resource-content-edit'),
    'Fictional revised content.\n\nSecond paragraph.');
  assert.equal(editor.model.resources[413].title,'Original fictional 413');
  assert.equal(JSON.stringify(editor.model.resources),before,
    'The original 414-record model and protected fields must not be mutated');
  assert.match(editor.nodes.get('resource-count').textContent,/1 title edits and 2 content edits/);
  assert.match(ui.message(),/Nothing was published/);
  assert.equal(editor.confirmations,0);
});
test('resource recovery refuses a model with a mismatched source fingerprint before any edits change',async()=>{
  const {writer,review,bytes}=await archive();
  const editor=resourceEditor({sourceSha:'b'.repeat(64)});
  await editor.load();
  const first=editor.model.resources[0].title;
  const ui=zipUi(editor,writer,review);await ui.choose(bytes);ui.restore();
  assert.equal(editor.value('resource-title-edit'),first);
  assert.equal(editor.confirmations,0);
  assert.match(ui.message(),/could not be restored/);
});
test('cancelling resource ZIP restoration keeps already-applied and typed but unapplied changes',async()=>{
  const {writer,review,bytes}=await archive();
  const editor=resourceEditor();await editor.load();
  editor.nodes.get('resource-title-edit').value='Current local title';
  editor.press('resource-apply');
  editor.nodes.get('resource-content-edit').value='Not yet applied content';
  editor.approve(false);
  const ui=zipUi(editor,writer,review);await ui.choose(bytes);ui.restore();
  assert.equal(editor.confirmations,1);
  assert.equal(editor.value('resource-title-edit'),'Current local title');
  assert.equal(editor.value('resource-content-edit'),'Not yet applied content');
  assert.match(editor.nodes.get('resource-count').textContent,/1 title edits/);
  assert.match(ui.message(),/cancelled/);
});
test('resource editor cannot restore ZIP draft until original source is selected',async()=>{
  const {writer,review,bytes}=await archive(),editor=resourceEditor({loaded:false});
  const ui=zipUi(editor,writer,review);await ui.choose(bytes);ui.restore();
  assert.match(ui.message(),/could not be restored/);
  assert.equal(editor.confirmations,0);
});
test('damaged review ZIP disables resource restore and preserves existing edits',async()=>{
  const {writer,review,bytes}=await archive(),editor=resourceEditor();
  await editor.load();
  editor.nodes.get('resource-title-edit').value='Keep this local title';
  editor.press('resource-apply');
  const edited=new Uint8Array(bytes);
  edited[edited.length-23]^=1;
  const ui=zipUi(editor,writer,review);await ui.choose(edited);
  assert.equal(ui.nodes.get('restore-zip-resource').disabled,true);
  assert.equal(ui.nodes.get('restore-zip-page').disabled,true);
  assert.equal(editor.value('resource-title-edit'),'Keep this local title');
  assert.match(ui.message(),/could not be verified/);
});

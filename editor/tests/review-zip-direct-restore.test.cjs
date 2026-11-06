'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.resolve(__dirname,'..',
  'review-package-reader-ui.js'),'utf8');
function harness({response=true,throwPage=false}={}){
  const nodes=new Map(),actions=[];
  function element(id){
    return {
      id,disabled:true,value:'',files:[],textContent:'',
      classList:{toggle(){}},listeners:{},
      addEventListener(name,fn){this.listeners[name]=fn;},
      click(){if(this.listeners.click)return this.listeners.click();}
    };
  }
  for(const name of ['open-review-zip','open-review-status',
    'recover-page-draft','recover-resource-draft',
    'restore-zip-page','restore-zip-resource'])
    nodes.set(name,element(name));
  const document={getElementById(id){return nodes.get(id)}};
  const window={
    NaxxReviewArchive:{
      MAX_ARCHIVE:20*1024*1024,
      inspect:async()=>({
        hasPageDraft:true,hasResourceDraft:true,
        pageDraftText:'{"type":"pages"}',
        resourceDraftText:'{"type":"resources"}'
      })
    },
    NaxxEditorZip:{},NaxxEditorReview:{},
    NaxxLocalPageReview:{restoreDraftText(text){
      actions.push(['page',text]);
      if(throwPage)throw Error('Source did not match');
      return response;
    }},
    NaxxLocalResourceReview:{restoreDraftText(text){
      actions.push(['resource',text]);
      return response;
    }}
  };
  vm.runInNewContext(script,{window,document,Uint8Array,Blob,URL,
    setTimeout:()=>{}},{filename:'editor/review-package-reader-ui.js'});
  const picker=nodes.get('open-review-zip');
  picker.files=[{name:'private.zip',size:100,
    arrayBuffer:async()=>new Uint8Array(100).buffer}];
  return {nodes,window,actions,picker};
}
test('ZIP source-checked direct restore reaches local editor without downloading files',async()=>{
  const h=harness();
  await h.picker.listeners.change();
  const page=h.nodes.get('restore-zip-page'),
    resource=h.nodes.get('restore-zip-resource');
  assert.equal(page.disabled,false);
  assert.equal(resource.disabled,false);
  page.click();
  resource.click();
  assert.deepEqual(h.actions,[['page','{"type":"pages"}'],
    ['resource','{"type":"resources"}']]);
  assert.match(h.nodes.get('open-review-status').textContent,
    /Nothing was published/);
});
test('cancelled direct restore preserves existing editor data and reports cancellation',async()=>{
  const h=harness({response:false});
  await h.picker.listeners.change();
  h.nodes.get('restore-zip-page').click();
  assert.equal(h.actions.length,1);
  assert.match(h.nodes.get('open-review-status').textContent,
    /cancelled/);
});
test('missing/mismatched original page source cannot be mistaken for restored draft',async()=>{
  const h=harness({throwPage:true});
  await h.picker.listeners.change();
  h.nodes.get('restore-zip-page').click();
  assert.match(h.nodes.get('open-review-status').textContent,
    /could not be restored/);
  delete h.window.NaxxLocalResourceReview;
  h.nodes.get('restore-zip-resource').click();
  assert.match(h.nodes.get('open-review-status').textContent,
    /Load the original source files/);
});
test('loading a new ZIP invalidates prior direct restore actions',async()=>{
  const h=harness();
  await h.picker.listeners.change();
  assert.equal(h.nodes.get('restore-zip-page').disabled,false);
  h.picker.files=[{name:'other.txt',size:100}];
  await h.picker.listeners.change();
  assert.equal(h.nodes.get('restore-zip-page').disabled,true);
  assert.equal(h.nodes.get('restore-zip-resource').disabled,true);
});
test('direct restore is restricted to source-checked local draft interfaces',()=>{
  const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  assert.match(html,/id="restore-zip-page"/);
  assert.match(html,/id="restore-zip-resource"/);
  assert.match(script,/source\.restoreDraftText\(text\)/);
  assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|github\.com\/api|git\s+push|localStorage\.setItem/);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'editor','index.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'editor','resource-title-ui.js'),'utf8');
const engine=require('../resource-title-core.js');

test('resource-title screen is a separate offline draft panel, without an upload or publish action',()=>{
  for(const id of ['resource-source-file','resource-status','resource-controls',
    'resource-search','resource-choice','resource-title-edit','resource-save-draft',
    'resource-load-draft','resource-draft-file','resource-clear','resource-revert',
    'resource-apply','resource-count','resource-result-count','resource-selected-caption'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.ok(html.includes('resource-title-core.js'));
  assert.ok(html.includes('resource-title-ui.js'));
  assert.ok(html.indexOf('resource-title-core.js')<html.indexOf('resource-title-ui.js'));
  assert.ok(!ui.includes('fetch('));
  assert.ok(!ui.includes('XMLHttpRequest'));
  assert.ok(!ui.includes('localStorage'));
  assert.ok(!ui.includes('innerHTML'));
  assert.ok(!/\.writeText\s*\(/.test(ui));
  assert.ok(html.includes('separate'));
});

function harness(){
  const listeners=new Map(),nodes=new Map(),downloads=[];
  function node(id){
    const handlers={};
    return {
      id:id||'',listeners:handlers,files:[],children:[],value:'',textContent:'',
      disabled:true,hidden:false,href:'',download:'',classList:{toggle(){}},
      addEventListener(type,listener){handlers[type]=listener;},
      appendChild(child){this.children.push(child);return child;},
      replaceChildren(){this.children=[];},
      remove(){},click(){ if(this.download)downloads.push({filename:this.download,href:this.href});},
      setAttribute(){},
    };
  }
  const ids=[
    'resource-source-file','resource-draft-file','resource-search','resource-choice',
    'resource-title-edit','resource-controls','resource-status',
    'resource-apply','resource-revert','resource-save-draft','resource-load-draft',
    'resource-clear','resource-count','resource-result-count','resource-selected-caption'
  ];
  for(const id of ids)nodes.set(id,node(id));
  nodes.get('resource-draft-file').click=function(){this.filePickerClicked=true;};
  const body=node('body');
  const document={getElementById(id){return nodes.get(id)||null;},
    createElement(type){return node(type);},body};
  const resources=Array.from({length:414},(_,index)=>({
    index,id:'test-'+index,title:'Resource '+index,section:'Test Section'
  }));
  const verified={baselineSha256:engine.BASE_SHA,resources};
  const core={...engine,open:async()=>verified};
  const window={
    NaxxResourceTitles:core,crypto:{},
    confirm:()=>true
  };
  const urls={createObjectURL(blob){this.blob=blob;return 'blob:local-resource-draft';},
    revokeObjectURL(){}};
  vm.runInNewContext(ui,{window,document,URL:urls,Blob,setTimeout:()=>{}},
    {filename:'editor/resource-title-ui.js'});
  return {window,document,urls,downloads,nodes};
}

test('a verified source populates resource controls and exports just changed-title JSON',async()=>{
  const h=harness(),get=id=>h.nodes.get(id);
  assert.equal(get('resource-controls').hidden,true);
  get('resource-source-file').files=[{
    name:'site-content.html',size:engine.BASE_LENGTH,text:async()=>'<verified source bytes>'
  }];
  await get('resource-source-file').listeners.change();
  assert.equal(get('resource-controls').hidden,false);
  assert.equal(get('resource-choice').children.length,414);
  assert.match(get('resource-count').textContent,/414 resources loaded/);
  get('resource-title-edit').value='New Sample Title';
  get('resource-apply').listeners.click();
  assert.match(get('resource-count').textContent,/1 title edits/);
  get('resource-save-draft').listeners.click();
  assert.equal(h.downloads.length,1);
  assert.equal(h.downloads[0].filename,'naxxramas-resource-title-draft.json');
  const json=JSON.parse(await h.urls.blob.text());
  assert.equal(json.baselineSha256,engine.BASE_SHA);
  assert.deepEqual(json.changes,[{index:0,title:'New Sample Title'}]);
  assert.equal(json.content,undefined);
  assert.equal(json.resources,undefined);
  assert.match(get('resource-status').textContent,/does not change the website or GitHub/);
});
test('unsafe proposed titles cannot be applied and clearing requires confirmation',async()=>{
  const h=harness(),get=id=>h.nodes.get(id);
  get('resource-source-file').files=[{name:'site-content.html',size:engine.BASE_LENGTH,text:async()=>'<verified>'}];
  await get('resource-source-file').listeners.change();
  get('resource-title-edit').value='<script>not allowed</script>';
  get('resource-apply').listeners.click();
  assert.match(get('resource-status').textContent,/Titles must be/);
  assert.match(get('resource-count').textContent,/0 title edits/);
  get('resource-title-edit').value='Safe Revised Title';
  get('resource-apply').listeners.click();
  assert.match(get('resource-count').textContent,/1 title edits/);
  h.window.confirm=()=>false;
  get('resource-clear').listeners.click();
  assert.match(get('resource-count').textContent,/1 title edits/);
  h.window.confirm=()=>true;
  get('resource-clear').listeners.click();
  assert.match(get('resource-count').textContent,/0 title edits/);
});
test('wrong local file cannot overwrite an already verified editing session',async()=>{
  const h=harness(),get=id=>h.nodes.get(id);
  const picker=get('resource-source-file');
  picker.files=[{name:'site-content.html',size:engine.BASE_LENGTH,text:async()=>'<verified>'}];
  await picker.listeners.change();
  get('resource-title-edit').value='Safe Draft Change';
  get('resource-apply').listeners.click();
  picker.files=[{name:'index.html',size:100,text:async()=>'<unverified>'}];
  await picker.listeners.change();
  assert.match(get('resource-status').textContent,/Select the original site-content.html/);
  assert.match(get('resource-count').textContent,/1 title edits/);
});

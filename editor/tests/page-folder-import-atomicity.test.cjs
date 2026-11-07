'use strict';
/* Local page-folder imports: last selection wins, no discarded edits or remote writes. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const original=fs.readFileSync(path.resolve(__dirname,'..','editor.js'),'utf8');
const tail='  setButtons();\n  showFields();\n  showNavigation();\n})();';
assert.ok(original.endsWith(tail+'\n'));
const hooked=original.replace(tail,
  '  window.__folderImportTest={snapshot:()=>({state,navState})};\n'+tail);
const paths=['new-players/content.html','rules/content.html',
  'apply/content.html','game-clients/content.html'];
function nav(label){
  return {format:'naxx-navigation-v1',pages:[
    {slug:'new-players',group:'General',label:'New Players '+label,
      title:'Welcome',intro:'New players',icon:'inv_misc_book_09.jpg'},
    {slug:'rules',group:'General',label:'Rules',
      title:'Rules',intro:'Server rules',icon:'inv_misc_note_05.jpg'},
    {slug:'apply',group:'General',label:'Apply',
      title:'Apply',intro:'Application',icon:'inv_misc_key_03.jpg'}
  ]};
}
const html=label=>'<div>'+Array.from({length:12},(_,i)=>
  '<p>Page '+label+' content line '+i+'</p>').join('')+'</div>';
function folder(label,firstText){
  return [
    ...paths.map((p,i)=>({
      name:'content.html',webkitRelativePath:'root/'+p,
      text:i===0&&firstText?firstText:async()=>html(label)
    })),
    {name:'navigation.json',webkitRelativePath:'root/content/navigation.json',
      text:async()=>JSON.stringify(nav(label))}
  ];
}
function harness(){
  const nodes=new Map();
  function fake(){
    return {handlers:{},value:'',textContent:'',disabled:false,hidden:true,
      checked:false,style:{},classList:{toggle(){}},
      addEventListener(name,fn){this.handlers[name]=fn;},
      append(){},appendChild(){},replaceChildren(){},
      removeAttribute(){},click(){},remove(){}};
  }
  const document={
    getElementById(id){if(!nodes.has(id))nodes.set(id,fake());return nodes.get(id);},
    createElement(name){
      const e=fake();
      if(name==='textarea')Object.defineProperty(e,'innerHTML',{
        set(value){this.value=value;}
      });
      return e;
    }
  };
  let confirms=0,approve=false;
  const window={confirm(){confirms++;return approve;}};
  vm.runInNewContext(hooked,{window,document,URL,Map,Set,Array,
    NaxxEditorZip:{sha256:async()=> 'a'.repeat(64)}},
  {filename:'editor/editor.js'});
  const picker=nodes.get('folder'),status=nodes.get('status');
  async function select(files){
    picker.files=files;picker.value='selected';
    return await picker.handlers.change();
  }
  return {window,nodes,picker,status,select,
    get confirms(){return confirms;},
    approve(v){approve=v;},
    snapshot:()=>window.__folderImportTest.snapshot()
  };
}
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
test('older folder read cannot overwrite newer chosen pages and navigation',async()=>{
  const h=harness(),first=deferred();
  const old=h.select(folder('OLD',()=>first.promise));
  const latest=h.select(folder('NEW'));
  await latest;
  assert.match(h.snapshot().state.get(paths[0]).source,/Page NEW content/);
  assert.equal(h.snapshot().navState.current.pages[0].label,'New Players NEW');
  const message=h.status.textContent;
  first.resolve(html('OLD'));
  await old;
  assert.match(h.snapshot().state.get(paths[0]).source,/Page NEW content/);
  assert.equal(h.snapshot().navState.current.pages[0].label,'New Players NEW');
  assert.equal(h.status.textContent,message);
  assert.equal(h.confirms,0);
});
test('edits made during source reading require consent at commit time',async()=>{
  const h=harness();
  await h.select(folder('BASE'));
  const pending=deferred();
  const loading=h.select(folder('INCOMING',()=>pending.promise));
  const page=h.snapshot().state.get(paths[0]);
  page.edits.set(page.runs[0].id,'Unsaved while loading');
  h.snapshot().navState.current.pages[1].label='Unsaved navigation';
  pending.resolve(html('INCOMING'));
  await loading;
  assert.equal(h.confirms,1);
  assert.match(h.snapshot().state.get(paths[0]).source,/Page BASE content/);
  assert.equal(h.snapshot().state.get(paths[0]).edits.get(page.runs[0].id),
    'Unsaved while loading');
  assert.equal(h.snapshot().navState.current.pages[1].label,'Unsaved navigation');
  assert.match(h.status.textContent,/cancelled/);
});
test('explicit permission commits complete replacement only after verification',async()=>{
  const h=harness();
  await h.select(folder('BASE'));
  h.approve(true);
  const old=h.snapshot().state.get(paths[0]);
  old.edits.set(old.runs[0].id,'Draft before selection');
  const pending=deferred();
  const change=h.select(folder('NEW',()=>pending.promise));
  pending.resolve(html('NEW'));
  await change;
  assert.equal(h.confirms,1);
  assert.match(h.snapshot().state.get(paths[0]).source,/Page NEW content/);
  assert.equal(h.snapshot().state.get(paths[0]).edits.size,0);
  assert.equal(h.snapshot().navState.current.pages[0].label,'New Players NEW');
});
test('failed old load cannot erase a newer successful folder or message',async()=>{
  const h=harness(),oldRead=deferred();
  const old=h.select(folder('OLD',()=>oldRead.promise));
  await h.select(folder('NEW'));
  const message=h.status.textContent;
  oldRead.reject(Error('Old selected file could not be read'));
  await old;
  assert.match(h.snapshot().state.get(paths[0]).source,/Page NEW content/);
  assert.equal(h.status.textContent,message);
});
test('bad newest folder is refused without losing source or edits',async()=>{
  const h=harness();
  await h.select(folder('BASE'));
  const previous=h.snapshot().state;
  previous.get(paths[0]).edits.set(previous.get(paths[0]).runs[0].id,
    'Retain this edit');
  await h.select(folder('BROKEN').slice(0,4)); // missing navigation.json
  assert.equal(h.snapshot().state,previous);
  assert.equal(h.snapshot().state.get(paths[0]).edits.size,1);
  assert.match(h.status.textContent,/Folder not loaded/);
});
test('folder refresh has no network, automatic publication or credential operations',()=>{
  assert.doesNotMatch(original,/fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|localStorage\.setItem/);
  assert.match(original,/ticket !== folderLoadRevision/);
  assert.match(original,/selected = Array\.from\(filePicker\.files \|\| \[\]\)/);
  assert.match(original,/Replace your current unsaved page and navigation edits with this folder/);
});

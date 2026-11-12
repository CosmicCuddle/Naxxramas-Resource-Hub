'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {locateData,prepareSavedSource,localPreview,sameShell}=require('./native-save-core.cjs');
const {REPO,SOURCE,blobOid,gitRootTreeOid,allowed,createStore}=require('./github-native-store.cjs');
const {createOriginalServer}=require('./original-editor-server.cjs');
const root=path.resolve(__dirname,'..','..'),BASE='5064a9d3cadb7071caa1d0f67e43f87d4b591043';
const original=fs.readFileSync(path.join(root,SOURCE),'utf8');
const sha=x=>blobOid(Buffer.from(x,'utf8'));
const api='/repos/'+REPO;

test('actual original 31MB website: one native-data edit preserves every other value and the entire HTML shell',()=>{
  const before=locateData(original);
  assert.equal(before.data.resources.length,414);
  assert.equal(before.data.dungeonHandbooks.length,29);
  assert.equal(Object.keys(before.data).length,27);
  const unchanged=prepareSavedSource(original,JSON.stringify(before.data));
  assert.equal(unchanged.changed,false);
  assert.equal(unchanged.html,original);
  const next=JSON.parse(JSON.stringify(before.data));
  next.resources[0].title='Fictional original editor Save check';
  const saved=prepareSavedSource(original,JSON.stringify(next));
  assert.equal(saved.changed,true);
  assert.equal(sameShell(original,saved.html),true);
  assert.deepEqual(locateData(saved.html).data,next);
  assert.equal(locateData(saved.html).data.resources.length,414);
  assert.equal(sha(original),'71ab9f2bf4cf12282fcbe135f7ec787805715b62');
  const preview=localPreview(original);
  assert.equal(locateData(preview).data.resources.length,414);
  assert.equal(preview.slice(locateData(preview).from,locateData(preview).to),
    original.slice(before.from,before.to));
  assert.equal((preview.match(/onclick="exportUpdatedHtml\(\)">Save to GitHub/g)||[]).length,3);
  assert.match(preview,/return window\.NaxxOriginalEditorSave\(DATA\)/);
  assert.match(preview,/__naxxExportUpdatedHtmlBeforePlayerbotPage/);
  assert.match(preview,/__naxxExportUpdatedHtmlBeforePatchesGithub/);
});
test('native add/delete and custom fields are retained; password changes and lost fields are refused',()=>{
  const data=locateData(original).data;
  data.resources.push({id:'fictional-private-test-id',title:'New test record',customMetadata:{a:[1,2,3]}});
  const added=prepareSavedSource(original,JSON.stringify(data));
  assert.equal(locateData(added.html).data.resources.length,415);
  assert.equal(sameShell(original,added.html),true);
  data.resources.pop();
  data.resources.shift();
  const deleted=prepareSavedSource(original,JSON.stringify(data));
  assert.equal(locateData(deleted.html).data.resources.length,413);
  const copy=locateData(original).data;
  copy.adminPassword='fictional-changed-password';
  assert.throws(()=>prepareSavedSource(original,JSON.stringify(copy)),/Admin password changes/);
  delete copy.playerbotInformation;
  assert.throws(()=>prepareSavedSource(original,JSON.stringify(copy)),/missing or incompatible/);
});
test('HTML script delimiters in edited data are safely encoded and exactly decoded',()=>{
  const data=locateData(original).data;
  const text='test </script><script>fictional</script><!-- comment';
  data.resources[0].title=text;
  const saved=prepareSavedSource(original,JSON.stringify(data));
  assert.equal(locateData(saved.html).data.resources[0].title,text);
  const x=locateData(saved.html);
  assert.doesNotMatch(saved.html.slice(x.from,x.to),/<\/?script\b|<!--/i);
  assert.equal(sameShell(original,saved.html),true);
});
test('Git root tree hash independently matches actual original main',()=>{
  const tree=execFileSync('git',['ls-tree','-z',BASE],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).map(line=>{
    const m=/^([0-9]+) (blob|tree|commit) ([a-f0-9]{40})\t(.+)$/.exec(line);
    assert.ok(m);return {mode:m[1],type:m[2],sha:m[3],path:m[4]};
  });
  const expected=execFileSync('git',['rev-parse',BASE+'^{tree}'],{cwd:root,encoding:'utf8'}).trim();
  assert.equal(gitRootTreeOid(tree),expected);
});
function fixture(){
  const initial={siteTitle:'Original test',adminPassword:'fictional-only',resources:[{id:1,title:'One',custom:{x:1}}],
    dungeonHandbooks:[{id:1}],extra:{keep:true}};
  const html='<!doctype html><html><body>'+
    '<button onclick="exportUpdatedHtml()">⬇ Export Updated HTML</button>'+
    '<button onclick="exportUpdatedHtml()">⬇ Export Updated HTML</button>'+
    '<button onclick="exportUpdatedHtml()">⬇ Download Updated Naxxramas HTML</button>'+
    '<p>It downloads a new copy of this HTML file containing all of your changes. Replace the old website HTML with the newly downloaded one.</p>'+
    '<script id="embedded-data">window.NAXX_DATA = '+JSON.stringify(initial)+';</script>'+
    '<script>\nlet unlocked = false;\nlet DATA = JSON.parse(JSON.stringify(window.NAXX_DATA));\n'+
    'function exportUpdatedHtml(){\nconst clone = document.documentElement.cloneNode(true);\nJSON.stringify(DATA);\n}\n\ninit();\n</script></body></html>';
  return {html,initial,index:'<!doctype html><html><body>Original loader fixture</body></html>'};
}
function remoteFixture(f){
  const branch='editor-saves/native-'+BASE.slice(0,12),main=BASE;
  const blobs=new Map([[sha(f.html),Buffer.from(f.html)],[sha(f.index),Buffer.from(f.index)]]);
  const treeEntries=[{path:SOURCE,type:'blob',mode:'100644',sha:sha(f.html)},
    {path:'index.html',type:'blob',mode:'100644',sha:sha(f.index)},
    {path:'assets',type:'tree',mode:'040000',sha:'d'.repeat(40)}];
  const firstTree={sha:gitRootTreeOid(treeEntries),truncated:false,tree:treeEntries};
  const trees=new Map([[firstTree.sha,firstTree]]);
  const commits=new Map([[main,{sha:main,tree:{sha:firstTree.sha},parents:[]}]]);
  let head=null,pr=false,counter=0,mainHead=main,failRef=false;
  const calls=[];
  async function request(method,p,payload,raw,allowMissing){
    calls.push({method,p,payload});
    assert.equal(allowed(method,p),true);
    if(method==='GET'&&p===api)return {full_name:REPO,private:false,archived:false,disabled:false,
      default_branch:'main',permissions:{push:true},node_id:'R_fictional'};
    if(method==='GET'&&p===api+'/git/ref/heads/main')
      return {ref:'refs/heads/main',object:{type:'commit',sha:mainHead}};
    if(method==='GET'&&p===api+'/git/ref/heads/'+branch)
      return head?{ref:'refs/heads/'+branch,object:{type:'commit',sha:head}}:null;
    if(method==='GET'&&p.includes('/git/commits/'))return commits.get(p.split('/').pop());
    if(method==='GET'&&p.includes('/git/trees/'))return trees.get(p.split('/').pop().split('?')[0]);
    if(method==='GET'&&p.includes('/git/blobs/'))return blobs.get(p.split('/').pop());
    if(method==='GET'&&p.includes('/compare/'))return {status:'ahead',behind_by:0,merge_base_commit:{sha:main}};
    if(method==='POST'&&p===api+'/git/blobs'){
      const b=Buffer.from(payload.content,'base64'),id=blobOid(b);blobs.set(id,b);return {sha:id};
    }
    if(method==='POST'&&p===api+'/git/trees'){
      assert.deepEqual(payload.tree.map(x=>x.path),[SOURCE]);
      const es=trees.get(payload.base_tree).tree.map(x=>x.path===SOURCE?payload.tree[0]:x);
      const t={sha:gitRootTreeOid(es),truncated:false,tree:es};trees.set(t.sha,t);return {sha:t.sha};
    }
    if(method==='POST'&&p===api+'/git/commits'){
      const id=(++counter===1?'b':'c').repeat(40);
      const c={sha:id,tree:{sha:payload.tree},parents:payload.parents.map(x=>({sha:x}))};
      commits.set(id,c);return c;
    }
    if(method==='POST'&&p===api+'/git/refs'){
      assert.equal(payload.ref,'refs/heads/'+branch);assert.equal(head,null);
      head=payload.sha;
      if(failRef)throw Error('fictional lost reply after write');
      return {ref:payload.ref,object:{type:'commit',sha:head}};
    }
    if(method==='POST'&&p==='/graphql'){
      const i=payload.variables.input,u=i.refUpdates[0];
      assert.equal(u.name,'refs/heads/'+branch);
      assert.equal(u.beforeOid,head);assert.equal(u.force,false);
      head=u.afterOid;
      return {data:{updateRefs:{clientMutationId:i.clientMutationId}}};
    }
    const pull=()=>({number:42,state:'open',draft:true,
      head:{ref:branch,sha:head,repo:{full_name:REPO}},base:{ref:'main',repo:{full_name:REPO}}});
    if(method==='GET'&&p.includes('/pulls?'))return pr?[pull()]:[];
    if(method==='POST'&&p===api+'/pulls'){
      assert.equal(payload.base,'main');assert.equal(payload.head,branch);
      assert.equal(payload.draft,true);pr=true;return pull();
    }
    throw Error('Unexpected fictional API route.');
  }
  return {store:createStore(request),calls,get head(){return head;},blobs,
    changeMain(){mainHead='f'.repeat(40);},loseRefReply(){failRef=true;}};
}
test('first Save creates one review branch; repeated Save updates the same PR and changes only site-content.html',async()=>{
  const f=fixture(),remote=remoteFixture(f),s=await remote.store.open();
  assert.equal(s.existing,false);
  f.initial.resources[0].title='First fictional edit';
  const one=prepareSavedSource(f.html,JSON.stringify(f.initial));
  const a=await remote.store.save(s,Buffer.from(one.html));
  assert.equal(a.changed,true);assert.equal(a.published,false);
  assert.equal(a.reviewUrl,'https://github.com/'+REPO+'/pull/42');
  const old=a.commit;
  f.initial.resources[0].title='Second fictional edit';
  const two=prepareSavedSource(one.html,JSON.stringify(f.initial));
  const b=await remote.store.save(s,Buffer.from(two.html));
  assert.notEqual(b.commit,old);assert.equal(b.reviewUrl,a.reviewUrl);
  assert.equal(remote.calls.filter(c=>c.method==='POST'&&c.p===api+'/git/refs').length,1);
  assert.equal(remote.calls.filter(c=>c.method==='POST'&&c.p===api+'/pulls').length,1);
  assert.equal(remote.calls.filter(c=>c.method==='POST'&&c.p==='/graphql').length,1);
  const reopened=await remote.store.open();
  assert.equal(reopened.source,sha(two.html));
  assert.equal((await remote.store.blob(reopened.source)).toString('utf8'),two.html);
  assert.equal(reopened.head,b.commit);
});
test('stale main refuses before upload and lost ref reply freezes the session',async()=>{
  const f=fixture(),a=remoteFixture(f),s=await a.store.open();
  a.changeMain();f.initial.siteTitle='Fictional stale edit';
  const bytes=Buffer.from(prepareSavedSource(f.html,JSON.stringify(f.initial)).html);
  await assert.rejects(a.store.save(s,bytes),/GitHub changed/);
  assert.equal(a.calls.filter(x=>x.method==='POST').length,0);
  const b=remoteFixture(f),t=await b.store.open();
  b.loseRefReply();
  await assert.rejects(b.store.save(t,bytes));
  assert.equal(t.uncertain,true);
  await assert.rejects(b.store.save(t,bytes),/session is unavailable/);
  assert.equal(b.calls.filter(x=>x.method==='POST'&&x.p===api+'/git/refs').length,1);
});
test('actual local server serves original controls, protects Save and saves only edited data',async()=>{
  const f=fixture(),remote=remoteFixture(f),s=await remote.store.open();
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-native-save-test-'));
  fs.writeFileSync(path.join(tmp,'index.html'),f.index);
  fs.writeFileSync(path.join(tmp,SOURCE),f.html);
  const server=createOriginalServer({root:tmp,store:remote.store,state:s,source:f.html});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal(await (await fetch(base+'/')).text(),f.index);
    const page=await (await fetch(base+'/'+SOURCE)).text();
    assert.equal((page.match(/>Save to GitHub<\/button>/g)||[]).length,3);
    const script=await (await fetch(base+'/__naxx_editor/bridge.js')).text();
    const token=script.match(/\)\("([a-f0-9]{64})"\);\s*$/)?.[1];assert.ok(token);
    f.initial.resources[0].title='Fictional HTTP Save';
    const payload=JSON.stringify(f.initial),headers={'Origin':base,
      'Content-Type':'application/json','X-Naxx-Editor-Session':token};
    let r=await fetch(base+'/__naxx_editor/save',{method:'POST',headers:{...headers,Origin:'https://wrong.invalid'},body:payload});
    assert.equal(r.status,403);
    r=await fetch(base+'/__naxx_editor/save',{method:'POST',headers:{...headers,'X-Naxx-Editor-Session':'0'.repeat(64)},body:payload});
    assert.equal(r.status,403);
    r=await fetch(base+'/__naxx_editor/save',{method:'POST',headers,body:payload});
    assert.equal(r.status,200);assert.equal((await r.json()).published,false);
    assert.equal(fs.readFileSync(path.join(tmp,SOURCE),'utf8'),f.html);
    const savedPage=await (await fetch(base+'/'+SOURCE)).text();
    assert.equal(locateData(savedPage).data.resources[0].title,'Fictional HTTP Save');
    assert.equal((await fetch(base+'/tools/original-editor/github-native-store.cjs')).status,404);
    assert.equal((await fetch(base+'/.git/config')).status,404);
    assert.equal(allowed('POST',api+'/git/refs/heads/main'),false);
    assert.equal(allowed('PUT',api+'/contents/index.html'),false);
  }finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));fs.rmSync(tmp,{recursive:true,force:true});}
});

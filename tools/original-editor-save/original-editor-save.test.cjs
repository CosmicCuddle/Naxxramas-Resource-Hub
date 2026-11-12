'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {
  REPOSITORY,WORKING_BRANCH,gitBlobSha,approvedPath,createWriter
}=require('./github-writer.cjs');
const {createServer,parseArgs,getGhToken}=require('./start-original-editor.cjs');

const MAIN='a'.repeat(40),COMMIT1='b'.repeat(40),COMMIT2='c'.repeat(40);
const TREE0='1'.repeat(40),TREE1='4'.repeat(40),TREE2='5'.repeat(40);
const INDEX='2'.repeat(40),SITE0='3'.repeat(40);

function html(marker){
  const core='<!doctype html><html><head></head><body>'+
    '<script id="embedded-data">window.NAXX_DATA = {};</script>'+
    '<script>function exportUpdatedHtml(){}</script>'+
    '<div>'+marker+'</div>';
  return Buffer.from(core+'x'.repeat(20*1024*1024-core.length+8192)+'</body></html>');
}
function fictional(){
  let head=null,nextCommit=0,nextTree=0;
  const commits=new Map([[MAIN,{sha:MAIN,tree:TREE0,parents:[]}]]);
  const trees=new Map([[TREE0,{index:INDEX,site:SITE0}]]);
  const calls=[];
  async function request({method,path:url,body}){
    calls.push({method,url,body});
    const reply=(status,value)=>({status,body:JSON.stringify(value)});
    const base='/repos/'+REPOSITORY;
    if(method==='GET'&&url===base)
      return reply(200,{full_name:REPOSITORY,archived:false,disabled:false});
    if(method==='GET'&&url===base+'/git/ref/heads/main')
      return reply(200,{ref:'refs/heads/main',object:{sha:MAIN}});
    if(method==='GET'&&url===base+'/git/ref/heads/'+WORKING_BRANCH)
      return head?reply(200,{ref:'refs/heads/'+WORKING_BRANCH,object:{sha:head}}):
        reply(404,{message:'Not Found'});
    if(method==='GET'&&url.startsWith(base+'/git/commits/')){
      const sha=url.slice((base+'/git/commits/').length),item=commits.get(sha);
      return item?reply(200,{sha:item.sha,tree:{sha:item.tree},
        parents:item.parents.map(x=>({sha:x}))}):reply(404,{message:'Not Found'});
    }
    if(method==='GET'&&url.startsWith(base+'/git/trees/')){
      const sha=url.slice((base+'/git/trees/').length),item=trees.get(sha);
      return item?reply(200,{sha,tree:[
        {path:'index.html',type:'blob',mode:'100644',sha:item.index},
        {path:'site-content.html',type:'blob',mode:'100644',sha:item.site},
        {path:'assets/keep.js',type:'blob',mode:'100644',sha:'9'.repeat(40)}
      ]}):reply(404,{message:'Not Found'});
    }
    if(method==='POST'&&url===base+'/git/blobs'){
      const bytes=Buffer.from(body.content,'base64');
      return reply(201,{sha:gitBlobSha(bytes)});
    }
    if(method==='POST'&&url===base+'/git/trees'){
      assert.equal(body.tree.length,1);
      assert.equal(body.tree[0].path,'site-content.html');
      assert.equal(body.tree[0].mode,'100644');
      assert.equal(body.tree[0].type,'blob');
      const baseEntry=trees.get(body.base_tree);
      assert.ok(baseEntry);
      const sha=nextTree++===0?TREE1:TREE2;
      trees.set(sha,{index:baseEntry.index,site:body.tree[0].sha});
      return reply(201,{sha});
    }
    if(method==='POST'&&url===base+'/git/commits'){
      assert.equal(body.parents.length,1);
      const sha=nextCommit++===0?COMMIT1:COMMIT2;
      commits.set(sha,{sha,tree:body.tree,parents:[body.parents[0]]});
      return reply(201,{sha});
    }
    if(method==='POST'&&url===base+'/git/refs'){
      assert.equal(head,null);
      assert.equal(body.ref,'refs/heads/'+WORKING_BRANCH);
      head=body.sha;return reply(201,{ref:body.ref,object:{sha:head}});
    }
    if(method==='PATCH'&&url===base+'/git/refs/heads/'+WORKING_BRANCH){
      assert.equal(body.force,false);
      head=body.sha;return reply(200,{ref:'refs/heads/'+WORKING_BRANCH,object:{sha:head}});
    }
    return reply(404,{message:'unexpected '+method+' '+url});
  }
  return {request,calls,get head(){return head;}};
}

test('writer allowlist cannot write main, index.html, workflows or arbitrary content',()=>{
  assert.equal(approvedPath('GET','/repos/'+REPOSITORY),true);
  assert.equal(approvedPath('POST','/repos/'+REPOSITORY+'/git/blobs'),true);
  assert.equal(approvedPath('PATCH','/repos/'+REPOSITORY+'/git/refs/heads/'+WORKING_BRANCH),true);
  for(const item of [
    ['PATCH','/repos/'+REPOSITORY+'/git/refs/heads/main'],
    ['PUT','/repos/'+REPOSITORY+'/contents/index.html'],
    ['PUT','/repos/'+REPOSITORY+'/contents/site-content.html'],
    ['POST','/repos/'+REPOSITORY+'/actions/workflows/x/dispatches'],
    ['DELETE','/repos/'+REPOSITORY+'/git/refs/heads/main']
  ])assert.equal(approvedPath(item[0],item[1]),false,item.join(' '));
});

test('original editor Save creates then advances one working branch while index.html stays unchanged',async()=>{
  const fake=fictional(),writer=createWriter(fake.request);
  const one=await writer.save(html('first visual-admin save'),null);
  assert.equal(one.branch,WORKING_BRANCH);
  assert.equal(one.parentCommit,MAIN);
  assert.equal(one.commit,COMMIT1);
  assert.equal(one.changedPath,'site-content.html');
  assert.equal(one.indexHtmlUnchanged,true);
  assert.equal(one.published,false);
  const two=await writer.save(html('second visual-admin save'),COMMIT1);
  assert.equal(two.parentCommit,COMMIT1);
  assert.equal(two.commit,COMMIT2);
  assert.equal(fake.head,COMMIT2);
  assert.equal(fake.calls.filter(x=>x.method==='POST'&&x.url.endsWith('/git/refs')).length,1);
  assert.equal(fake.calls.filter(x=>x.method==='PATCH').length,1);
  assert.ok(fake.calls.every(x=>!x.url.endsWith('/git/refs/heads/main')));
  for(const tree of fake.calls.filter(x=>x.method==='POST'&&x.url.endsWith('/git/trees')))
    assert.deepEqual(tree.body.tree.map(x=>x.path),['site-content.html']);
});

test('writer rejects loader HTML, injected tags and stale working heads before ref movement',async()=>{
  const fake=fictional(),writer=createWriter(fake.request);
  const bad=html('bad').toString('utf8').replace(
    '<body>','<body><script data-naxx-loader-injected="1"></script>');
  await assert.rejects(writer.save(Buffer.from(bad),null),/source format/);
  await writer.save(html('valid'),null);
  await assert.rejects(writer.save(html('stale'),'f'.repeat(40)),/changed/);
  assert.equal(fake.calls.filter(x=>x.method==='PATCH').length,0);
});

test('Save bridge captures old editor output and strips only loader-injected runtime tags',()=>{
  const bridge=fs.readFileSync(path.resolve(__dirname,'..','..','assets',
    'naxx-original-editor-save-bridge.js'),'utf8');
  const filler='x'.repeat(20*1024*1024+8192);
  const sample='<!doctype html><html><head>'+
    '<link data-naxx-loader-injected="1" rel="stylesheet" href="assets/a.css">'+
    '</head><body><script id="embedded-data">window.NAXX_DATA = {};</script>'+
    '<script>function exportUpdatedHtml(){}</script>'+
    '<script data-naxx-loader-injected="1" src="assets/a.js"></script>'+
    filler+'</body></html>';
  const context={
    SAMPLE_HTML:sample,console,
    location:{protocol:'http:',hostname:'127.0.0.1'},
    document:{querySelector(){return null;},createElement(){throw Error('not used');}},
    fetch:async()=>{throw Error('not used');},setTimeout,URL:{}
  };
  context.globalThis=context;context.window=context;
  vm.createContext(context);
  vm.runInContext(
    'function naxxCreateZipArchive(entries){return entries;}\\n'+
    'function exportUpdatedHtml(){naxxCreateZipArchive(['+
    '{name:"index.html",data:SAMPLE_HTML},'+
    '{name:"HOW_TO_UPDATE_GITHUB.txt",data:"legacy"}]);}',
    context
  );
  vm.runInContext(bridge,context);
  const captured=context.NaxxOriginalEditorSaveBridge.captureOriginalOutput();
  assert.match(captured,/window\.NAXX_DATA =/);
  assert.match(captured,/function exportUpdatedHtml/);
  assert.equal(captured.includes('data-naxx-loader-injected'),false);
  assert.equal(captured.includes('assets/a.css'),false);
  assert.equal(captured.includes('assets/a.js'),false);
  const instructions=context.NaxxOriginalEditorSaveBridge.safeInstructions();
  assert.match(instructions,/site-content\.html only/);
  assert.match(instructions,/DO NOT replace index\.html/);
});

test('local HTTP Save requires loopback origin, CSRF, protocol and pinned head',async()=>{
  let writes=0;
  const writer={
    async repositoryState(){return {main:MAIN,working:null};},
    async save(bytes,expected){
      writes++;assert.equal(expected,null);
      assert.ok(bytes.length>20*1024*1024);
      return {format:'naxx-original-editor-save-v1',repository:REPOSITORY,
        branch:WORKING_BRANCH,parentCommit:MAIN,commit:COMMIT1,
        siteContentBlob:gitBlobSha(bytes),indexHtmlUnchanged:true,
        changedPath:'site-content.html',published:false};
    }
  };
  const server=createServer({root:path.resolve(__dirname,'..','..'),writer});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const statusRes=await fetch(base+'/api/naxx-editor/status');
    assert.equal(statusRes.status,200);const status=await statusRes.json();
    assert.equal(status.ready,true);assert.equal(status.workingHead,null);
    const bytes=html('http save');
    const wrong=await fetch(base+'/api/naxx-editor/save',{method:'POST',
      headers:{Origin:'https://evil.example','Content-Type':'text/html',
        'X-Naxx-Editor-Protocol':'naxx-original-visual-editor-save-v1',
        'X-Naxx-Csrf-Token':status.csrfToken,
        'X-Naxx-Expected-Working-Head':'none'},body:bytes});
    assert.equal(wrong.status,403);assert.equal(writes,0);
    const good=await fetch(base+'/api/naxx-editor/save',{method:'POST',
      headers:{Origin:base,'Content-Type':'text/html; charset=utf-8',
        'X-Naxx-Editor-Protocol':'naxx-original-visual-editor-save-v1',
        'X-Naxx-Csrf-Token':status.csrfToken,
        'X-Naxx-Expected-Working-Head':'none'},body:bytes});
    assert.equal(good.status,200);assert.equal(writes,1);
    const result=await good.json();
    assert.equal(result.changedPath,'site-content.html');
    assert.equal(result.indexHtmlUnchanged,true);
  }finally{
    server.closeAllConnections();await new Promise(ok=>server.close(ok));
  }
});

test('launcher requires explicit action and GitHub CLI, but never Git for Windows',()=>{
  assert.throws(()=>parseArgs([]));
  assert.deepEqual(parseArgs(['--original-editor']),{originalEditor:true});
  const token=getGhToken((program,args,opts)=>{
    assert.equal(program,'gh');assert.equal(opts.shell,false);
    assert.deepEqual(args,['auth','token','--hostname','github.com']);
    return {status:0,stdout:'fictional_secure_test_token\\n'};
  });
  assert.equal(token,'fictional_secure_test_token');
  const cmd=fs.readFileSync(path.resolve(__dirname,
    'Start-Naxxramas-Original-Editor.cmd'),'utf8');
  assert.match(cmd,/where node\.exe/);
  assert.match(cmd,/where gh\.exe/);
  assert.doesNotMatch(cmd,/where git\.exe|GITHUB_TOKEN|GH_TOKEN|git push|ExecutionPolicy Bypass/);
});

test('root loader tags injected runtime assets and loads the Save bridge last',()=>{
  const index=fs.readFileSync(path.resolve(__dirname,'..','..','index.html'),'utf8');
  assert.match(index,/naxx-original-editor-save-bridge\.js\?v=1/);
  assert.ok((index.match(/data-naxx-loader-injected/g)||[]).length>=10);
  assert.ok(index.indexOf('gameClientsURL')<index.indexOf('editorSaveBridgeURL'));
});

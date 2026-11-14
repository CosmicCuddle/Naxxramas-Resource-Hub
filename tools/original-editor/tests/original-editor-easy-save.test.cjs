'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {
  PREFIX,ROOT,patchOriginalEditor,createOriginalEditorServer
}=require('../start-original-editor.cjs');
const writer=require('../github-visual-admin-writer.cjs');

test('real original visual Admin export is patched only at obsolete ZIP tail',()=>{
  const source=fs.readFileSync(path.join(ROOT,'site-content.html'),'utf8');
  const beforeHash=crypto.createHash('sha256').update(source).digest('hex');
  const patched=patchOriginalEditor(source);
  assert.equal(crypto.createHash('sha256').update(
    fs.readFileSync(path.join(ROOT,'site-content.html'))).digest('hex'),beforeHash);
  assert.match(patched,/function exportUpdatedHtml\(\)\{/);
  assert.match(patched,/clone\.querySelector\("#resourceGrid"\)/);
  assert.match(patched,/JSON\.stringify\(DATA\)/);
  assert.match(patched,/naxxLocalSaveUpdatedSite\(output\)/);
  assert.match(patched,/__naxx_local_original_save_bridge\.js/);
  const begin=patched.indexOf('function exportUpdatedHtml(){');
  const end=patched.indexOf('\n}\n\ninit();',begin);
  const fn=patched.slice(begin,end);
  assert.doesNotMatch(fn,/name:"index\.html"/);
  assert.doesNotMatch(fn,/Naxxramas_Resource_Hub_GitHub_Update\.zip/);
  assert.doesNotMatch(fn,/replace the existing index\.html/);
});

function request(port,url){
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path:url,method:'GET',
      headers:{Host:'127.0.0.1:'+port}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,
        body:Buffer.concat(chunks)}));
    });
    req.on('error',reject);req.end();
  });
}

test('local server redirects root and serves real GitHub Pages base path instead of Not found',async()=>{
  const server=createOriginalEditorServer({
    status:()=>({expectedHead:'a'.repeat(40)}),
    saveHtml:()=>{throw Error('not used');}
  });
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const port=server.address().port;
  try{
    const root=await request(port,'/');
    assert.equal(root.status,302);
    assert.equal(root.headers.location,PREFIX);
    const home=await request(port,PREFIX);
    assert.equal(home.status,200);
    assert.match(home.body.toString('utf8'),/Naxxramas Resource Hub/);
    const source=await request(port,PREFIX+'site-content.html');
    assert.equal(source.status,200);
    const html=source.body.toString('utf8');
    assert.match(html,/Administrator/);
    assert.match(html,/naxxLocalSaveUpdatedSite/);
    const begin=html.indexOf('function exportUpdatedHtml(){');
    const end=html.indexOf('\n}\n\ninit();',begin);
    assert.ok(begin>=0&&end>begin);
    assert.doesNotMatch(html.slice(begin,end),/name:"index\.html"/);
  }finally{
    server.closeAllConnections();
    await new Promise(ok=>server.close(ok));
  }
});

function syntheticHtml(){
  const filler='x'.repeat(1024*1024+2048);
  return Buffer.from('<!doctype html><html><body><script id="embedded-data">'+
    'window.NAXX_DATA={}; function exportUpdatedHtml(){};'+
    '</script><div>Naxxramas</div><!--'+filler+'--></body></html>','utf8');
}

test('writer can update only site-content.html on fixed non-main branch with exact old-head lease',()=>{
  const old='1'.repeat(40),baseTree='2'.repeat(40),newTree='3'.repeat(40),
    next='4'.repeat(40);
  let current=old,blobSha=null;
  const calls=[];
  function api(endpoint,method='GET',payload){
    calls.push({endpoint,method,payload});
    if(endpoint==='repos/'+writer.REPOSITORY+'/git/ref/heads/'+writer.BRANCH)
      return {ref:'refs/heads/'+writer.BRANCH,object:{sha:current}};
    if(endpoint==='repos/'+writer.REPOSITORY+'/git/commits/'+old)
      return {sha:old,tree:{sha:baseTree}};
    if(endpoint==='repos/'+writer.REPOSITORY+'/git/blobs'&&method==='POST'){
      const bytes=Buffer.from(payload.content,'base64');
      blobSha=writer.gitBlobSha(bytes);return {sha:blobSha};
    }
    if(endpoint==='repos/'+writer.REPOSITORY+'/git/trees'&&method==='POST'){
      assert.equal(payload.base_tree,baseTree);
      assert.deepEqual(payload.tree,[{path:'site-content.html',mode:'100644',
        type:'blob',sha:blobSha}]);
      return {sha:newTree};
    }
    if(endpoint==='repos/'+writer.REPOSITORY+'/git/commits'&&method==='POST'){
      assert.equal(payload.tree,newTree);
      assert.deepEqual(payload.parents,[old]);
      return {sha:next};
    }
    if(endpoint==='repos/'+writer.REPOSITORY+'/git/refs/heads/'+writer.BRANCH&&
       method==='PATCH'){
      assert.deepEqual(payload,{sha:next,force:false});
      current=next;return {object:{sha:next}};
    }
    throw Error('Unexpected API call: '+method+' '+endpoint);
  }
  const saved=writer.saveHtml(syntheticHtml(),old,api);
  assert.equal(saved.file,'site-content.html');
  assert.equal(saved.branch,'editor-saves/visual-admin');
  assert.equal(saved.parentCommit,old);
  assert.equal(saved.commit,next);
  assert.equal(saved.published,false);
  assert.equal(saved.mainUpdated,false);
  assert.ok(calls.every(c=>!c.endpoint.includes('/heads/main')));
  assert.ok(calls.every(c=>!JSON.stringify(c).includes('"index.html"')));
});

test('stale branch head is refused before GitHub objects are created',()=>{
  const expected='a'.repeat(40),actual='b'.repeat(40);
  let writes=0;
  const api=(endpoint,method='GET')=>{
    if(method!=='GET')writes++;
    if(endpoint==='repos/'+writer.REPOSITORY+'/git/ref/heads/'+writer.BRANCH)
      return {ref:'refs/heads/'+writer.BRANCH,object:{sha:actual}};
    throw Error('unexpected');
  };
  assert.throws(()=>writer.saveHtml(syntheticHtml(),expected,api),/changed|Reload/);
  assert.equal(writes,0);
});

test('source hard-codes safe branch and never shells to git or force-updates main',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','github-visual-admin-writer.cjs'),'utf8');
  assert.match(source,/editor-saves\/visual-admin/);
  assert.match(source,/FILE='site-content\.html'/);
  assert.doesNotMatch(source,/git push|git commit|refs\/heads\/main|force:true|GITHUB_TOKEN|GH_TOKEN/);
  const launcher=fs.readFileSync(path.join(__dirname,'..',
    'Start-Naxxramas-Original-Editor.cmd'),'utf8');
  assert.match(launcher,/start-original-editor\.cjs/);
  assert.doesNotMatch(launcher,/git\.exe|ExecutionPolicy Bypass/i);
});

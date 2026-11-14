'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {createServer,parseArgs,getGhToken}=require('../start-original-editor.cjs');

const REPO='CosmicCuddle/Naxxramas-Resource-Hub';
const BRANCH='editor-saves/original-admin';
const HEAD='a'.repeat(40),NEXT='b'.repeat(40),BLOB='c'.repeat(40);

async function withServer(run){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-original-editor-'));
  fs.mkdirSync(path.join(root,'assets'));
  fs.writeFileSync(path.join(root,'index.html'),'<html>home</html>');
  fs.writeFileSync(path.join(root,'site-content.html'),'<html>site</html>');
  fs.writeFileSync(path.join(root,'assets','x.js'),'window.x=1;');
  fs.mkdirSync(path.join(root,'tools'));
  fs.writeFileSync(path.join(root,'tools','secret.txt'),'no');
  let saves=0;
  const store={
    repository:REPO,branch:BRANCH,
    async status(){return {repository:REPO,branch:BRANCH,file:'site-content.html',
      expectedHead:HEAD,branchExists:false,liveMainWriteAllowed:false,published:false};},
    async save(bytes,expected){
      saves++;
      assert.equal(expected,HEAD);
      assert.equal(bytes.length,20*1024*1024+1);
      return {result:'saved-to-github-draft',repository:REPO,branch:BRANCH,
        file:'site-content.html',parentCommit:HEAD,commit:NEXT,blobSha:BLOB,
        sha256:'d'.repeat(64),liveMainWriteAllowed:false,published:false};
    },
    get saves(){return saves;}
  };
  const server=createServer({store,siteDir:root});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{await run(base,store);}
  finally{
    server.closeAllConnections();
    await new Promise(ok=>server.close(ok));
    fs.rmSync(root,{recursive:true,force:true});
  }
}

test('original editor launcher argument and GitHub CLI authentication are explicit',()=>{
  assert.deepEqual(parseArgs(['--original-admin']),{originalAdmin:true});
  assert.throws(()=>parseArgs([]));
  const token=getGhToken((program,args,options)=>{
    assert.equal(program,'gh');
    assert.deepEqual(args,['auth','token','--hostname','github.com']);
    assert.equal(options.shell,false);
    return {status:0,stdout:'fictional_cli_token_12345\n'};
  });
  assert.equal(token,'fictional_cli_token_12345');
});

test('local server serves both root and GitHub Pages path, including versioned assets',async()=>{
  await withServer(async base=>{
    for(const url of ['/', '/Naxxramas-Resource-Hub/']){
      const r=await fetch(base+url);
      assert.equal(r.status,200);
      assert.equal(await r.text(),'<html>home</html>');
    }
    const asset=await fetch(base+'/Naxxramas-Resource-Hub/assets/x.js?v=4');
    assert.equal(asset.status,200);
    assert.match(await asset.text(),/window\.x/);
    const source=await fetch(base+'/Naxxramas-Resource-Hub/site-content.html?v=1');
    assert.equal(source.status,200);
    const blocked=await fetch(base+'/Naxxramas-Resource-Hub/tools/secret.txt');
    assert.equal(blocked.status,404);
  });
});

test('status gives browser a CSRF-bound draft capability; Save never reports publication',async()=>{
  await withServer(async(base,store)=>{
    const status=await fetch(base+'/api/original-admin/status');
    assert.equal(status.status,200);
    const info=await status.json();
    assert.equal(info.repository,REPO);
    assert.equal(info.branch,BRANCH);
    assert.equal(info.liveMainWriteAllowed,false);
    assert.equal(info.published,false);
    assert.match(info.csrfToken,/^[a-f0-9]{64}$/);

    const body=Buffer.alloc(20*1024*1024+1,65);
    const saved=await fetch(base+'/api/original-admin/save',{
      method:'POST',body,headers:{
        Origin:base,
        'X-Naxx-Editor-Protocol':'naxx-original-admin-save-v1',
        'X-Naxx-Expected-Head':HEAD,
        'X-Naxx-Csrf-Token':info.csrfToken,
        'Content-Type':'text/html; charset=utf-8'
      }
    });
    assert.equal(saved.status,200);
    const receipt=await saved.json();
    assert.equal(receipt.result,'saved-to-github-draft');
    assert.equal(receipt.commit,NEXT);
    assert.equal(receipt.published,false);
    assert.equal(store.saves,1);
  });
});

test('wrong origin/protocol/CSRF cannot reach the Save writer',async()=>{
  await withServer(async(base,store)=>{
    const info=await (await fetch(base+'/api/original-admin/status')).json();
    const body=Buffer.alloc(20*1024*1024+1,65);
    for(const headers of [
      {Origin:'https://evil.invalid','X-Naxx-Editor-Protocol':'naxx-original-admin-save-v1',
        'X-Naxx-Expected-Head':HEAD,'X-Naxx-Csrf-Token':info.csrfToken,'Content-Type':'text/html; charset=utf-8'},
      {Origin:base,'X-Naxx-Editor-Protocol':'wrong',
        'X-Naxx-Expected-Head':HEAD,'X-Naxx-Csrf-Token':info.csrfToken,'Content-Type':'text/html; charset=utf-8'},
      {Origin:base,'X-Naxx-Editor-Protocol':'naxx-original-admin-save-v1',
        'X-Naxx-Expected-Head':HEAD,'X-Naxx-Csrf-Token':'0'.repeat(64),'Content-Type':'text/html; charset=utf-8'}
    ]){
      const r=await fetch(base+'/api/original-admin/save',{method:'POST',body,headers});
      assert.ok(r.status>=400);
    }
    assert.equal(store.saves,0);
  });
});

test('localhost bridge strips exactly the 19 temporary loader nodes',()=>{
  const root=path.resolve(__dirname,'..','..','..');
  const source=fs.readFileSync(path.join(root,'assets','naxx-original-admin-save-bridge.js'),'utf8');
  const context={
    location:{hostname:'127.0.0.1'},
    document:{readyState:'complete',querySelector(){return null;}},
    console,window:null
  };
  context.window=context;
  vm.runInNewContext(source,context,{filename:'bridge.js'});
  const strip=context.NaxxOriginalAdminSaveBridge.stripRuntimeLoader;
  let html='<!doctype html><html><head>';
  for(let i=0;i<7;i++)html+='<link data-naxx-loader-injected="1" href="x'+i+'">';
  html+='</head><body>';
  for(let i=0;i<12;i++)html+='<script data-naxx-loader-injected="1" src="x'+i+'"></script>';
  html+='</body></html>';
  const clean=strip(html);
  assert.equal(clean.includes('data-naxx-loader-injected'),false);
  assert.throws(()=>strip(html.replace(/<script data-naxx-loader-injected="1"[^>]*><\/script>/,'')));
});

test('root loader marks every runtime addition and loads the localhost-only bridge last',()=>{
  const root=path.resolve(__dirname,'..','..','..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal((html.match(/data-naxx-loader-injected="1"/g)||[]).length,19);
  assert.match(html,/naxx-original-admin-save-bridge\.js\?v=1/);
  assert.ok(html.indexOf('gameClientsURL')<html.indexOf('adminSaveBridgeURL'));
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {
  REPOSITORY,BRANCH,FILE,approvedRoute,blobSha,validateHtml,createStore
}=require('./github-site-content-store.cjs');
const {tokenFromGh,createServer}=require('./start-original-editor.cjs');
const ROOT=path.resolve(__dirname,'..','..');
const OLD='a'.repeat(40),MAIN='b'.repeat(40),NEXT='c'.repeat(40);
function candidate(){
  const head='<!doctype html><html><head></head><body>'+
    '<script id="embedded-data">window.NAXX_DATA = {"resources":[]};</script>'+
    '<script>function exportUpdatedHtml(){ return true; }</script>';
  const tail='</body></html>';
  const size=20*1024*1024+4096;
  return Buffer.from(head+' '.repeat(size-head.length-tail.length)+tail,'utf8');
}
test('clean feature branch preserves original visual site and only injects Save bridge into loader',()=>{
  const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(index,/site-content\.html/);
  assert.match(index,/naxx-original-admin-save\.js\?v=1/);
  assert.match(index,/naxx-game-clients-guide\.js\?v=1/);
  assert.equal(index.includes('Save My Edits Privately'),false);
  assert.equal(fs.existsSync(path.join(ROOT,'editor','index.html')),false);
});
test('public fallback explicitly exports site-content.html and warns never to replace index.html',()=>{
  const source=fs.readFileSync(path.join(ROOT,'assets','naxx-original-admin-save.js'),'utf8');
  assert.match(source,/\{name:'site-content\.html',data:html\}/);
  assert.match(source,/DO NOT replace index\.html/);
  assert.match(source,/Save Website Update/);
  assert.match(source,/editor-saves\/original-admin/);
});
test('Save bridge removes only loader-added overlay tags from original editor snapshot',()=>{
  const source=fs.readFileSync(path.join(ROOT,'assets','naxx-original-admin-save.js'),'utf8');
  const context={
    location:{protocol:'https:',hostname:'example.invalid'},
    setInterval:()=>1,clearInterval:()=>{},
    console,Blob,URL,window:null
  };
  context.window=context;
  vm.runInNewContext(source,context,{filename:'naxx-original-admin-save.js'});
  const raw='<!doctype html><html><head>'+
    '<link rel="stylesheet" href="https://example.invalid/assets/naxx-theme-v2.css">'+
    '</head><body><script id="embedded-data">window.NAXX_DATA={};</script>'+
    '<script>function exportUpdatedHtml(){}</script>'+
    '<script src="https://example.invalid/assets/naxx-game-clients-guide.js?v=1"></script>'+
    '<p>KEEP ME</p></body></html>';
  const cleaned=context.NaxxOriginalAdminSave.stripInjected(raw);
  assert.equal(cleaned.includes('naxx-theme-v2.css'),false);
  assert.equal(cleaned.includes('naxx-game-clients-guide.js'),false);
  assert.match(cleaned,/KEEP ME/);
  assert.match(cleaned,/window\.NAXX_DATA/);
});
test('GitHub writer route allowlist cannot address index.html, main writes, Pages or settings',()=>{
  const base='/repos/'+REPOSITORY;
  assert.equal(approvedRoute('PUT',base+'/contents/site-content.html'),true);
  assert.equal(approvedRoute('GET',base+'/git/ref/heads/main'),true);
  assert.equal(approvedRoute('GET',base+'/git/ref/heads/'+BRANCH),true);
  for(const [method,url] of [
    ['PUT',base+'/contents/index.html'],
    ['PUT',base+'/contents/assets/naxx-theme-v2.css'],
    ['POST',base+'/git/refs'],
    ['PATCH',base+'/git/refs/heads/main'],
    ['PUT',base+'/pages'],
    ['POST',base+'/actions/workflows/test/dispatches'],
    ['DELETE',base+'/contents/site-content.html']
  ])assert.equal(approvedRoute(method,url),false,method+' '+url);
});
test('prepared HTML accepts original full-site shape but rejects loader or duplicated overlays',()=>{
  const good=candidate();
  const checked=validateHtml(good);
  assert.equal(checked.sha,blobSha(good));
  const loader=Buffer.from(good.toString('utf8')
    .replace('window.NAXX_DATA = {"resources":[]};','Loading the Naxxramas Resource Hub…'));
  assert.throws(()=>validateHtml(loader),/complete site-content/);
  const overlay=Buffer.from(good.toString('utf8').replace(
    '</head>','<script src="assets/naxx-three-pages.js?v=2"></script></head>'));
  assert.throws(()=>validateHtml(overlay),/Loader-injected overlay/);
});
test('fake GitHub Save changes exactly site-content.html on review branch and proves main unchanged',async()=>{
  let review=OLD,main=MAIN,currentBlob='d'.repeat(40),currentSize=30976969,writes=0;
  const commits=new Map();
  const request=async({method,path:url,body})=>{
    const respond=(value,status=200)=>({status,body:JSON.stringify(value)});
    const base='/repos/'+REPOSITORY;
    if(method==='GET'&&url===base)return respond({
      full_name:REPOSITORY,archived:false,disabled:false
    });
    if(method==='GET'&&url===base+'/git/ref/heads/main')
      return respond({ref:'refs/heads/main',object:{sha:main}});
    if(method==='GET'&&url===base+'/git/ref/heads/'+BRANCH)
      return respond({ref:'refs/heads/'+BRANCH,object:{sha:review}});
    if(method==='GET'&&url===base+'/compare/main...'+BRANCH)
      return respond({behind_by:0,ahead_by:review===OLD?0:1});
    if(method==='GET'&&url===base+'/contents/'+FILE+'?ref='+BRANCH)
      return respond({type:'file',path:FILE,sha:currentBlob,size:currentSize});
    if(method==='PUT'&&url===base+'/contents/'+FILE){
      const payload=JSON.parse(body);
      assert.equal(payload.branch,BRANCH);
      assert.equal(payload.sha,currentBlob);
      const bytes=Buffer.from(payload.content,'base64');
      currentBlob=blobSha(bytes);currentSize=bytes.length;
      const parent=review;review=NEXT;writes++;
      commits.set(NEXT,{sha:NEXT,parents:[{sha:parent}]});
      return respond({commit:{sha:NEXT},content:{path:FILE,sha:currentBlob}});
    }
    if(method==='GET'&&url===base+'/git/commits/'+NEXT)
      return respond(commits.get(NEXT));
    throw Error('Unexpected fake GitHub route '+method+' '+url);
  };
  const store=createStore({token:'fictional_local_token_only',request});
  const before=await store.status();
  assert.equal(before.expectedHead,OLD);
  const html=candidate();
  const saved=await store.save(html,OLD);
  assert.equal(saved.result,'saved-to-review-branch');
  assert.equal(saved.parentCommit,OLD);
  assert.equal(saved.commit,NEXT);
  assert.equal(saved.mainHead,MAIN);
  assert.equal(saved.mainUnchanged,true);
  assert.equal(saved.published,false);
  assert.equal(saved.blobSha,blobSha(html));
  assert.equal(writes,1);
});
test('local HTTP Save requires same-origin CSRF and passes only HTML to attached store',async()=>{
  let saves=0;
  const fake={
    async status(){return {expectedHead:OLD,mainHead:MAIN};},
    async save(bytes,expected){
      saves++;assert.equal(expected,OLD);assert.equal(bytes.toString(),'test html');
      return {format:'naxx-original-editor-save-result-v1',
        result:'saved-to-review-branch',repository:REPOSITORY,branch:BRANCH,
        parentCommit:OLD,commit:NEXT,blobSha:'e'.repeat(40),bytes:9,
        mainHead:MAIN,mainUnchanged:true,published:false};
    }
  };
  const server=await createServer({store:fake});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const status=await fetch(base+'/api/original-editor/status');
    assert.equal(status.status,200);
    const cap=await status.json();
    assert.equal(cap.branch,BRANCH);
    const bad=await fetch(base+'/api/original-editor/save',{
      method:'POST',headers:{'Content-Type':'text/html'},body:'test html'
    });
    assert.equal(bad.status,403);assert.equal(saves,0);
    const saved=await fetch(base+'/api/original-editor/save',{
      method:'POST',headers:{
        Origin:base,'Content-Type':'text/html',
        'X-Naxx-Editor-Protocol':'naxx-original-admin-save-v1',
        'X-Naxx-Expected-Head':OLD,'X-Naxx-Csrf-Token':cap.csrfToken
      },body:'test html'
    });
    assert.equal(saved.status,200);assert.equal(saves,1);
  }finally{
    server.closeAllConnections();
    await new Promise(ok=>server.close(ok));
  }
});
test('launcher uses GitHub CLI authentication but does not require Git for Windows',()=>{
  const cmd=fs.readFileSync(path.join(__dirname,'Start-Naxxramas-Original-Editor.cmd'),'utf8');
  assert.match(cmd,/where node\.exe/);assert.match(cmd,/where gh\.exe/);
  assert.equal(/where git\.exe/i.test(cmd),false);
  const token=tokenFromGh((program,args,options)=>{
    assert.equal(program,'gh');
    assert.deepEqual(args,['auth','token','--hostname','github.com']);
    assert.equal(options.shell,false);
    return {status:0,stdout:'fictional_local_token_only\n'};
  });
  assert.equal(token,'fictional_local_token_only');
});

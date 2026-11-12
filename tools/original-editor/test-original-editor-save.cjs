'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {
  REPOSITORY,MAIN,EDIT_BRANCH,FILE,gitBlobSha,allowed,createWriter
}=require('./github-site-content-writer.cjs');
const {
  ROOT,LIVE_PREFIX,SAVE,rebuildSiteContent,createOriginalEditorServer
}=require('./start-original-editor.cjs');

const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourcePath=path.join(ROOT,'site-content.html');
const indexPath=path.join(ROOT,'index.html');

function modifiedEmbeddedScript(){
  const source=fs.readFileSync(sourcePath,'utf8');
  const m=/<script\b[^>]*\bid=(['"])embedded-data\1[^>]*>([\s\S]*?)<\/script\s*>/i.exec(source);
  assert.ok(m);
  const parsed=/^\s*window\.NAXX_DATA\s*=\s*([\s\S]*?)\s*;\s*$/.exec(m[2].trim());
  assert.ok(parsed);
  const data=JSON.parse(parsed[1]);
  assert.ok(Array.isArray(data.resources)&&data.resources.length>0);
  data.resources=JSON.parse(JSON.stringify(data.resources));
  data.resources[0]={...data.resources[0],title:String(data.resources[0].title||'')+' [SAVE TEST]'};
  return 'window.NAXX_DATA = '+JSON.stringify(data).replace(/<\/script/gi,'<\\/script')+';';
}

test('rebuild changes only embedded DATA content in original site-content.html',()=>{
  const original=fs.readFileSync(sourcePath);
  assert.equal(
    sha256(original),
    '34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8',
    'Original live site-content.html bytes must remain exact.'
  );
  const script=modifiedEmbeddedScript();
  const rebuilt=rebuildSiteContent(original,script);
  assert.notEqual(sha256(rebuilt),sha256(original));
  const oldText=original.toString('utf8'),newText=rebuilt.toString('utf8');
  const re=/(<script\b[^>]*\bid=(['"])embedded-data\2[^>]*>)([\s\S]*?)(<\/script\s*>)/i;
  const a=re.exec(oldText),b=re.exec(newText);
  assert.ok(a&&b);
  assert.equal(oldText.slice(0,a.index),newText.slice(0,b.index));
  assert.equal(
    oldText.slice(a.index+a[0].length),
    newText.slice(b.index+b[0].length)
  );
  assert.equal(b[3].trim(),script);
  assert.equal(fs.readFileSync(indexPath,'utf8').includes('site-content.html'),true);
});

test('GitHub writer can update only site-content on editing branch, never main',async()=>{
  assert.equal(allowed('PATCH','/repos/'+REPOSITORY+'/git/refs/heads/main'),false);
  assert.equal(allowed('POST','/repos/'+REPOSITORY+'/contents/index.html'),false);
  assert.equal(allowed('PATCH','/repos/'+REPOSITORY+'/git/refs/heads/'+EDIT_BRANCH),true);

  const base='/repos/'+REPOSITORY;
  const MAIN_SHA='a'.repeat(40),EDIT_SHA='b'.repeat(40),TREE_SHA='c'.repeat(40);
  const NEW_TREE='d'.repeat(40),NEW_COMMIT='e'.repeat(40);
  let editExists=false,editHead=null,newBlob=null,mainWrites=0,refMoves=0;
  const requests=[];
  const request=async({method,path:uri,body})=>{
    requests.push({method,uri});
    const ok=(obj,status=200)=>({status,body:JSON.stringify(obj)});
    if(method==='GET'&&uri===base)
      return ok({full_name:REPOSITORY,default_branch:MAIN,archived:false,disabled:false});
    if(method==='GET'&&uri===base+'/git/ref/heads/'+MAIN)
      return ok({ref:'refs/heads/main',object:{sha:MAIN_SHA}});
    if(method==='GET'&&uri===base+'/git/ref/heads/'+EDIT_BRANCH){
      if(!editExists)return ok({message:'Not Found'},404);
      return ok({ref:'refs/heads/'+EDIT_BRANCH,object:{sha:editHead}});
    }
    if(method==='POST'&&uri===base+'/git/refs'){
      const x=JSON.parse(body);
      assert.equal(x.ref,'refs/heads/'+EDIT_BRANCH);assert.equal(x.sha,MAIN_SHA);
      editExists=true;editHead=MAIN_SHA;
      return ok({ref:x.ref,object:{sha:MAIN_SHA}},201);
    }
    if(method==='GET'&&uri===base+'/git/commits/'+MAIN_SHA)
      return ok({sha:MAIN_SHA,tree:{sha:TREE_SHA},parents:[]});
    if(method==='POST'&&uri===base+'/git/blobs'){
      const x=JSON.parse(body);newBlob=gitBlobSha(Buffer.from(x.content,'base64'));
      return ok({sha:newBlob},201);
    }
    if(method==='POST'&&uri===base+'/git/trees'){
      const x=JSON.parse(body);
      assert.equal(x.base_tree,TREE_SHA);
      assert.deepEqual(x.tree,[{path:FILE,mode:'100644',type:'blob',sha:newBlob}]);
      return ok({sha:NEW_TREE},201);
    }
    if(method==='POST'&&uri===base+'/git/commits'){
      const x=JSON.parse(body);assert.equal(x.tree,NEW_TREE);
      assert.deepEqual(x.parents,[MAIN_SHA]);
      return ok({sha:NEW_COMMIT},201);
    }
    if(method==='PATCH'&&uri===base+'/git/refs/heads/'+EDIT_BRANCH){
      const x=JSON.parse(body);assert.equal(x.sha,NEW_COMMIT);assert.equal(x.force,false);
      editHead=NEW_COMMIT;refMoves++;return ok({ref:'refs/heads/'+EDIT_BRANCH,object:{sha:NEW_COMMIT}});
    }
    if(method==='GET'&&uri===base+'/git/commits/'+NEW_COMMIT)
      return ok({sha:NEW_COMMIT,tree:{sha:NEW_TREE},parents:[{sha:MAIN_SHA}]});
    if(method==='GET'&&uri===base+'/git/trees/'+NEW_TREE)
      return ok({sha:NEW_TREE,tree:[{path:FILE,mode:'100644',type:'blob',sha:newBlob}]});
    if(uri.includes('/refs/heads/main')&&method!=='GET')mainWrites++;
    return ok({message:'unexpected '+method+' '+uri},500);
  };
  const writer=createWriter({request});
  const bytes=Buffer.from('<!doctype html>\n'+('x'.repeat(2000)));
  const result=await writer.saveSource(bytes);
  assert.equal(result.branch,EDIT_BRANCH);
  assert.equal(result.commit,NEW_COMMIT);
  assert.equal(result.mainCommit,MAIN_SHA);
  assert.equal(result.mainUnchanged,true);
  assert.equal(result.published,false);
  assert.equal(result.siteContentBlob,gitBlobSha(bytes));
  assert.equal(mainWrites,0);assert.equal(refMoves,1);
  assert.ok(requests.every(x=>!x.uri.includes('/contents/index.html')));
});

test('original local editor mirrors live Pages prefix and injects bridge without changing disk',async()=>{
  const beforeIndex=sha256(fs.readFileSync(indexPath));
  const beforeSite=sha256(fs.readFileSync(sourcePath));
  let saved=null;
  const server=createOriginalEditorServer({
    writer:{async saveSource(bytes){saved=Buffer.from(bytes);return {
      format:'naxx-original-visual-editor-save-v1',
      result:'saved-to-github-editing-branch',
      repository:REPOSITORY,branch:EDIT_BRANCH,
      parentCommit:'a'.repeat(40),commit:'b'.repeat(40),
      siteContentBlob:gitBlobSha(bytes),mainCommit:'c'.repeat(40),
      mainUnchanged:true,published:false,
      compareUrl:'https://github.com/'+REPOSITORY+'/compare/main...'+EDIT_BRANCH+'?expand=1'
    };}}
  });
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const home=await fetch(origin+LIVE_PREFIX+'/');
    assert.equal(home.status,200);
    assert.match(await home.text(),/site-content\.html/);
    const site=await fetch(origin+LIVE_PREFIX+'/site-content.html');
    const siteText=await site.text();
    assert.match(siteText,/original-save-bridge\.js/);
    const script=modifiedEmbeddedScript();
    const response=await fetch(origin+SAVE,{method:'POST',headers:{
      Origin:origin,'Content-Type':'text/plain;charset=utf-8',
      'X-Naxx-Original-Editor':'save-v1'
    },body:script});
    assert.equal(response.status,200);
    const receipt=await response.json();
    assert.equal(receipt.published,false);
    assert.ok(saved);
    assert.match(saved.toString('utf8'),/\[SAVE TEST\]/);
  }finally{
    server.closeAllConnections();
    await new Promise(ok=>server.close(ok));
  }
  assert.equal(sha256(fs.readFileSync(indexPath)),beforeIndex);
  assert.equal(sha256(fs.readFileSync(sourcePath)),beforeSite);
});

test('bridge keeps original UI and replaces only original export action locally',()=>{
  const bridge=fs.readFileSync(path.join(ROOT,'tools','original-editor','original-save-bridge.js'),'utf8');
  assert.match(bridge,/Save Website Update/);
  assert.match(bridge,/root\.exportUpdatedHtml=save/);
  assert.match(bridge,/original\(\)/);
  assert.match(bridge,/index\.html/);
  assert.match(bridge,/embedded-data/);
  assert.doesNotMatch(bridge,/password|adminPassword|localStorage|GITHUB_TOKEN|Authorization/);
});

test('Windows launcher starts only this original editor and needs no Git executable',()=>{
  const launcher=fs.readFileSync(path.join(ROOT,'tools','original-editor',
    'Start-Naxxramas-Original-Editor.cmd'),'utf8');
  assert.match(launcher,/start-original-editor\.cjs/);
  assert.match(launcher,/where node\.exe/);
  assert.match(launcher,/where gh\.exe/);
  assert.equal(/where git\.exe/i.test(launcher),false);
  assert.equal(/git push/i.test(launcher),false);
  assert.equal(/main\b.*write/i.test(launcher),false);
});

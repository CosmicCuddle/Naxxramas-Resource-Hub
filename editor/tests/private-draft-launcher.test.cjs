'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parseArgs,getGhToken,startOwnerPrivateEditor}=
  require('../tools/start-owner-private-draft-editor.cjs');
const REPO='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01';
test('private editor launcher is manually opted-in, never starts from an import',()=>{
  assert.throws(()=>parseArgs([]));
  assert.throws(()=>parseArgs(['--private-drafts','--extra']));
  assert.deepEqual(parseArgs(['--private-drafts']),{privateDrafts:true});
});
test('GitHub CLI token is captured in memory and never printed by the helper',()=>{
  let calls=0;
  const token=getGhToken((program,args,options)=>{
    calls++;
    assert.equal(program,'gh');
    assert.deepEqual(args,['auth','token','--hostname','github.com']);
    assert.equal(options.shell,false);
    return {status:0,stdout:'fictional_private_test_token\n'};
  });
  assert.equal(token,'fictional_private_test_token');
  assert.equal(calls,1);
  assert.throws(()=>getGhToken(()=>({status:1,stdout:''})),/not authenticated/);
  assert.throws(()=>getGhToken(()=>({status:0,stdout:'short'})),/authentication/);
});
test('explicit private owner launcher opens a read-only loopback editor with private draft capability',async()=>{
  const calls=[];
  const request=async({method,path:uri})=>{
    calls.push({method,uri});
    const respond=(value,status=200)=>({status,body:JSON.stringify(value)});
    if(uri==='/repos/'+REPO)
      return respond({full_name:REPO,private:true,visibility:'private',
        archived:false,disabled:false});
    if(uri==='/repos/'+REPO+'/git/ref/heads/main')
      return respond({ref:'refs/heads/main',object:{sha:'a'.repeat(40)}});
    if(uri==='/repos/'+REPO+'/contents/editor-drafts/latest-review.zip?ref=main')
      return respond({message:'Not Found'},404);
    throw Error('The launcher attempted an unexpected network route.');
  };
  const run=await startOwnerPrivateEditor(['--private-drafts'],{
    getToken:()=> 'fictional_private_test_token',
    request
  });
  try{
    assert.equal(run.privateDrafts,true);
    assert.equal(run.published,false);
    assert.match(run.url,/^http:\/\/127\.0\.0\.1:\d+\/editor\/index\.html$/);
    const status=await fetch(run.url.replace('/editor/index.html','/api/editor/status'));
    assert.equal(status.status,200);
    const body=await status.json();
    assert.equal(body.repository,REPO);
    assert.equal(body.storageMode,'private-draft-zip');
    assert.equal(body.ready,true);
    assert.equal(body.authenticated,true);
    assert.equal(body.publishDisabled,true);
    assert.equal(body.backupVerified,false);
    assert.equal(body.draftExists,false);
    assert.ok(calls.length>=6);
    assert.ok(calls.every(x=>x.method==='GET'&&x.uri.startsWith('/repos/'+REPO)));
  }finally{
    run.server.closeAllConnections();
    await new Promise(ok=>run.server.close(ok));
  }
});
test('normal Windows shortcut only starts the explicit private draft editor and has no secrets',()=>{
  const tools=path.join(__dirname,'..','tools');
  const bat=fs.readFileSync(path.join(tools,
    'Start-Naxxramas-Private-Draft-Editor.cmd'),'utf8');
  assert.match(bat,/start-owner-private-draft-editor\.cjs/);
  assert.match(bat,/--private-drafts/);
  assert.match(bat,/where gh\.exe/);
  assert.match(bat,/where node\.exe/);
  for(const value of [
    'GITHUB_TOKEN','GH_TOKEN','--mirror','git push',
    'api.github.com','Authorization:','-ExecutionPolicy Bypass'
  ])assert.equal(bat.includes(value),false,value);
});

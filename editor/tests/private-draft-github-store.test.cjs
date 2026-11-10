'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {gitBlobOid}=require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const {createPrivateDraftStore,REPOSITORY,BRANCH,PATH,validRoute}=
  require('../tools/private-draft-github-store.cjs');
const OLD='a'.repeat(40),FIRST='b'.repeat(40),SECOND='c'.repeat(40);
function zip(marker){
  const b=Buffer.alloc(80,marker);
  b[0]=0x50;b[1]=0x4b;b[2]=0x03;b[3]=0x04;
  return b;
}
function fictionalGithub(){
  let commit=OLD,draft=null,writes=0,privacy=true,alterRead=false,failPut=false;
  const history=new Map();
  const calls=[];
  const request=async({method,path:url,body})=>{
    calls.push({method,url});
    const json=(data,status=200)=>({status,body:JSON.stringify(data)});
    if(method==='GET'&&url==='/repos/'+REPOSITORY){
      return json({full_name:REPOSITORY,private:privacy,visibility:privacy?'private':'public',
        archived:false,disabled:false});
    }
    if(method==='GET'&&url.endsWith('/git/ref/heads/main')){
      return json({ref:'refs/heads/main',object:{sha:commit}});
    }
    if(method==='GET'&&url.includes('/contents/'+PATH+'?ref=main')){
      if(!draft)return json({message:'Not Found'},404);
      return json({type:'file',path:PATH,encoding:'base64',sha:draft.sha,
        content:(alterRead?zip(95):draft.bytes).toString('base64')});
    }
    if(method==='PUT'&&url.endsWith('/contents/'+PATH)){
      if(failPut)throw Error('simulated transport ambiguity');
      const payload=JSON.parse(body);
      if(payload.branch!==BRANCH)return json({message:'not allowed'},422);
      if((draft&&payload.sha!==draft.sha)||(!draft&&'sha' in payload))
        return json({message:'conflict'},409);
      const bytes=Buffer.from(payload.content,'base64'),blob=gitBlobOid(bytes);
      const parent=commit;
      commit=commit===OLD?FIRST:SECOND;
      draft={sha:blob,bytes};
      history.set(commit,{sha:commit,parents:[{sha:parent}]});
      writes++;
      return json({commit:{sha:commit},content:{path:PATH,sha:blob}});
    }
    if(method==='GET'&&url.includes('/git/commits/')){
      const sha=url.split('/').pop();
      return json(history.get(sha)||{message:'Not Found'},history.has(sha)?200:404);
    }
    return json({message:'unexpected path'},404);
  };
  return {request,calls,get writes(){return writes;},
    setPrivate(x){privacy=x;},setAlterRead(x){alterRead=x;},
    setFailPut(x){failPut=x;},setHead(x){commit=x;}};
}
function connect(remote){
  return createPrivateDraftStore({repository:REPOSITORY,
    enabledByExplicitOwnerApproval:true,token:'fictional_token_only_for_tests',
    request:remote.request});
}
test('fixed GitHub request routes can never address public Resource Hub, workflows or another file',()=>{
  assert.equal(validRoute('GET','/repos/'+REPOSITORY),true);
  assert.equal(validRoute('GET','/repos/'+REPOSITORY+'/git/ref/heads/main'),true);
  assert.equal(validRoute('GET','/repos/'+REPOSITORY+'/contents/'+PATH+'?ref=main'),true);
  assert.equal(validRoute('PUT','/repos/'+REPOSITORY+'/contents/'+PATH),true);
  for(const [verb,url] of [
    ['PUT','/repos/CosmicCuddle/Naxxramas-Resource-Hub/contents/index.html'],
    ['PUT','/repos/'+REPOSITORY+'/contents/index.html'],
    ['PUT','/repos/'+REPOSITORY+'/git/refs'],
    ['POST','/repos/'+REPOSITORY+'/contents/'+PATH],
    ['GET','/repos/'+REPOSITORY+'/actions/permissions'],
    ['GET','/repos/'+REPOSITORY+'/contents/'+PATH+'?ref=other'],
    ['PUT','/repos/'+REPOSITORY+'/contents/'+PATH+'?ref=main']
  ])assert.equal(validRoute(verb,url),false);
});
test('an explicit private token and owner approval are required before opening any transport',()=>{
  const remote=fictionalGithub();
  for(const bad of [
    {repository:REPOSITORY,token:'fictional_token_only_for_tests',request:remote.request},
    {repository:'CosmicCuddle/Naxxramas-Resource-Hub',
      enabledByExplicitOwnerApproval:true,token:'fictional_token_only_for_tests',request:remote.request},
    {repository:REPOSITORY,enabledByExplicitOwnerApproval:true,
      token:'bad',request:remote.request}
  ])assert.throws(()=>createPrivateDraftStore(bad));
  assert.equal(remote.calls.length,0);
});
test('one private draft ZIP can be saved and independently loaded repeatedly without a website source commit',async()=>{
  const remote=fictionalGithub(),store=connect(remote);
  const before=await store.status();
  assert.equal(before.repository,REPOSITORY);
  assert.equal(before.expectedHead,OLD);
  assert.equal(before.privateVerified,true);
  assert.equal(before.draftExists,false);
  const first=zip(65),one=await store.save(first,OLD);
  assert.equal(one.result,'private-draft-saved-and-verified');
  assert.equal(one.parentCommit,OLD);
  assert.equal(one.commit,FIRST);
  assert.equal(one.gitBlobSha,gitBlobOid(first));
  assert.equal(one.websiteSourceUnchanged,true);
  assert.equal(one.published,false);
  assert.equal(remote.writes,1);
  const loaded=await store.load();
  assert.ok(loaded.bytes.equals(first));
  assert.equal(loaded.commit,FIRST);
  const second=zip(66),two=await store.save(second,FIRST);
  assert.equal(two.parentCommit,FIRST);
  assert.equal(two.commit,SECOND);
  assert.equal(remote.writes,2);
  const latest=await store.load();
  assert.ok(latest.bytes.equals(second));
  assert.equal(remote.calls.filter(x=>x.method==='PUT').length,2);
  assert.ok(remote.calls.every(x=>x.url.startsWith('/repos/'+REPOSITORY)));
});
test('public sandbox, stale head, malformed ZIP or unchanged draft cannot be written',async()=>{
  const remote=fictionalGithub(),store=connect(remote);
  remote.setPrivate(false);
  await assert.rejects(store.status(),/PRIVATE/);
  remote.setPrivate(true);
  await assert.rejects(store.save(Buffer.from('not a ZIP'),OLD),/ZIP/);
  await assert.rejects(store.save(zip(65),'f'.repeat(40)),/moved/);
  assert.equal(remote.writes,0);
  const first=zip(65);await store.save(first,OLD);
  await assert.rejects(store.save(first,FIRST),/unchanged/);
  assert.equal(remote.writes,1);
});
test('unknown remote write outcome freezes caller and cannot produce saved receipt',async()=>{
  const remote=fictionalGithub(),store=connect(remote);
  remote.setFailPut(true);
  await assert.rejects(store.save(zip(77),OLD),/PRIVATE_DRAFT_OUTCOME_UNCERTAIN/);
  assert.equal(remote.writes,0);
});
test('modified readback cannot be falsely reported as a successful private Save',async()=>{
  const remote=fictionalGithub(),store=connect(remote);
  remote.setAlterRead(true);
  await assert.rejects(store.save(zip(65),OLD),/Git-blob identity|OUTCOME_UNCERTAIN/);
  assert.equal(remote.writes,1);
});
test('no private drafts are silently written from server import, environment, test module or browser',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','tools','private-draft-github-store.cjs'),'utf8');
  for(const bad of [
    'process.env','GITHUB_TOKEN','GH_TOKEN','localStorage',
    'setInterval(', 'git push', 'refs/heads/editor-saves',
    'Naxxramas-Resource-Hub/contents'
  ])assert.equal(source.includes(bad),false,bad);
  assert.match(source,/enabledByExplicitOwnerApproval/);
  assert.match(source,/websiteSourceUnchanged:true/);
});

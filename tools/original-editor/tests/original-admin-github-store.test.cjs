'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  REPOSITORY,BRANCH,FILE,gitBlobOid,validateHtml,validRoute,
  createOriginalAdminGitHubStore
}=require('../original-admin-github-store.cjs');

const MAIN='a'.repeat(40),NEXT='b'.repeat(40);
const TREE0='c'.repeat(40),TREE1='d'.repeat(40),BLOB='e'.repeat(40);
const HASH='f'.repeat(64);

test('real original site-content passes the protected Save validator',()=>{
  const root=path.resolve(__dirname,'..','..','..');
  const bytes=fs.readFileSync(path.join(root,'site-content.html'));
  const result=validateHtml(bytes);
  assert.ok(bytes.length>30_000_000);
  assert.match(result.blobSha,/^[a-f0-9]{40}$/);
  assert.match(result.sha256,/^[a-f0-9]{64}$/);
  const altered=Buffer.from(bytes.toString('utf8').replace(
    /<head>/i,'<head><link data-naxx-loader-injected="1" href="x">'),'utf8');
  assert.throws(()=>validateHtml(altered),/safety checks/);
});

test('writer route allowlist cannot update main, index.html, workflows or arbitrary refs',()=>{
  assert.equal(validRoute('GET','/repos/'+REPOSITORY),true);
  assert.equal(validRoute('PATCH','/repos/'+REPOSITORY+'/git/refs/heads/'+BRANCH),true);
  for(const [method,p] of [
    ['PATCH','/repos/'+REPOSITORY+'/git/refs/heads/main'],
    ['PUT','/repos/'+REPOSITORY+'/contents/index.html'],
    ['PUT','/repos/'+REPOSITORY+'/contents/site-content.html'],
    ['POST','/repos/'+REPOSITORY+'/actions/workflows/x/dispatches'],
    ['PATCH','/repos/'+REPOSITORY+'/git/refs/heads/feature/other']
  ])assert.equal(validRoute(method,p),false,method+' '+p);
});

function fakeGithub(){
  let branch=null;
  let compareFiles=[{filename:FILE}];
  let writes=0;
  const commits=new Map([
    [MAIN,{sha:MAIN,tree:{sha:TREE0},parents:[]}]
  ]);
  async function request({method,path:p,body}){
    const json=(status,value)=>({status,body:JSON.stringify(value)});
    if(method==='GET'&&p==='/repos/'+REPOSITORY)
      return json(200,{full_name:REPOSITORY,archived:false,disabled:false,default_branch:'main'});
    if(method==='GET'&&p==='/repos/'+REPOSITORY+'/git/ref/heads/main')
      return json(200,{ref:'refs/heads/main',object:{sha:MAIN}});
    if(method==='GET'&&p==='/repos/'+REPOSITORY+'/git/ref/heads/'+BRANCH)
      return branch?
        json(200,{ref:'refs/heads/'+BRANCH,object:{sha:branch}}):
        json(404,{message:'Not Found'});
    if(method==='GET'&&p==='/repos/'+REPOSITORY+'/compare/main...'+BRANCH)
      return json(200,{files:compareFiles,status:'ahead'});
    if(method==='GET'&&p.startsWith('/repos/'+REPOSITORY+'/git/commits/')){
      const sha=p.slice(p.lastIndexOf('/')+1);
      return commits.has(sha)?json(200,commits.get(sha)):json(404,{message:'Not Found'});
    }
    if(method==='POST'&&p==='/repos/'+REPOSITORY+'/git/refs'){
      const data=JSON.parse(body);
      assert.deepEqual(data,{ref:'refs/heads/'+BRANCH,sha:MAIN});
      if(branch)return json(422,{message:'Reference already exists'});
      branch=MAIN;writes++;
      return json(201,{ref:'refs/heads/'+BRANCH,object:{sha:MAIN}});
    }
    if(method==='POST'&&p==='/repos/'+REPOSITORY+'/git/blobs'){
      const data=JSON.parse(body);
      assert.equal(data.encoding,'base64');
      assert.equal(Buffer.from(data.content,'base64').toString(),'fixture edited site');
      writes++;
      return json(201,{sha:BLOB});
    }
    if(method==='POST'&&p==='/repos/'+REPOSITORY+'/git/trees'){
      const data=JSON.parse(body);
      assert.equal(data.base_tree,TREE0);
      assert.deepEqual(data.tree,[{path:FILE,mode:'100644',type:'blob',sha:BLOB}]);
      writes++;
      return json(201,{sha:TREE1});
    }
    if(method==='POST'&&p==='/repos/'+REPOSITORY+'/git/commits'){
      const data=JSON.parse(body);
      assert.equal(data.tree,TREE1);
      assert.deepEqual(data.parents,[MAIN]);
      commits.set(NEXT,{sha:NEXT,tree:{sha:TREE1},parents:[{sha:MAIN}]});
      writes++;
      return json(201,{sha:NEXT});
    }
    if(method==='PATCH'&&p==='/repos/'+REPOSITORY+'/git/refs/heads/'+BRANCH){
      const data=JSON.parse(body);
      assert.deepEqual(data,{sha:NEXT,force:false});
      assert.equal(branch,MAIN);
      branch=NEXT;writes++;
      return json(200,{ref:'refs/heads/'+BRANCH,object:{sha:NEXT}});
    }
    return json(500,{message:'unexpected '+method+' '+p});
  }
  return {
    request,
    setCompareFiles(value){compareFiles=value;},
    get branch(){return branch;},
    get writes(){return writes;}
  };
}

test('one Save creates only the dedicated draft ref and site-content blob, then verifies it',async()=>{
  const remote=fakeGithub();
  const store=createOriginalAdminGitHubStore({
    enabledByExplicitOwnerApproval:true,repository:REPOSITORY,
    token:'fictional_test_token_12345',request:remote.request,
    validate(bytes){
      assert.equal(bytes.toString(),'fixture edited site');
      return {blobSha:BLOB,sha256:HASH};
    }
  });
  const before=await store.status();
  assert.equal(before.branchExists,false);
  assert.equal(before.expectedHead,MAIN);
  assert.equal(before.liveMainWriteAllowed,false);
  const saved=await store.save(Buffer.from('fixture edited site'),MAIN);
  assert.equal(saved.result,'saved-to-github-draft');
  assert.equal(saved.parentCommit,MAIN);
  assert.equal(saved.commit,NEXT);
  assert.equal(saved.blobSha,BLOB);
  assert.equal(saved.published,false);
  assert.equal(remote.branch,NEXT);
  assert.equal(remote.writes,5);
});

test('existing draft branch is refused if anything except site-content.html differs from main',async()=>{
  const remote=fakeGithub();
  const store=createOriginalAdminGitHubStore({
    enabledByExplicitOwnerApproval:true,repository:REPOSITORY,
    token:'fictional_test_token_12345',request:remote.request,
    validate:()=>({blobSha:BLOB,sha256:HASH})
  });
  await store.save(Buffer.from('fixture edited site'),MAIN);
  remote.setCompareFiles([{filename:'index.html'}]);
  await assert.rejects(store.status(),/unexpected file change/);
});

test('git blob identity helper matches Git framing',()=>{
  const bytes=Buffer.from('abc');
  const crypto=require('node:crypto');
  const expected=crypto.createHash('sha1')
    .update(Buffer.from('blob 3\0abc','utf8')).digest('hex');
  assert.equal(gitBlobOid(bytes),expected);
});

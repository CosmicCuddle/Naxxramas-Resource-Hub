'use strict';
/*
 * Complete server-side GitHub Save transport integration, with an injected
 * fictional GitHub REST/GraphQL server. NEVER uses credentials or live I/O.
 *
 * This proves the physical 415-path -> blob upload -> tree -> one-parent
 * commit -> exact old ref -> entire reconstructed remote tree readback
 * contract together. Real authenticated GitHub testing remains owner-gated.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {filePaths,COUNT}=require('../tools/rehearse-resource-only-overlay.cjs');
const {gitBlobOid,treeOid}=require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const {rehearseSandboxRemoteSave}=require('../tools/rehearse-sandbox-remote-save.cjs');
const {createGitHubSandboxApi}=require('../tools/github-sandbox-api.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const {PAGES}=require('../tools/plan-page-draft.cjs');

const REPO='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01';
const BRANCH='editor-saves/full-synthetic-transport';
const OLD='a'.repeat(40),NEW='b'.repeat(40),RACE='c'.repeat(40);
const NODE='R_fictionalVerifiedTestNode';
const TOKEN='ghs_Fictional_Only_Never_A_Real_Token';
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const root='/repos/'+REPO;
function fixture(){
  const changed=[
    {path:RUNTIME,mode:'100644',bytes:Buffer.from('A rebuilt fictional full website')},
    {path:PAGES[0],mode:'100644',bytes:Buffer.from('Fictional edited first page')}
  ].map(x=>({...x,oid:gitBlobOid(x.bytes)}));
  const original=[
    {path:'index.html',mode:'100644',oid:gitBlobOid(Buffer.from('Protected original loader'))},
    {path:RUNTIME,mode:'100644',oid:gitBlobOid(Buffer.from('Original full website'))},
    {path:PAGES[0],mode:'100644',oid:gitBlobOid(Buffer.from('Original page'))}
  ];
  const overlay=Array.from(filePaths()).map((name,i)=>{
    const bytes=Buffer.from('Fictional source only '+i+' '+name);
    return {path:name,mode:'100644',bytes,oid:gitBlobOid(bytes)};
  });
  assert.equal(overlay.length,COUNT+1);
  const byName=new Map(original.map(x=>[x.path,x]));
  for(const x of [...changed,...overlay])byName.set(x.path,x);
  const expectedNext=treeOid(Array.from(byName.values()));
  const expectedBase=treeOid(original);
  const proof={
    format:'naxx-private-git-tree-intent-from-browser-zip-v1',
    reviewedGitCommit:OLD,originalTreeOid:expectedBase,
    proposedTreeOidCalculatedInMemory:expectedNext,
    newOverlayGitBlobs:COUNT+1,completeResourceCount:COUNT,
    changedExistingGitBlobs:changed.length,
    allOriginalFileModesPreserved:true,
    newCandidateFilesRegularMode100644:true,
    sourceLayoutOwnerApproved:false,realGitCommitObjectCreated:false,
    canApply:false,canPush:false,canPublish:false,
    changedPaths:changed.map(x=>({
      path:x.path,mode:x.mode,
      newGitBlobOid:x.oid,newSha256:sha256(x.bytes)
    }))
  };
  const options={
    candidate:{targetRepository:REPO,expectedParent:OLD,
      expectedBaseTree:expectedBase,expectedNextTree:expectedNext,
      proof,files:[...changed,...overlay]},
    branch:BRANCH,repositoryId:NODE,
    disposableTestOnly:true,publishDisabled:true,ownerBackupNotClaimed:true
  };
  return {original,options,expectedNext,expectedBase};
}
function fictionalGithub(fixture,behavior={}){
  const files=new Map(fixture.original.map(x=>[
    x.path,{path:x.path,mode:x.mode,oid:x.oid}
  ]));
  const counters={get:0,blobPosts:0,treePosts:0,commitPosts:0,mutations:0};
  let head=behavior.initialHead||OLD;
  let stagedTree=null,parent=null;
  const responses=[];
  async function send(request){
    assert.equal(request.headers.Authorization,'Bearer '+TOKEN);
    assert.ok(request.path==='/graphql'||request.path.startsWith(root+'/git/'));
    const data=request.body?JSON.parse(request.body):null;
    let response;
    if(request.path==='/graphql'){
      assert.equal(request.method,'POST');
      if(data.query.startsWith('query')){
        response={data:{repository:{id:NODE,nameWithOwner:REPO}}};
      }else{
        counters.mutations++;
        const input=data.variables.input;
        const ref=input.refUpdates[0];
        assert.equal(ref.name,'refs/heads/'+BRANCH);
        assert.equal(ref.beforeOid,OLD);
        assert.equal(ref.afterOid,NEW);
        assert.equal(ref.force,false);
        if(behavior.raceAtMutation)head=RACE;
        if(head!==ref.beforeOid){
          response={errors:[{message:'The expected old ref did not match'}]};
        }else{
          head=ref.afterOid;
          if(behavior.lostMutationReply)
            throw Error('Simulated lost confirmation after GitHub accepted a write');
          response={data:{updateRefs:{clientMutationId:input.clientMutationId}}};
        }
      }
    }else if(request.path===root+'/git/ref/heads/'+BRANCH){
      counters.get++;
      assert.equal(request.method,'GET');
      response={ref:'refs/heads/'+BRANCH,object:{sha:head}};
    }else if(request.path===root+'/git/blobs'){
      counters.blobPosts++;
      assert.equal(request.method,'POST');
      if(behavior.moveDuringBlobs&&counters.blobPosts===1)head=RACE;
      response={sha:gitBlobOid(Buffer.from(data.content,'base64'))};
    }else if(request.path===root+'/git/trees'&&request.method==='POST'){
      counters.treePosts++;
      assert.equal(data.base_tree,fixture.expectedBase);
      for(const x of data.tree)files.set(x.path,{
        path:x.path,mode:x.mode,oid:x.sha
      });
      stagedTree=treeOid(Array.from(files.values()));
      response={sha:behavior.wrongCreatedTree?RACE:stagedTree};
    }else if(request.path===root+'/git/commits'&&request.method==='POST'){
      counters.commitPosts++;
      assert.deepEqual(data.parents,[OLD]);
      assert.equal(data.tree,fixture.expectedNext);
      parent=data.parents[0];
      response={sha:NEW};
    }else if(request.path===root+'/git/commits/'+NEW){
      response={sha:NEW,tree:{sha:stagedTree},parents:[{sha:parent}]};
    }else if(request.path===root+'/git/trees/'+fixture.expectedNext+'?recursive=1'){
      response={sha:fixture.expectedNext,truncated:false,
        tree:[...files.values()].map(x=>({
          path:x.path,type:'blob',mode:x.mode,sha:x.oid
        }))};
      if(behavior.wrongReadbackTree)response.tree[0].sha=RACE;
    }else{
      throw Error('Unrecognized fictional sandbox API route: '+request.path);
    }
    responses.push(request.path);
    return {status:200,body:JSON.stringify(response)};
  }
  const api=createGitHubSandboxApi({
    enabledForExplicitSandboxTest:true,disposableTestApproved:true,
    repository:REPO,branch:BRANCH,token:TOKEN,request:send
  });
  return {api,counters,responses,get head(){return head;}};
}

test('real server adapter and full 415-object pipeline together verify remote exact-old Git ref and tree',async()=>{
  const f=fixture(),remote=fictionalGithub(f);
  const verified=await remote.api.readRepositoryNodeId();
  assert.equal(verified.nodeId,NODE);
  const result=await rehearseSandboxRemoteSave(f.options,remote.api);
  assert.equal(result.repository,REPO);
  assert.equal(result.branch,BRANCH);
  assert.equal(result.blobsVerified,COUNT+3);
  assert.equal(result.verifiedCompleteSiteTree,f.expectedNext);
  assert.equal(result.newCommit,NEW);
  assert.equal(result.exactOldHeadVerifiedAtMutation,true);
  assert.equal(result.remoteHeadAndTreeIndependentlyReadBack,true);
  assert.equal(result.sourceRepositoryNotTouched,true);
  assert.equal(result.productionSaveEnabled,false);
  assert.equal(result.canPublish,false);
  assert.equal(remote.head,NEW);
  assert.equal(remote.counters.blobPosts,COUNT+3);
  assert.equal(remote.counters.treePosts,1);
  assert.equal(remote.counters.commitPosts,1);
  assert.equal(remote.counters.mutations,1);
  assert.equal(remote.counters.get,3);
  assert.ok(remote.responses.includes(
    root+'/git/trees/'+f.expectedNext+'?recursive=1'));
});
test('stale head is rejected before uploading a single blob, never automatically retried',async()=>{
  const f=fixture(),remote=fictionalGithub(f,{initialHead:RACE});
  await remote.api.readRepositoryNodeId();
  await assert.rejects(rehearseSandboxRemoteSave(f.options,remote.api),/stale/);
  assert.equal(remote.counters.blobPosts,0);
  assert.equal(remote.counters.mutations,0);
});
test('head moving during 415 uploads refuses before the ref mutation and leaves new data unreferenced',async()=>{
  const f=fixture(),remote=fictionalGithub(f,{moveDuringBlobs:true});
  await remote.api.readRepositoryNodeId();
  await assert.rejects(rehearseSandboxRemoteSave(f.options,remote.api),/moved before/);
  assert.equal(remote.head,RACE);
  assert.equal(remote.counters.mutations,0);
});
test('lost GitHub mutation acknowledgement returns uncertain state despite a changed remote head',async()=>{
  const f=fixture(),remote=fictionalGithub(f,{lostMutationReply:true});
  await remote.api.readRepositoryNodeId();
  await assert.rejects(rehearseSandboxRemoteSave(f.options,remote.api),/REMOTE_OUTCOME_UNCERTAIN/);
  assert.equal(remote.head,NEW);
  assert.equal(remote.counters.mutations,1);
});
test('failed remote tree reconstruction is never reported as a verified Save',async()=>{
  const f=fixture(),remote=fictionalGithub(f,{wrongReadbackTree:true});
  await remote.api.readRepositoryNodeId();
  await assert.rejects(rehearseSandboxRemoteSave(f.options,remote.api),/REMOTE_OUTCOME_UNCERTAIN/);
  assert.equal(remote.counters.mutations,1);
});
test('a forged tree SHA on upload blocks commit and ref advance',async()=>{
  const f=fixture(),remote=fictionalGithub(f,{wrongCreatedTree:true});
  await remote.api.readRepositoryNodeId();
  await assert.rejects(rehearseSandboxRemoteSave(f.options,remote.api),/independent full-site proof/);
  assert.equal(remote.counters.commitPosts,0);
  assert.equal(remote.counters.mutations,0);
});

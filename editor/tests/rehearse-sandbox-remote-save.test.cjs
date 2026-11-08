'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {filePaths,COUNT}=require('../tools/rehearse-resource-only-overlay.cjs');
const {gitBlobOid}=require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const {rehearseSandboxRemoteSave,validateOptions,FORMAT}=
  require('../tools/rehearse-sandbox-remote-save.cjs');
const S=x=>crypto.createHash('sha256').update(x).digest('hex');
const REPO='example/disposable-naxx-save-test-only';
const OLD='a'.repeat(40),BASE='b'.repeat(40),
  NEXT_TREE='c'.repeat(40),NEW='d'.repeat(40),OTHER='e'.repeat(40);
const BRANCH='editor-saves/sandbox-integration';
function fixture(){
  const pages=[
    {path:'site-content.html',bytes:Buffer.from('Fictional rebuilt website'),mode:'100644'},
    {path:'rules/content.html',bytes:Buffer.from('Fictional edited rules'),mode:'100644'}
  ];
  const overlays=Array.from(filePaths()).map((p,i)=>({
    path:p,bytes:Buffer.from('Synthetic resource '+i+' '+p),mode:'100644'
  }));
  assert.equal(filePaths().size,COUNT+1);
  const files=[...pages,...overlays].map(x=>({...x,oid:gitBlobOid(x.bytes)}));
  const proof={
    format:'naxx-private-git-tree-intent-from-browser-zip-v1',
    reviewedGitCommit:OLD,originalTreeOid:BASE,
    proposedTreeOidCalculatedInMemory:NEXT_TREE,
    newOverlayGitBlobs:COUNT+1,completeResourceCount:COUNT,
    changedExistingGitBlobs:2,allOriginalFileModesPreserved:true,
    newCandidateFilesRegularMode100644:true,
    sourceLayoutOwnerApproved:false,realGitCommitObjectCreated:false,
    canApply:false,canPush:false,canPublish:false,
    changedPaths:pages.map(x=>({
      path:x.path,mode:x.mode,newGitBlobOid:gitBlobOid(x.bytes),
      newSha256:S(x.bytes)
    }))
  };
  return {
    candidate:{targetRepository:REPO,expectedParent:OLD,
      expectedBaseTree:BASE,expectedNextTree:NEXT_TREE,proof,files},
    branch:BRANCH,repositoryId:'R_fictionalTestNodeId',
    disposableTestOnly:true,publishDisabled:true,ownerBackupNotClaimed:true
  };
}
function harness(flags={}){
  let head=OLD,blobs=0,trees=0,commits=0,reads=0,mutations=0;
  const objects={
    createBlob:async req=>{
      blobs++;
      assert.equal(req.repository,REPO);
      if(flags.failBlob&&blobs===2)throw Error('unknown blob outcome');
      if(flags.moveMidUpload&&blobs===1)head=OTHER;
      return {sha:gitBlobOid(Buffer.from(req.content,'base64'))};
    },
    createTree:async req=>{
      trees++;
      assert.equal(req.repository,REPO);
      assert.equal(req.base_tree,BASE);
      assert.equal(req.tree.length,417);
      return {sha:flags.wrongTree?OTHER:NEXT_TREE};
    },
    createCommit:async req=>{
      commits++;
      assert.deepEqual(req.parents,[OLD]);
      assert.equal(req.tree,NEXT_TREE);
      return {sha:NEW};
    },
    readCommit:async oid=>{
      assert.equal(oid,NEW);
      return {repository:REPO,sha:NEW,treeOid:NEXT_TREE,parents:[OLD]};
    }
  };
  const refs={
    readRef:async()=>{
      reads++;
      return {repository:REPO,branch:BRANCH,oid:head};
    },
    updateRefs:async(query,variables)=>{
      mutations++;
      assert.match(query,/updateRefs/);
      const item=variables.input.refUpdates[0];
      assert.equal(item.beforeOid,OLD);
      assert.equal(item.afterOid,NEW);
      assert.equal(item.force,false);
      if(flags.raceAtMutation)head=OTHER;
      if(head!==OLD)return {errors:[{message:'Stale branch'}]};
      head=NEW;
      if(flags.responseLost)throw Error('response lost AFTER real update');
      return {data:{updateRefs:{clientMutationId:variables.input.clientMutationId}}};
    },
    readCommit:async()=>({
      repository:REPO,commit:NEW,parentCommit:OLD,
      treeOid:flags.wrongReadbackTree?OTHER:NEXT_TREE,
      checkedBlobsAndPaths:true
    })
  };
  return {
    objects,refs,
    setHead:x=>{head=x;},
    get counts(){return {head,blobs,trees,commits,reads,mutations};}
  };
}
test('one source-checked 415-file snapshot becomes verified sandbox commit, exact-old ref update and readback',async()=>{
  const harnessed=harness();
  const result=await rehearseSandboxRemoteSave(fixture(),harnessed);
  assert.equal(result.format,FORMAT);
  assert.equal(result.blobsVerified,417);
  assert.equal(result.exactOldHeadVerifiedAtMutation,true);
  assert.equal(result.remoteHeadAndTreeIndependentlyReadBack,true);
  assert.equal(result.newCommit,NEW);
  assert.equal(result.verifiedCompleteSiteTree,NEXT_TREE);
  assert.equal(result.canPublish,false);
  assert.equal(result.productionSaveEnabled,false);
  assert.equal(result.ownerHeldBackupVerified,false);
  assert.deepEqual(harnessed.counts,{
    head:NEW,blobs:417,trees:1,commits:1,reads:3,mutations:1
  });
});
test('pre-existing stale head refuses BEFORE uploading any Git objects',async()=>{
  const h=harness();h.setHead(OTHER);
  await assert.rejects(rehearseSandboxRemoteSave(fixture(),h),/stale/);
  assert.equal(h.counts.blobs,0);
  assert.equal(h.counts.mutations,0);
});
test('branch moving while blobs upload refuses at second check and never mutates ref',async()=>{
  const h=harness({moveMidUpload:true});
  await assert.rejects(rehearseSandboxRemoteSave(fixture(),h),/moved before/);
  assert.equal(h.counts.blobs,417);
  assert.equal(h.counts.mutations,0);
  assert.equal(h.counts.head,OTHER);
});
test('lost response AFTER successful remote update must remain uncertain; no automatic retry',async()=>{
  const h=harness({responseLost:true});
  await assert.rejects(rehearseSandboxRemoteSave(fixture(),h),/OUTCOME_UNCERTAIN/);
  assert.equal(h.counts.mutations,1);
  assert.equal(h.counts.head,NEW);
});
test('last-moment ref race, wrong tree and broken uploads never produce a Save receipt',async()=>{
  for(const options of [
    {raceAtMutation:true},{wrongReadbackTree:true},
    {wrongTree:true},{failBlob:true}
  ]){
    const h=harness(options);
    await assert.rejects(rehearseSandboxRemoteSave(fixture(),h));
    assert.ok(h.counts.mutations<=1);
  }
});
test('production repository, prohibited path, false approval and forged source tree reject BEFORE uploading blobs',async()=>{
  const original=fixture();
  const prohibited=[
    {...original,candidate:{...original.candidate,
      targetRepository:'CosmicCuddle/Naxxramas-Resource-Hub'}},
    {...original,disposableTestOnly:false},
    {...original,publishDisabled:false},
    {...original,ownerBackupNotClaimed:false},
    {...original,branch:'main'},
    {...original,candidate:{...original.candidate,
      proof:{...original.candidate.proof,
        changedPaths:original.candidate.proof.changedPaths.map((f,i)=>
          i===1?{...f,path:'assets/private.js'}:f)}}},
    {...original,candidate:{...original.candidate,
      expectedNextTree:OTHER}}
  ];
  for(const candidate of prohibited){
    const h=harness();
    await assert.rejects(rehearseSandboxRemoteSave(candidate,h));
    assert.equal(h.counts.blobs,0);
    assert.equal(h.counts.mutations,0);
  }
  assert.equal(validateOptions(original).source.overlayFiles,415);
});
test('composition cannot fetch credentials, call GitHub itself, target live Save or auto retry',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','tools',
    'rehearse-sandbox-remote-save.cjs'),'utf8');
  for(const term of ['fetch(', 'node:https','node:http',
    'Authorization:','process.env.','GITHUB_TOKEN','git push'])
    assert.equal(source.includes(term),false,term);
  assert.match(source,/attemptSandboxLease/);
  assert.match(source,/stageSandboxGitObjects/);
});

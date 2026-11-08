'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {filePaths,COUNT}=require('../tools/rehearse-resource-only-overlay.cjs');
const {gitBlobOid}=require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const {FORMAT,checkedCandidate,stageSandboxGitObjects}=
  require('../tools/stage-sandbox-git-objects.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const OLD='a'.repeat(40),BASE='b'.repeat(40),TREE='c'.repeat(40),NEW='d'.repeat(40);
const TARGET='example/disposable-naxx-save-test-only';
function setup(){
  const tracked=[
    {path:'site-content.html',mode:'100644',bytes:Buffer.from('Rebuilt fictional runtime')},
    {path:'rules/content.html',mode:'100644',bytes:Buffer.from('Edited fictional rules')}
  ];
  const sourceFiles=filePaths().map((name,i)=>({
    path:name,mode:'100644',bytes:Buffer.from('Synthetic source '+i+' '+name)
  }));
  const files=[...tracked,...sourceFiles].map(item=>({
    ...item,oid:gitBlobOid(item.bytes)
  }));
  const proof={
    format:'naxx-private-git-tree-intent-from-browser-zip-v1',
    reviewedGitCommit:OLD,originalTreeOid:BASE,
    proposedTreeOidCalculatedInMemory:TREE,
    newOverlayGitBlobs:COUNT+1,completeResourceCount:COUNT,
    changedExistingGitBlobs:2,
    allOriginalFileModesPreserved:true,
    newCandidateFilesRegularMode100644:true,
    sourceLayoutOwnerApproved:false,realGitCommitObjectCreated:false,
    canApply:false,canPush:false,canPublish:false,
    changedPaths:tracked.map(x=>({
      path:x.path,mode:x.mode,
      newGitBlobOid:gitBlobOid(x.bytes),newSha256:sha(x.bytes)
    }))
  };
  return {targetRepository:TARGET,expectedParent:OLD,expectedBaseTree:BASE,
    expectedNextTree:TREE,proof,files};
}
function api(overrides={}){
  const seen={blobs:0,trees:0,commits:0,readbacks:0};
  const mock={
    createBlob:async request=>{
      seen.blobs++;
      assert.equal(request.repository,TARGET);
      assert.equal(request.encoding,'base64');
      return {sha:gitBlobOid(Buffer.from(request.content,'base64'))};
    },
    createTree:async request=>{
      seen.trees++;
      assert.equal(request.repository,TARGET);
      assert.equal(request.base_tree,BASE);
      assert.equal(request.tree.length,COUNT+3);
      assert.ok(request.tree.every(x=>x.type==='blob'&&
        x.mode==='100644'&&/^[a-f0-9]{40}$/.test(x.sha)));
      return {sha:TREE};
    },
    createCommit:async request=>{
      seen.commits++;
      assert.equal(request.repository,TARGET);
      assert.equal(request.tree,TREE);
      assert.deepEqual(request.parents,[OLD]);
      return {sha:NEW};
    },
    readCommit:async commit=>{
      seen.readbacks++;
      assert.equal(commit,NEW);
      return {repository:TARGET,sha:NEW,treeOid:TREE,parents:[OLD]};
    },...overrides
  };
  return {mock,seen};
}
test('all 414 fragments + manifest and changed tracked paths are verified and staged before test commit',async()=>{
  const source=setup(),{mock,seen}=api();
  const selected=checkedCandidate(source);
  assert.equal(selected.overlayFiles,415);
  assert.equal(selected.changedTracked,2);
  assert.equal(selected.files.length,417);
  const result=await stageSandboxGitObjects(source,mock);
  assert.equal(seen.blobs,417);
  assert.equal(seen.trees,1);assert.equal(seen.commits,1);assert.equal(seen.readbacks,1);
  assert.equal(result.format,FORMAT);
  assert.equal(result.verifiedProposedTreeOid,TREE);
  assert.equal(result.proposedCommitOid,NEW);
  assert.equal(result.exactOneParentVerified,true);
  assert.equal(result.gitRefAdvanced,false);
  assert.equal(result.realWebsiteRepositoryWritten,false);
  assert.equal(result.productionSaveAuthorized,false);
  assert.equal(result.canPublish,false);
});
test('missing source, duplicate paths, forbidden repository, changed bytes/mode or forged tree refuse BEFORE upload',async()=>{
  const baseline=setup();
  const variants=[
    {...baseline,targetRepository:'CosmicCuddle/Naxxramas-Resource-Hub'},
    {...baseline,files:baseline.files.slice(1)},
    {...baseline,files:baseline.files.concat(baseline.files[0])},
    {...baseline,files:baseline.files.map((f,i)=>i===0?{...f,path:'index.html'}:f)},
    {...baseline,files:baseline.files.map((f,i)=>i===0?{...f,mode:'100755'}:f)},
    {...baseline,files:baseline.files.map((f,i)=>i===0?{...f,oid:OLD}:f)},
    {...baseline,proof:{...baseline.proof,sourceLayoutOwnerApproved:true}},
    {...baseline,proof:{...baseline.proof,newOverlayGitBlobs:414}},
    {...baseline,expectedParent:NEW},
    {...baseline,expectedNextTree:BASE}
  ];
  for(const variant of variants){
    const {mock,seen}=api();
    await assert.rejects(stageSandboxGitObjects(variant,mock));
    assert.equal(seen.blobs,0);
    assert.equal(seen.trees,0);
    assert.equal(seen.commits,0);
  }
});
test('wrong Git test blob stops upload before creating any tree or commit',async()=>{
  const {mock,seen}=api({createBlob:async()=>{seen.blobs++;return {sha:OLD};}});
  await assert.rejects(stageSandboxGitObjects(setup(),mock),/blob identity/);
  assert.equal(seen.blobs,1);
  assert.equal(seen.trees,0);
  assert.equal(seen.commits,0);
});
test('uncertain blob response never retries, and no tree/commit follows',async()=>{
  const {mock,seen}=api({createBlob:async()=>{seen.blobs++;throw Error('lost response');}});
  await assert.rejects(stageSandboxGitObjects(setup(),mock),/OUTCOME_UNCERTAIN/);
  assert.equal(seen.blobs,1);
  assert.equal(seen.trees,0);
});
test('wrong staged Git tree is rejected before commit or ref update',async()=>{
  const {mock,seen}=api({createTree:async()=>{seen.trees++;return {sha:OLD};}});
  await assert.rejects(stageSandboxGitObjects(setup(),mock),/independent full-site proof/);
  assert.equal(seen.blobs,417);
  assert.equal(seen.trees,1);
  assert.equal(seen.commits,0);
});
test('incorrect commit parent or tree after upload rejects readback without updating a ref',async()=>{
  const {mock,seen}=api({readCommit:async()=>({
    repository:TARGET,sha:NEW,treeOid:TREE,parents:[OLD,'f'.repeat(40)]
  })});
  await assert.rejects(stageSandboxGitObjects(setup(),mock),/OUTCOME_UNCERTAIN/);
  assert.equal(seen.commits,1);
});
test('sandbox stage module owns no network connection, Git credential, or Git push',()=>{
  const code=fs.readFileSync(path.join(__dirname,'..','tools',
    'stage-sandbox-git-objects.cjs'),'utf8');
  for(const forbidden of ['fetch(', 'node:https', 'node:http',
    'git push','GITHUB_TOKEN','Authorization:','process.env.'])
    assert.equal(code.includes(forbidden),false,forbidden);
});

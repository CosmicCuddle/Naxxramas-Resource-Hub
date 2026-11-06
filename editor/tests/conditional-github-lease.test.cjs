'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {
  FORMAT,makeFakeTree,makeFakeReceipt,createFakeRemote,
  reviewThenSimulate,demonstrate
}=require('../tools/rehearse-conditional-github-lease.cjs');
const {recordPath,MANIFEST,COUNT}=require('../tools/rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const INITIAL='a'.repeat(40);
function context(){
  const remote=createFakeRemote({initialHead:INITIAL,tree:makeFakeTree()});
  const tree=remote.snapshot();
  return {remote,tree,one:makeFakeReceipt(tree,0,[0]),
    other:makeFakeReceipt(tree,0,[413])};
}
function reviewed(remote,receipt,head=INITIAL,hook){
  return reviewThenSimulate({remote,expectedHead:head,receipt,
    beforeConditional:hook});
}
test('one hypothetical save advances only fictional Git data and never grants GitHub permissions',async()=>{
  const {remote,tree,one}=context();
  const result=await reviewed(remote,one);
  assert.equal(result.format,FORMAT);
  assert.equal(result.simulatedResult,'accepted-in-memory-only');
  assert.equal(result.simulatedRevision,1);
  assert.equal(result.actualGitHubCASVerified,false);
  assert.equal(result.authenticatedGitHubBranchLocked,false);
  assert.equal(result.canApply,false);
  assert.equal(result.canPush,false);
  assert.equal(result.canMerge,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.sourceBytesWritten,0);
  assert.equal(result.githubRepositoryWrites,0);
  assert.equal(result.ownerApprovalObtained,false);
  assert.equal(remote.revision(),1);
  assert.equal(remote.metrics().accepted,1);
  assert.equal(remote.metrics().githubWrites,0);
  const updated=remote.snapshot(),changed=new Set(one.proposedPaths.map(x=>x.path));
  assert.equal(Object.keys(updated).length,Object.keys(tree).length);
  for(const [file,descriptor] of Object.entries(tree)){
    if(changed.has(file))assert.notEqual(updated[file].sha256,descriptor.sha256);
    else assert.deepEqual(updated[file],descriptor);
  }
  assert.equal(Object.isFrozen(result),true);
});
test('second owner session is refused after first fictional session advances an unrelated resource',async()=>{
  const {remote,other,one}=context();
  await reviewed(remote,one);
  await assert.rejects(reviewed(remote,other),/advanced before/);
  assert.equal(remote.metrics().accepted,1);
  assert.equal(remote.metrics().attempts,1);
  assert.equal(remote.snapshot()[recordPath(413)].sha256,
    makeFakeTree()[recordPath(413)].sha256);
});
test('a branch moving after both remote reads is caught by a hypothetical atomic lease',async()=>{
  const {remote,one}=context();
  let hookCount=0;
  await assert.rejects(reviewed(remote,one,INITIAL,candidate=>{
    hookCount++;
    return remote.tryConditionalAdvance({
      expectedHead:INITIAL,receipt:one,candidate
    });
  }),/Simulated stale branch/);
  assert.equal(hookCount,1);
  assert.equal(remote.metrics().attempts,2);
  assert.equal(remote.metrics().accepted,1);
  assert.equal(remote.metrics().refused,1);
  assert.equal(remote.metrics().githubWrites,0);
});
test('two simultaneous synthetic saves from the same reviewed head yield exactly one winner',async()=>{
  const {remote,one,other}=context();
  const gate=[];
  const barrier=()=>new Promise(resolve=>{
    gate.push(resolve);
    if(gate.length===2)for(const done of gate)done();
  });
  const outcomes=await Promise.allSettled([
    reviewed(remote,one,INITIAL,barrier),
    reviewed(remote,other,INITIAL,barrier)
  ]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
  assert.match(String(outcomes.find(x=>x.status==='rejected').reason),
    /Simulated stale branch/);
  assert.equal(remote.metrics().accepted,1);
  assert.equal(remote.metrics().refused,1);
  assert.equal(remote.revision(),1);
});
test('staged candidate with wrong parent, extra path or forged hash is refused without mutation',()=>{
  for(const corruption of ['parent','extra','hash','revision','identity']){
    const {remote,one}=context();
    const original=remote.makeCandidate(INITIAL,one);
    const fake={...original,updates:original.updates.map(x=>({...x}))};
    if(corruption==='parent')fake.parentCommit='b'.repeat(40);
    if(corruption==='extra')fake.updates.push({
      path:'index.html',previousSha256:'a'.repeat(64),
      nextSha256:'b'.repeat(64),nextBytes:1});
    if(corruption==='hash')fake.updates[0].nextSha256='c'.repeat(64);
    if(corruption==='revision')fake.revisionTo=500;
    if(corruption==='identity')fake.proposedCommit='f'.repeat(40);
    assert.throws(()=>remote.tryConditionalAdvance({
      expectedHead:INITIAL,receipt:one,candidate:fake
    }),/invalid|identity/i,corruption);
    assert.equal(remote.revision(),0);
    assert.equal(remote.head(),INITIAL);
    assert.equal(remote.metrics().accepted,0);
  }
});
test('out-of-date receipt is rejected when attempting to stage, even without conflicting file edits',async()=>{
  const {remote,one,other}=context();
  await reviewed(remote,one);
  assert.throws(()=>remote.makeCandidate(remote.head(),other),
    /Review source revision/);
  assert.equal(remote.revision(),1);
});
test('invalid review receipt and unexpected path never reach a simulated update',async()=>{
  const {remote,one}=context();
  const forged={...one,canApply:true};
  await assert.rejects(reviewed(remote,forged),/receipt shape or source revision/);
  const paths=one.proposedPaths.map(x=>({...x}));
  paths[0].path='index.html';
  const unsafe={...one,proposedPaths:paths};
  await assert.rejects(reviewed(remote,unsafe),/Proposed Git path/);
  assert.equal(remote.metrics().attempts,0);
});
test('snapshot and tree metadata are detached so callers cannot silently alter the simulated branch',()=>{
  const {remote}=context();
  const snapshot=remote.snapshot();
  snapshot[MANIFEST].sha256='f'.repeat(64);
  delete snapshot[RUNTIME];
  assert.notEqual(remote.snapshot()[MANIFEST].sha256,'f'.repeat(64));
  assert.ok(remote.snapshot()[RUNTIME]);
  assert.equal(Object.keys(remote.snapshot()).length,COUNT+3);
});
test('fake remote refuses unknown repository or branch and has no real remote access',async()=>{
  const {remote}=context();
  await assert.rejects(remote.readRef('other/repo','main'),/unapproved branch/);
  assert.equal(remote.metrics().remoteNetworkRequests,0);
  assert.equal(remote.metrics().githubWrites,0);
});
test('standalone proof covers stale unrelated edit and a race after the last remote read',async()=>{
  const report=await demonstrate();
  assert.equal(report.format,FORMAT);
  assert.equal(report.firstFictionalUpdateAccepted,true);
  assert.equal(report.staleSecondSessionRefused,true);
  assert.equal(report.movedAfterLastReadRefused,true);
  assert.equal(report.simulatedAttemptCount,3);
  assert.equal(report.simulatedAccepted,2);
  assert.equal(report.simulatedStaleRefusals,1);
  assert.equal(report.everyWriteWasInMemory,true);
  assert.equal(report.externalNetworkCalls,0);
  assert.equal(report.realGitHubWrites,0);
  assert.equal(report.remoteBranchLocked,false);
  assert.equal(report.realCASVerified,false);
  assert.equal(report.canApply,false);
  assert.equal(report.canPush,false);
  assert.equal(report.canPublish,false);
});
test('simulation file has no live GitHub API methods, filesystem writers or source payload exports',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/rehearse-conditional-github-lease.cjs'),'utf8');
  for(const token of [
    "https.request(","fetch(","update_ref(","create_commit(",
    "writeFileSync(","fs.writeFile(","spawn(","execFileSync(",
    "GITHUB_TOKEN","process.env.GITHUB_TOKEN"
  ])assert.equal(source.includes(token),false,token+' is forbidden in simulation');
  assert.match(source,/IN MEMORY ONLY/);
  assert.match(source,/actualGitHubCASVerified:false/);
  assert.match(source,/githubRepositoryWrites:0/);
});

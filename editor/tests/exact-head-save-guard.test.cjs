'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {
  FORMAT,makeGuard,reviewCurrentHead,simulateAtomicUpdate
}=require('../tools/plan-exact-head-save-guard.cjs');
const {EXPECTED_REPO,EXPECTED_BRANCH}=
  require('../tools/rehearse-remote-github-head-preflight.cjs');
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
const make=(before=A,after=B)=>makeGuard({
  repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,
  reviewedHead:before,proposedHead:after
});

test('exact old-head guard records a single unapproved ref, never a save permission',()=>{
  const p=make();
  assert.equal(p.format,FORMAT);
  assert.equal(p.repository,EXPECTED_REPO);
  assert.equal(p.refName,'refs/heads/'+EXPECTED_BRANCH);
  assert.equal(p.expectedOldOid,A);
  assert.equal(p.proposedNewOid,B);
  assert.equal(p.requiredGitHubMechanism,'GraphQL updateRefs RefUpdate.beforeOid');
  assert.equal(p.requiredExpectedOidField,'beforeOid');
  assert.equal(p.requiredDestinationOidField,'afterOid');
  assert.equal(p.requiredForce,false);
  assert.equal(p.restFastForwardAloneIsInsufficient,true);
  assert.equal(p.twoRemoteReadsAreNotALock,true);
  assert.equal(p.sourceLayoutApproved,false);
  assert.equal(p.ownerApprovalRecorded,false);
  assert.equal(p.realGitHubCASVerified,false);
  assert.equal(p.canExecute,false);
  assert.equal(p.canApply,false);
  assert.equal(p.canPush,false);
  assert.equal(p.canMerge,false);
  assert.equal(p.canPublish,false);
  assert.equal(p.githubWrites,0);
  assert.equal(Object.isFrozen(p),true);
});

test('matching preflight read is explicitly not a server-enforced lock',()=>{
  const report=reviewCurrentHead(make(),A);
  assert.equal(report.sameAsReviewedHead,true);
  assert.equal(report.stale,false);
  assert.equal(report.branchLocked,false);
  assert.equal(report.realAtomicUpdateProven,false);
  assert.equal(report.networkRequests,0);
  assert.equal(report.gitHubWrites,0);
  assert.equal(report.canApply,false);
});

test('last-moment stale overwrite is refused even when the proposed commit may be fast-forward',()=>{
  // Fictional DAG: A -> B -> C. Session 2 reviewed A, while session 1
  // published B. REST force:false might accept C as a fast-forward of B,
  // whereas a server-side beforeOid=A condition must refuse it.
  const first=make(A,B),second=make(A,C);
  assert.equal(simulateAtomicUpdate(first,A).fakeHeadAfter,B);
  assert.equal(reviewCurrentHead(second,B).stale,true);
  assert.throws(()=>simulateAtomicUpdate(second,B),/Exact old head mismatch/);
  assert.equal(simulateAtomicUpdate(second,A).acceptedOnlyInMemory,true);
  assert.equal(simulateAtomicUpdate(second,A).repositoryWrites,0);
  assert.equal(simulateAtomicUpdate(second,A).realGitHubCASVerified,false);
});

test('wrong repo, main branch, invalid commits and no-change commits are refused',()=>{
  for(const item of [
    {repo:EXPECTED_REPO,branch:'main',reviewedHead:A,proposedHead:B},
    {repo:'attacker/sandbox',branch:EXPECTED_BRANCH,reviewedHead:A,proposedHead:B},
    {repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,reviewedHead:'bad',proposedHead:B},
    {repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,reviewedHead:A,proposedHead:'f'.repeat(41)},
    {repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,reviewedHead:A,proposedHead:A},
    {repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,reviewedHead:A,proposedHead:'G'.repeat(40)}
  ])assert.throws(()=>makeGuard(item),/invalid or unapproved/);
  assert.throws(()=>reviewCurrentHead(make(),'bad'),/invalid identity/);
});

test('forged approval, force-update and changed reference are refused',()=>{
  const guard=make();
  for(const edit of [
    {canPush:true},{canPublish:true},{canApply:true},{canExecute:true},
    {sourceLayoutApproved:true},{ownerApprovalRecorded:true},
    {requiredForce:true},{requiredExpectedOidField:'other'},
    {requiredDestinationOidField:'oid'},
    {refName:'refs/heads/main'}, {expectedOldOid:C},
    {githubWrites:1}, {realGitHubCASVerified:true},{unexpected:true}
  ])assert.throws(()=>reviewCurrentHead({...guard,...edit},A),
    /Untrusted or modified exact-head contract/);
});

test('contract module cannot call APIs, stage source or mutate Git',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/plan-exact-head-save-guard.cjs'),'utf8');
  for(const keyword of [
    'fetch(', 'https.request(', 'http.request(', 'execFileSync(',
    'writeFileSync(', 'create_commit(', 'update_ref(',
    'Authorization:', 'GITHUB_TOKEN', 'process.env.',
    'node:fs','node:https','node:http'
  ])assert.equal(source.includes(keyword),false,keyword);
  assert.match(source,/NON-EXECUTABLE REHEARSAL/);
  assert.match(source,/realGitHubCASVerified:false/);
});

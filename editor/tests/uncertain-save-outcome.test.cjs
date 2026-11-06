'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {makeGuard}=require('../tools/plan-exact-head-save-guard.cjs');
const {reconcile,FORMAT}=require('../tools/plan-uncertain-save-outcome.cjs');
const {EXPECTED_REPO,EXPECTED_BRANCH}=
  require('../tools/rehearse-remote-github-head-preflight.cjs');
const OLD='a'.repeat(40),NEW='b'.repeat(40),OTHER='c'.repeat(40);
const FULL='d'.repeat(64);
const guard=makeGuard({repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,
  reviewedHead:OLD,proposedHead:NEW});
const verifiedCandidate=()=>({
  commit:NEW,sourceSha256:FULL,allProposedPathsVerified:true,
  unchangedPathsVerified:true,resourceInventoryVerified:true
});
const check=options=>reconcile({
  guard,independentReviewedHead:OLD,expectedSiteSha256:FULL,...options
});

test('transport timeout without remote evidence is unresolved and never retried',()=>{
  for(const responseKind of ['timeout','connection-lost','unknown',
    'acknowledged','rejected','not-sent']){
    const outcome=check({responseKind});
    assert.equal(outcome.format,FORMAT);
    assert.equal(outcome.status,'unresolved-no-head');
    assert.equal(outcome.automaticRetryAllowed,false);
    assert.equal(outcome.retainOriginalDraft,true);
    assert.equal(outcome.manualReviewRequired,true);
    assert.equal(outcome.canApply,false);
    assert.equal(outcome.canPush,false);
    assert.equal(outcome.canPublish,false);
    assert.equal(outcome.githubWrites,0);
    assert.equal(outcome.networkRequests,0);
    assert.equal(outcome.externallyAuthenticatedGitHubObservation,false);
    assert.equal(Object.isFrozen(outcome),true);
  }
});

test('an old observed head does not grant replay after an uncertain request',()=>{
  for(const responseKind of ['timeout','acknowledged','not-sent']){
    const result=check({observedHead:OLD,responseKind});
    assert.equal(result.status,'old-head-observed-recheck-required');
    assert.equal(result.candidateEvidenceConsistent,false);
    assert.equal(result.automaticRetryAllowed,false);
    assert.equal(result.manualReviewRequired,true);
  }
});

test('another update advancing the branch is a conflict, even after HTTP acknowledgement',()=>{
  const result=check({observedHead:OTHER,responseKind:'acknowledged'});
  assert.equal(result.status,'conflicting-head-observed');
  assert.equal(result.canPush,false);
  assert.equal(result.retainOriginalDraft,true);
});

test('proposed head with no independent source evidence is not claimed as saved',()=>{
  const result=check({observedHead:NEW,responseKind:'acknowledged'});
  assert.equal(result.status,'candidate-head-unverified-stop');
  assert.equal(result.candidateEvidenceConsistent,false);
  assert.equal(result.manualReviewRequired,true);
});

test('proposed head and correct fictional metadata still require authentication',()=>{
  const result=check({observedHead:NEW,responseKind:'timeout',
    verifiedCandidate:verifiedCandidate()});
  assert.equal(result.status,'candidate-head-and-metadata-match-needs-authentication');
  assert.equal(result.candidateEvidenceConsistent,true);
  assert.equal(result.externallyAuthenticatedGitHubObservation,false);
  assert.equal(result.manualReviewRequired,true);
  assert.equal(result.automaticRetryAllowed,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.realRemoteCASValidated,false);
  assert.equal(result.actualGitHubSavePerformedByThisModule,false);
});

test('candidate mismatch, malformed evidence and missing resource integrity block success',()=>{
  const good=verifiedCandidate();
  for(const change of [
    {commit:OTHER},{sourceSha256:'e'.repeat(64)},
    {allProposedPathsVerified:false},
    {unchangedPathsVerified:false},
    {resourceInventoryVerified:false},{unexpected:true}
  ]){
    const r=check({observedHead:NEW,verifiedCandidate:{...good,...change}});
    assert.equal(r.status,'candidate-head-unverified-stop');
    assert.equal(r.candidateEvidenceConsistent,false);
    assert.equal(r.automaticRetryAllowed,false);
  }
  assert.throws(()=>check({observedHead:NEW,verifiedCandidate:[]}),
    /Malformed independent/);
  assert.throws(()=>check({observedHead:NEW,verifiedCandidate:'yes'}),
    /Malformed independent/);
});

test('malformed branch read, response or independent review pin refuses reconciliation',()=>{
  assert.throws(()=>check({observedHead:'invalid'}),/Malformed remote/);
  assert.throws(()=>check({responseKind:'success-please-retry'}),/Untrusted save/);
  assert.throws(()=>check({independentReviewedHead:OTHER}),/independent source review/);
  assert.throws(()=>check({guard:{...guard,canPush:true}}),
    /Untrusted or modified exact-head contract/);
  assert.throws(()=>check({expectedSiteSha256:'bad'}),/Untrusted save/);
  assert.throws(()=>check({guard:{...guard,refName:'refs/heads/main'}}),
    /Untrusted or modified exact-head contract/);
});

test('acknowledged response alone never overrides actual source and branch evidence',()=>{
  const a=check({observedHead:OLD,responseKind:'acknowledged'});
  const b=check({observedHead:OTHER,responseKind:'acknowledged'});
  const c=check({observedHead:NEW,responseKind:'acknowledged'});
  assert.deepEqual([a.status,b.status,c.status],[
    'old-head-observed-recheck-required',
    'conflicting-head-observed',
    'candidate-head-unverified-stop'
  ]);
});

test('no network, GitHub mutation, source writer or secret read exists in this module',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,
    '../tools/plan-uncertain-save-outcome.cjs'),'utf8');
  for(const forbidden of ['fetch(', 'https.request(', 'http.request(',
    'execFileSync(', 'writeFileSync(', 'update_ref(', 'create_commit(',
    'Authorization:', 'GITHUB_TOKEN', 'process.env.', 'node:fs',
    'node:child_process'])
    assert.equal(src.includes(forbidden),false,forbidden);
  assert.match(src,/automaticRetryAllowed:false/);
  assert.match(src,/actualGitHubSavePerformedByThisModule:false/);
});

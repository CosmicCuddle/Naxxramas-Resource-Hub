'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {
  EXPECTED_REPO,EXPECTED_BRANCH,FORMAT,
  validateIdentity,apiRefPath,parseReference,readReference,
  observeRemoteHead,fakeResponse,simulate
}=require('../tools/rehearse-remote-github-head-preflight.cjs');
const HEAD='a'.repeat(40),NEW='b'.repeat(40);
const okLocal=async expectedSha=>({
  checkedOutCommitMatched:expectedSha===HEAD,
  originalWebsiteSha256Matched:true,
  canPush:false,canPublish:false
});
function query(readRef,checkCheckout=okLocal,expectedSha=HEAD){
  return observeRemoteHead({repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,
    expectedSha,readRef,checkCheckout});
}
test('two matching remote observations and an independent local check grant review only',async()=>{
  let reads=0,locals=0;
  const result=await query(async()=>{
    reads++;return fakeResponse(EXPECTED_BRANCH,HEAD);
  },async s=>{
    locals++;return okLocal(s);
  });
  assert.equal(reads,2);assert.equal(locals,1);
  assert.equal(result.format,FORMAT);
  assert.equal(result.expectedCommit,HEAD);
  assert.equal(result.remoteRefReadCount,2);
  assert.equal(result.remoteRefSameAtTwoObservations,true);
  assert.equal(result.originalWebsiteSha256Matched,true);
  assert.equal(result.githubContentsReadOnly,true);
  assert.equal(result.remoteBranchLocked,false);
  assert.equal(result.atomicUpdateGuaranteed,false);
  assert.equal(result.actualEditorSaveConnected,false);
  assert.equal(result.sourceLayoutApproved,false);
  assert.equal(result.canApply,false);
  assert.equal(result.canPush,false);
  assert.equal(result.canMerge,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.repositoryWrites,0);
  assert.equal(Object.isFrozen(result),true);
});
test('remote branch changed before first check is rejected without inspecting local files',async()=>{
  let checks=0;
  await assert.rejects(query(async()=>fakeResponse(EXPECTED_BRANCH,NEW),
    async()=>{checks++;return okLocal(HEAD);}),/advanced before/);
  assert.equal(checks,0);
});
test('remote branch advances between two observations and fails closed',async()=>{
  let reads=0;
  await assert.rejects(query(async()=>fakeResponse(
    EXPECTED_BRANCH,++reads===1?HEAD:NEW)),/advanced during/);
  assert.equal(reads,2);
});
test('stale or forged local checkout proof rejects before second remote observation',async()=>{
  let reads=0;
  await assert.rejects(query(async()=>{
    reads++;return fakeResponse(EXPECTED_BRANCH,HEAD);
  },async()=>({
    checkedOutCommitMatched:true,originalWebsiteSha256Matched:false,
    canPush:false,canPublish:false
  })),/local checkout proof is missing/);
  assert.equal(reads,1);
  await assert.rejects(query(async()=>fakeResponse(EXPECTED_BRANCH,HEAD),
    async()=>({checkedOutCommitMatched:true,
      originalWebsiteSha256Matched:true,canPush:true,canPublish:false})),
    /local checkout proof is missing/);
});
test('wrong remote ref name, wrong object type, malformed SHA or inconsistent URL are refused',async()=>{
  const bad=[
    {ref:'refs/heads/main',object:{type:'commit',sha:HEAD}},
    {ref:'refs/heads/'+EXPECTED_BRANCH,object:{type:'tag',sha:HEAD}},
    {ref:'refs/heads/'+EXPECTED_BRANCH,object:{type:'commit',sha:'invalid'}},
    {ref:'refs/heads/'+EXPECTED_BRANCH,object:{type:'commit',sha:HEAD,
      url:'https://example.com/not-a-commit'}},
    {ref:'refs/tags/'+EXPECTED_BRANCH,object:{type:'commit',sha:HEAD}},
    null,[],{}
  ];
  for(const answer of bad){
    assert.throws(()=>parseReference(answer,EXPECTED_REPO,EXPECTED_BRANCH),
      /unexpected branch or non-commit ref|inconsistent commit metadata/);
    await assert.rejects(query(async()=>answer),
      /unexpected branch or non-commit ref|inconsistent commit metadata/);
  }
});
test('strict URL and identity allow only single GitHub reference in intended repository',()=>{
  assert.equal(apiRefPath(EXPECTED_REPO,EXPECTED_BRANCH),
    '/repos/CosmicCuddle/Naxxramas-Resource-Hub/git/ref/heads/'+
      EXPECTED_BRANCH);
  assert.equal(validateIdentity(EXPECTED_REPO,EXPECTED_BRANCH,HEAD).sha,HEAD);
  for(const [repo,branch,sha] of [
    ['another/repo/extra',EXPECTED_BRANCH,HEAD],
    ['../repo',EXPECTED_BRANCH,HEAD],
    [EXPECTED_REPO,'../main',HEAD],
    [EXPECTED_REPO,'main..test',HEAD],
    [EXPECTED_REPO,'-danger',HEAD],
    [EXPECTED_REPO,EXPECTED_BRANCH,'not-a-sha'],
    [EXPECTED_REPO,EXPECTED_BRANCH,'A'.repeat(40)]
  ])assert.throws(()=>validateIdentity(repo,branch,sha),
    /Invalid pinned GitHub/);
  assert.equal(parseReference({
    ...fakeResponse(EXPECTED_BRANCH,HEAD),
    object:{type:'commit',sha:HEAD,
      url:'https://api.github.com/repos/CosmicCuddle/Naxxramas-Resource-Hub/git/commits/'+HEAD}
  },EXPECTED_REPO,EXPECTED_BRANCH),HEAD);
});
test('no missing or unsafe credentials can initiate a network request',async()=>{
  for(const token of ['',null,'bad\ninjected','short']){
    await assert.rejects(readReference(EXPECTED_REPO,EXPECTED_BRANCH,token),
      /token was not provided/);
  }
});
test('transport failure is not converted to approval or silent retry',async()=>{
  let n=0;
  await assert.rejects(query(async()=>{
    n++;throw Error('Read-only GitHub request unavailable.');
  }),/unavailable/);
  assert.equal(n,1);
  await assert.rejects(query(async()=>fakeResponse(EXPECTED_BRANCH,HEAD),null),
    /Both independent remote and local review functions/);
});
test('standalone demonstration uses in-memory ref responses and no network',async()=>{
  const report=await simulate();
  assert.equal(report.format,'naxx-remote-read-only-simulation-v1');
  assert.equal(report.matchingTwoReads,true);
  assert.equal(report.staleRemoteBeforeRejected,true);
  assert.equal(report.staleRemoteBetweenRejected,true);
  assert.equal(report.privateRepositoryDataPrinted,false);
  assert.equal(report.networkRequests,0);
  assert.equal(report.gitWrites,0);
  assert.equal(report.canPush,false);
  assert.equal(report.ownerApproved,false);
});
test('remote preflight module has a fixed GET-only API host, no write endpoints or direct source transfer',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/rehearse-remote-github-head-preflight.cjs'),'utf8');
  assert.match(source,/hostname:'api\.github\.com'/);
  assert.match(source,/method:'GET'/);
  assert.match(source,/GITHUB_EVENT_NAME!=='push'/);
  assert.match(source,/GITHUB_REF!=='refs\/heads\/'/);
  assert.match(source,/GITHUB_REPOSITORY!==EXPECTED_REPO/);
  assert.match(source,/GITHUB_TOKEN/);
  for(const forbidden of [
    "method:'POST'","method:'PATCH'","method:'PUT'",
    "method:'DELETE'",'https://github.com/repos/',
    'Authorization: Bearer '+HEAD
  ])assert.equal(source.includes(forbidden),false);
});

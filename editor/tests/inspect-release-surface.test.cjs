'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {BRANCHES,FORMAT,approvedEndpoint,checkedBranch,checkedRulesets,
  checkedPages,checkResearchIdentity,inspectReleaseSurface}=
  require('../tools/inspect-release-surface.cjs');
const REPO='CosmicCuddle/Naxxramas-Resource-Hub';
const COMMIT='a'.repeat(40),OTHER='b'.repeat(40);
const meta=(branch,commit=COMMIT,protectedValue=false)=>({
  httpStatus:200,
  data:{name:branch,commit:{sha:commit},
    protected:protectedValue,protection:{enabled:protectedValue}}
});
const rules=(items=[])=>({httpStatus:200,data:items});
const pagesUnknown={httpStatus:403,unavailable:true};
const urls=['rulesets','pages',...BRANCHES];
function fakeReader({changedResearch=false,protectedValue=false,
                     rs=rules(),pages=pagesUnknown}={}){
  let researchReads=0;const calls=[];
  const read=async name=>{
    calls.push(name);
    if(name==='rulesets')return rs;
    if(name==='pages')return pages;
    if(!BRANCHES.includes(name))throw Error('unexpected fixture read');
    if(name===BRANCHES[2]&&changedResearch&&++researchReads===2)
      return meta(name,OTHER,protectedValue);
    if(name===BRANCHES[2])researchReads++;
    return meta(name,COMMIT,protectedValue);
  };
  return {read,calls};
}
test('unprotected branches are reported accurately and never grant Save rights',async()=>{
  const r=fakeReader();
  const result=await inspectReleaseSurface({expectedResearchSha:COMMIT,read:r.read});
  assert.equal(result.format,FORMAT);
  assert.equal(result.branches.length,3);
  assert.equal(result.branches.every(x=>x.protected===false),true);
  assert.equal(result.branches.every(x=>x.protectionEnabled===false),true);
  assert.equal(result.anyBranchReportedUnprotected,true);
  assert.equal(result.listedRulesets,0);
  assert.equal(result.pages.pagesApiReadable,false);
  assert.equal(result.pages.githubPagesEnabledKnown,false);
  assert.equal(result.pages.githubPagesEnabled,null);
  assert.deepEqual(r.calls,[...BRANCHES,'rulesets','pages',BRANCHES[2]]);
  assert.equal(result.branchLocked,false);
  assert.equal(result.branchProtectionAuthorizationVerified,false);
  assert.equal(result.allDeployTriggersIndependentlyAudited,false);
  assert.equal(result.externalHostingServicesChecked,false);
  assert.equal(result.durableBackupRetained,false);
  assert.equal(result.ownerApproved,false);
  assert.equal(result.canSave,false);
  assert.equal(result.canMerge,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.canDeploy,false);
  assert.equal(result.refWrites,0);
  assert.equal(result.websiteFilesWritten,0);
  assert.equal(Object.isFrozen(result),true);
});
test('protected metadata never turns this read-only audit into Save authorization',async()=>{
  const r=fakeReader({protectedValue:true,
    rs:rules([{id:12,name:'Sample policy',enforcement:'active'}])});
  const v=await inspectReleaseSurface({expectedResearchSha:COMMIT,read:r.read});
  assert.equal(v.anyBranchReportedUnprotected,false);
  assert.equal(v.listedRulesets,1);
  assert.equal(v.branchProtectionAuthorizationVerified,false);
  assert.equal(v.canSave,false);
  assert.equal(v.canPublish,false);
});
test('research branch must match event-pinned head before AND after settings reads',async()=>{
  await assert.rejects(inspectReleaseSurface({
    expectedResearchSha:OTHER,read:fakeReader().read
  }),/moved before/);
  await assert.rejects(inspectReleaseSurface({
    expectedResearchSha:COMMIT,read:fakeReader({changedResearch:true}).read
  }),/changed during settings review/);
});
test('invalid branch protection payloads are rejected, not assumed protected',()=>{
  const missing=[
    null,{},[],{httpStatus:200,data:{name:BRANCHES[0],commit:{sha:COMMIT}}},
    meta('wrong',COMMIT),meta(BRANCHES[0],'INVALID'),
    {httpStatus:200,data:{name:BRANCHES[0],commit:{sha:COMMIT},
      protected:'false',protection:{enabled:false}}},
    {httpStatus:200,data:{name:BRANCHES[0],commit:{sha:COMMIT},
      protected:false,protection:{enabled:'false'}}}
  ];
  for(const r of missing)
    assert.throws(()=>checkedBranch(r,BRANCHES[0]),/unavailable/);
});
test('rulesets must be an actual checked listing, not a missing or forged receipt',()=>{
  for(const v of [null,{},rules('not array'),rules([{id:1,name:'Test'}]),
    rules([{id:1,name:'a',enforcement:'active'},
      {id:1,name:'b',enforcement:'disabled'}]),
    rules([{id:2,name:'something',enforcement:2}])])
    assert.throws(()=>checkedRulesets(v),/unavailable|Malformed|duplicate/);
  assert.equal(checkedRulesets(rules()).listedRulesets,0);
  assert.equal(checkedRulesets(rules([
    {id:7,name:'Private preview',enforcement:'evaluate'}
  ])).listedRulesets,1);
});
test('Pages absent or inaccessible is UNKNOWN, not proof of disabled hosting',()=>{
  for(const status of [403,404]){
    const x=checkedPages({unavailable:true,httpStatus:status});
    assert.equal(x.pagesApiReadable,false);
    assert.equal(x.githubPagesEnabledKnown,false);
    assert.equal(x.githubPagesEnabled,null);
  }
  const pages=checkedPages({httpStatus:200,data:{
    build_type:'legacy',source:{branch:'main',path:'/'}
  }});
  assert.equal(pages.githubPagesEnabled,true);
  assert.equal(pages.pagesSourceBranch,'main');
  assert.equal(pages.pagesBuildType,'legacy');
  assert.throws(()=>checkedPages({httpStatus:200,data:{
    source:{branch:3}}}),/Untrusted/);
});
test('fixed API allowlist blocks access to arbitrary hosts, configuration or secrets',()=>{
  for(const allowed of urls)
    assert.match(approvedEndpoint(allowed),/^\/repos\/CosmicCuddle\/Naxxramas-Resource-Hub\//);
  for(const denied of ['branches/main','../secrets','actions/permissions',
    'https://evil.invalid/','foo','branches/../main','secrets',
    'research/read-only-revision-chain-2026-11-08/other'])
    assert.throws(()=>approvedEndpoint(denied),/Unapproved/);
});
test('only exact research PR 57 event/branch/commit is accepted',()=>{
  const event={
    GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:REPO,
    GITHUB_REF:'refs/pull/57/merge',PR_NUMBER:'57',
    PR_HEAD_REPO:REPO,PR_HEAD_REF:BRANCHES[2],
    PR_HEAD_SHA:COMMIT,GITHUB_SHA:OTHER
  };
  assert.equal(checkResearchIdentity(event),COMMIT);
  for(const x of [
    {...event,GITHUB_EVENT_NAME:'push'},
    {...event,GITHUB_REF:'refs/pull/56/merge'},
    {...event,PR_NUMBER:'56'},
    {...event,PR_HEAD_REF:'main'},
    {...event,PR_HEAD_REPO:'wrong/repo'},
    {...event,PR_HEAD_SHA:'INVALID'}
  ])assert.throws(()=>checkResearchIdentity(x),/Only the same-repository/);
});
test('inspection source has no transport mutation, filesystem writer or leaked token',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'..','tools',
    'inspect-release-surface.cjs'),'utf8');
  for(const forbidden of ["method:'POST'","method:'PATCH'",
    "method:'PUT'","method:'DELETE'",'writeFileSync(',
    'fs.rmSync(', 'git push','update-ref','canSave:true',
    'canPublish:true','localStorage','console.log(token)','GITHUB_TOKEN='])
    assert.equal(source.includes(forbidden),false,forbidden);
  assert.match(source,/method:'GET'/);
  assert.match(source,/githubPagesEnabledKnown:false/);
  assert.match(source,/canSave:false/);
});

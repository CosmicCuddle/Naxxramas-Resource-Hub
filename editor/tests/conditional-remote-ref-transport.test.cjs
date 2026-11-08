'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {
  FORMAT,MUTATION,createSandboxProposal,attemptSandboxLease,safeBranch
}=require('../tools/conditional-remote-ref-transport.cjs');
const OLD='a'.repeat(40),NEW='b'.repeat(40),NEXT='c'.repeat(40);
const TREE='d'.repeat(40);
const TARGET='example/disposable-naxx-save-test-only';
function input(override={}){return{
  targetRepository:TARGET,repositoryId:'R_fictionalNodeIdForTests',
  branch:'editor-saves/disposable-check',
  oldCommit:OLD,newCommit:NEW,parentCommit:OLD,
  expectedTree:TREE,actualTree:TREE,
  fullSiteVerified:true,originalGitHistoryVerified:true,
  disposableTestOnly:true,boundedSourcePathsVerified:true,...override
};}
function fake(initial=OLD,flags={}) {
  let current=initial,updates=0,reads=0;
  return {
    readRef:async()=>{
      reads++;
      return {repository:TARGET,branch:'editor-saves/disposable-check',oid:current};
    },
    updateRefs:async(query,variables)=>{
      updates++;
      assert.equal(query,MUTATION);
      const provided=variables.input.refUpdates;
      assert.equal(provided.length,1);
      const rule=provided[0];
      assert.equal(rule.force,false);
      if(flags.timeoutAfterApply&&current===rule.beforeOid){
        current=rule.afterOid;throw Error('lost response');
      }
      if(flags.advanceDuringUpdate)current=NEXT;
      if(current!==rule.beforeOid)
        return {data:null,errors:[{message:'Ref moved'}]};
      current=rule.afterOid;
      return {data:{updateRefs:{clientMutationId:variables.input.clientMutationId}}};
    },
    readCommit:async()=>({repository:TARGET,commit:current,
      parentCommit:OLD,treeOid:flags.wrongTree?'f'.repeat(40):TREE,
      checkedBlobsAndPaths:true}),
    get state(){return {current,updates,reads};}
  };
}
test('constructs documented GraphQL updateRefs with exact beforeOid, afterOid and force false',()=>{
  const proposal=createSandboxProposal(input());
  assert.equal(proposal.format,FORMAT);
  assert.equal(proposal.canExecuteOnProduction,false);
  assert.equal(proposal.actualGitHubWriteApproved,false);
  assert.equal(proposal.githubWritesMade,0);
  assert.equal(proposal.graphqlQuery,MUTATION);
  const vars=proposal.graphqlVariables.input;
  assert.equal(vars.repositoryId,'R_fictionalNodeIdForTests');
  assert.equal(vars.refUpdates.length,1);
  assert.deepEqual(vars.refUpdates[0],{
    name:'refs/heads/editor-saves/disposable-check',
    beforeOid:OLD,afterOid:NEW,force:false
  });
  assert.match(vars.clientMutationId,/^naxx-sandbox-/);
});
test('a permitted injected sandbox transport checks old ref, updates once, and independently rereads head/tree',async()=>{
  const transport=fake(),proposal=createSandboxProposal(input());
  const result=await attemptSandboxLease(proposal,transport);
  assert.equal(transport.state.current,NEW);
  assert.equal(transport.state.updates,1);
  assert.equal(transport.state.reads,2);
  assert.equal(result.verifiedNewHead,NEW);
  assert.equal(result.independentlyVerifiedTree,TREE);
  assert.equal(result.refAndCommitReadBackVerified,true);
  assert.equal(result.productionGitHubSaveProven,false);
  assert.equal(result.canPublish,false);
});
test('wrong branch, main, real website repository, malformed Git identity and unverified files fail before remote work',()=>{
  const broken=[
    {targetRepository:'CosmicCuddle/Naxxramas-Resource-Hub'},
    {branch:'main'}, {branch:'feature/multi-file-editor-export-2026-11-05'},
    {branch:'editor-saves/../main'}, {branch:'editor-saves/a.lock'},
    {branch:'editor-saves/a//b'}, {branch:'editor-saves/a/'},
    {parentCommit:NEXT}, {oldCommit:'bad'}, {newCommit:OLD},
    {expectedTree:NEXT}, {fullSiteVerified:false},
    {originalGitHistoryVerified:false}, {disposableTestOnly:false},
    {boundedSourcePathsVerified:false},{repositoryId:'undefined'}
  ];
  for(const override of broken){
    if(Object.hasOwn(override,'repositoryId')&&override.repositoryId==='undefined')continue;
    assert.throws(()=>createSandboxProposal(input(override)),/isolated-test/);
  }
  assert.equal(safeBranch('editor-saves/normal'),true);
  assert.equal(safeBranch('refs/heads/main'),false);
});
test('stale ref before the update refuses without calling GraphQL',async()=>{
  const r=fake(NEXT);
  await assert.rejects(attemptSandboxLease(createSandboxProposal(input()),r),/moved before/);
  assert.equal(r.state.updates,0);
});
test('branch movement after the preflight and before update is refused with no retry',async()=>{
  const r=fake(OLD,{advanceDuringUpdate:true});
  await assert.rejects(attemptSandboxLease(createSandboxProposal(input()),r),/REMOTE_OUTCOME_UNCERTAIN/);
  assert.equal(r.state.current,NEXT);
  assert.equal(r.state.updates,1);
});
test('timeout after the remote branch moved is uncertain and never triggers a second submission',async()=>{
  const r=fake(OLD,{timeoutAfterApply:true});
  await assert.rejects(attemptSandboxLease(createSandboxProposal(input()),r),/REMOTE_OUTCOME_UNCERTAIN/);
  assert.equal(r.state.current,NEW);
  assert.equal(r.state.updates,1);
});
test('a GitHub-looking acknowledgement with the wrong tree is not a success',async()=>{
  const r=fake(OLD,{wrongTree:true});
  await assert.rejects(attemptSandboxLease(createSandboxProposal(input()),r),/cannot independently verify/);
  assert.equal(r.state.updates,1);
});
test('forged force, ref name, old sha, new sha, source permissions and mutation are all rejected',async()=>{
  const base=createSandboxProposal(input());
  function bad(changes,modify){
    const obj={...base,...changes,
      graphqlVariables:JSON.parse(JSON.stringify(base.graphqlVariables))};
    if(modify)modify(obj.graphqlVariables.input);
    return obj;
  }
  for(const invalid of [
    bad({actualGitHubWriteApproved:true}),
    bad({targetRepository:'CosmicCuddle/Naxxramas-Resource-Hub'}),
    bad({canPublish:true}),
    bad({beforeOid:NEXT}),
    bad({graphqlQuery:'mutation { deleteRef(...) }'}),
    bad({},x=>{x.refUpdates[0].force=true;}),
    bad({},x=>{x.refUpdates[0].name='refs/heads/main';}),
    bad({},x=>{x.refUpdates[0].afterOid=NEXT;}),
    bad({},x=>{x.refUpdates[0].beforeOid=NEXT;}),
    bad({},x=>{x.refUpdates.push({...x.refUpdates[0]});})
  ]){
    const r=fake();
    await assert.rejects(attemptSandboxLease(invalid,r),/sandbox-ref|unsafe|isolated/);
    assert.equal(r.state.updates,0);
  }
});
test('transport is injection-only: no built-in GitHub API, auth tokens, files or production pushes',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','tools',
    'conditional-remote-ref-transport.cjs'),'utf8');
  for(const forbidden of ['node:https','node:http','fetch(', 'https.request(',
    'git push','Authorization:','process.env.','GITHUB_TOKEN',
    'createCommitOnBranch(', 'force:true'])
    assert.equal(src.includes(forbidden),false,forbidden);
});

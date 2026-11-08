'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {
  FORMAT,RESEARCH_BRANCH,checkIdentity,commitApiPath,
  parseCommitTree,inspectLocalCheckout,inspectRemoteCommitTree,selectResearchCI
}=require('../tools/inspect-remote-commit-tree.cjs');
const {EXPECTED_REPO}=require('../tools/rehearse-remote-github-head-preflight.cjs');
const OLD='a'.repeat(40),OTHER='b'.repeat(40),TREE='c'.repeat(40);
const ref=sha=>({ref:'refs/heads/'+RESEARCH_BRANCH,
  object:{type:'commit',sha}});
const commit=tree=>({
  sha:OLD,url:'https://api.github.com'+commitApiPath(EXPECTED_REPO,OLD),
  tree:{sha:tree,url:
    'https://api.github.com/repos/CosmicCuddle/Naxxramas-Resource-Hub/git/trees/'+tree}
});
const validLocal=()=>({
  exactLocalCommitMatched:true,exactLocalTreeMatched:true,
  originalWebsiteGitBlobVerified:true,localCheckoutStable:true,
  canApply:false,canPush:false,canPublish:false
});
const inspect=(overrides={})=>inspectRemoteCommitTree({
  repo:EXPECTED_REPO,branch:RESEARCH_BRANCH,commit:OLD,
  readRef:async()=>ref(OLD),
  readCommit:async()=>commit(TREE),
  checkLocal:async()=>validLocal(),
  ...overrides
});
test('two exact branch reads and GitHub commit tree matching local proof allow review only',async()=>{
  const actions=[];
  const out=await inspect({
    readRef:async (repo,branch)=>{actions.push('ref');assert.equal(repo,EXPECTED_REPO);
      assert.equal(branch,RESEARCH_BRANCH);return ref(OLD);},
    readCommit:async (repo,sha)=>{actions.push('commit');assert.equal(sha,OLD);
      assert.equal(repo,EXPECTED_REPO);return commit(TREE);},
    checkLocal:async(sha,tree)=>{actions.push('local');assert.equal(sha,OLD);
      assert.equal(tree,TREE);return validLocal();}
  });
  assert.deepEqual(actions,['ref','commit','local','ref']);
  assert.equal(out.format,FORMAT);
  assert.equal(out.remoteCommit,OLD);
  assert.equal(out.remoteTree,TREE);
  assert.equal(out.remoteRefObservations,2);
  assert.equal(out.remoteCommitTreeReads,1);
  assert.equal(out.remoteTreeMatchesPinnedLocalTree,true);
  assert.equal(out.protectedOriginalGitBlobMatched,true);
  assert.equal(out.remoteMutationPerformed,false);
  assert.equal(out.branchLocked,false);
  assert.equal(out.everyRemoteBlobIndividuallyDownloaded,false);
  assert.equal(out.remoteAuthorIdentityVerified,false);
  assert.equal(out.ownerRetainedBackupVerified,false);
  assert.equal(out.userSourceLayoutApproved,false);
  assert.equal(out.approvedForSave,false);
  assert.equal(out.canApply,false);
  assert.equal(out.canPush,false);
  assert.equal(out.canPublish,false);
  assert.equal(out.gitHubWrites,0);
  assert.equal(Object.isFrozen(out),true);
});
test('a changed remote head before first read never inspects content',async()=>{
  let called=0;
  await assert.rejects(inspect({
    readRef:async()=>ref(OTHER),
    readCommit:async()=>{called++;return commit(TREE);}
  }),/moved before Git object/);
  assert.equal(called,0);
});
test('remote ref moving after tree review fails closed',async()=>{
  let calls=0;
  await assert.rejects(inspect({
    readRef:async()=>ref(++calls===1?OLD:OTHER)
  }),/moved during Git tree inspection/);
  assert.equal(calls,2);
});
test('unexpected remote commit SHA, tree SHA, and external API URLs are refused',async()=>{
  const invalid=[
    {...commit(TREE),sha:OTHER},
    {...commit(TREE),tree:{sha:'not-valid'}},
    {...commit(TREE),url:'https://not-github.example/git/commits/'+OLD},
    {...commit(TREE),tree:{sha:TREE,url:'https://example.org/tree'}},
    {...commit(TREE),tree:null},
    {sha:OLD},[],
    null
  ];
  for(const item of invalid){
    assert.throws(()=>parseCommitTree(item,EXPECTED_REPO,OLD),
      /not the exact pinned|mismatched API URL|points outside/);
    await assert.rejects(inspect({readCommit:async()=>item}),
      /not the exact pinned|mismatched API URL|points outside/);
  }
});
test('a forged or permission-granting local inspection is rejected',async()=>{
  const altered=[
    {...validLocal(),exactLocalTreeMatched:false},
    {...validLocal(),originalWebsiteGitBlobVerified:false},
    {...validLocal(),localCheckoutStable:false},
    {...validLocal(),canPush:true},
    {...validLocal(),canApply:true},
    {...validLocal(),canPublish:true},
    null,{},[]
  ];
  for(const proof of altered)
    await assert.rejects(inspect({checkLocal:async()=>proof}),
      /local Git object inspection is missing or unsafe/);
});
test('only the expected research branch and named GitHub repository can be inspected',async()=>{
  assert.equal(commitApiPath(EXPECTED_REPO,OLD),
    '/repos/CosmicCuddle/Naxxramas-Resource-Hub/git/commits/'+OLD);
  for(const [repo,branch,sha] of [
    ['other/repo',RESEARCH_BRANCH,OLD],
    [EXPECTED_REPO,'main',OLD],
    [EXPECTED_REPO,'feature/multi-file-editor-export-2026-11-05',OLD],
    [EXPECTED_REPO,RESEARCH_BRANCH,'0'.repeat(39)],
    [EXPECTED_REPO,RESEARCH_BRANCH,'A'.repeat(40)]
  ]) {
    assert.throws(()=>checkIdentity(repo,branch,sha),/Unapproved GitHub/);
    await assert.rejects(inspectRemoteCommitTree({
      repo,branch,commit:sha,readRef:async()=>ref(OLD),
      readCommit:async()=>commit(TREE),checkLocal:async()=>validLocal()
    }),/Unapproved GitHub/);
  }
});
test('only PR 57 same-repository head is accepted, never synthetic merge SHA',()=>{
  const env={
    GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:EXPECTED_REPO,
    GITHUB_REF:'refs/pull/57/merge',PR_NUMBER:'57',
    PR_HEAD_REPO:EXPECTED_REPO,PR_HEAD_REF:RESEARCH_BRANCH,
    PR_HEAD_SHA:OLD,GITHUB_SHA:OTHER
  };
  assert.equal(selectResearchCI(env),OLD);
  for(const invalid of [
    {...env,GITHUB_REF:'refs/pull/56/merge'},
    {...env,PR_NUMBER:'56'},
    {...env,PR_HEAD_REPO:'other/repo'},
    {...env,PR_HEAD_REF:'main'},
    {...env,PR_HEAD_SHA:'invalid'},
    {...env,GITHUB_EVENT_NAME:'push'},
    {...env,GITHUB_REPOSITORY:'attacker/project'}
  ])assert.throws(()=>selectResearchCI(invalid),
    /Only the exact protected same-repository research PR/);
});
test('real pinned LOCAL Git tree and immutable website can be checked read-only',()=>{
  // This assertion runs with the full original 31 MB source in GitHub CI.
  // PR merge commit vs branch head is irrelevant: use exact checkout HEAD.
  const root=path.resolve(__dirname,'..','..');
  const sha=execFileSync('git',['-C',root,'rev-parse','HEAD'],
    {encoding:'utf8'}).trim();
  const tree=execFileSync('git',['-C',root,'rev-parse','HEAD^{tree}'],
    {encoding:'utf8'}).trim();
  const before=fs.readFileSync(path.join(root,'site-content.html'));
  const result=inspectLocalCheckout(root,sha,tree);
  assert.equal(result.exactLocalCommitMatched,true);
  assert.equal(result.exactLocalTreeMatched,true);
  assert.equal(result.originalWebsiteGitBlobVerified,true);
  assert.equal(result.localCheckoutStable,true);
  assert.equal(result.canPush,false);
  assert.deepEqual(before,fs.readFileSync(path.join(root,'site-content.html')));
  assert.throws(()=>inspectLocalCheckout(root,sha,'d'.repeat(40)),
    /differs from GitHub/);
  assert.throws(()=>inspectLocalCheckout(root,'d'.repeat(40),tree),
    /differs from GitHub/);
});
test('source performs GET-only and cannot create, update, merge, publish or store secrets',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'..','tools',
    'inspect-remote-commit-tree.cjs'),'utf8');
  for(const forbidden of [
    "method:'POST'","method:'PATCH'","method:'PUT'","method:'DELETE'",
    'writeFileSync(', 'git push', 'git commit', 'update-ref',
    'readFileSync(', 'localStorage', 'createExclusive(', 'fs.rmSync(',
    'canPush:true','canApply:true','canPublish:true'
  ])assert.equal(src.includes(forbidden),false,forbidden);
  assert.match(src,/method:'GET'/);
  assert.match(src,/remoteRefObservations:2/);
  assert.match(src,/remoteMutationPerformed:false/);
});

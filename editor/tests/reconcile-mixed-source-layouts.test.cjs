'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process');
const {
  layoutInventory,assertJoinedPlans,reviewCombined,fictionalPageDraft,
  demonstrate,FORMAT
}=require('../tools/reconcile-mixed-source-layouts.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {PAGES,NAV}=require('../tools/plan-page-draft.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const {MANIFEST,recordPath}=require('../tools/rehearse-resource-only-overlay.cjs');
const {MANIFEST:OLD_MANIFEST,resourcePath:oldPath}=
  require('../tools/rehearse-proposed-resource-tree.cjs');
const root=path.resolve(__dirname,'..','..');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8'}).trim();
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const sampleResource=()=>({
  format:'naxx-local-resource-draft-v2',baselineSha256:SOURCE_SHA,
  changes:[{index:0,title:'Private cross-domain title'},
    {index:413,content:'Private separate content.\n\nA second paragraph.'}]
});
const bytes=value=>Buffer.from(JSON.stringify(value),'utf8');
function fakeJoined(){
  const h='a'.repeat(64),other='b'.repeat(64);
  const paged={path:PAGES[0],kind:'page',sourceSha256:h,nextSha256:other};
  const resource={path:oldPath(0),kind:'proposed-resource-fragment',
    sourceSha256:h,nextSha256:other};
  const complete={
    expectedOldSha256:SOURCE_SHA,proposedNewSha256:'c'.repeat(64)
  };
  const receipt={
    decision:'review-only',
    receipt:{
      proposedFullSiteSha256:complete.proposedNewSha256,
      proposedFileCount:3,editedResourceCount:1,
      proposedPaths:[
        {path:recordPath(0),kind:'proposed-resource-fragment',
          expectedOldSha256:h,proposedNewSha256:other},
        {path:MANIFEST,kind:'proposed-source-manifest',
          expectedOldSha256:h,proposedNewSha256:other},
        {path:RUNTIME,kind:'proposed-generated-runtime',
          ...complete}
      ]
    }
  };
  const baseline={
    pageDraftVerified:true,resourceDraftVerified:true,
    currentCheckoutCommitVerified:true,resourceRebuildExact:true,
    resourceRollbackExact:true,proposedSourceTreeCommitted:false,
    generatedSiteFileStaged:false,
    plannedGeneratedSiteSha256:complete.proposedNewSha256,
    changedExistingPagePaths:[paged],
    changedCandidateResourcePaths:[resource]
  };
  const pages={decision:'separate-page-review',
    proposedPageAndNavigationFiles:[{
      path:PAGES[0],kind:'page',
      expectedOldSha256:h,proposedNewSha256:other
    }]};
  return {layout:layoutInventory(),baseline,versioned:receipt,pageReview:pages};
}
test('the full 418 and resource-only 415 layouts are disjoint from all 6 protected tracked website sources',()=>{
  const value=layoutInventory();
  assert.equal(value.existingTrackedFileCount,6);
  assert.equal(value.fullSourceTreeFileCount,418);
  assert.equal(value.versionedResourceOnlyFileCount,415);
  assert.equal(value.resourceCount,414);
  assert.equal(value.disjointFromTrackedPagesAndRuntime,true);
  assert.equal(value.sourceLayoutsAreDistinct,true);
  assert.equal(value.sourceLayoutSelected,false);
  assert.equal(value.approved,false);
  assert.deepEqual(new Set(value.existingTrackedPaths),
    new Set([...PAGES,NAV,RUNTIME]));
  assert.equal(value.fullSourceTreeFileCount===value.versionedResourceOnlyFileCount,false);
  assert.ok(value.fullSourceTreeFileCount>value.versionedResourceOnlyFileCount);
  assert.ok(value.fullSourceTreeFileCount-value.versionedResourceOnlyFileCount===3);
  assert.ok(value.fullSourceTreeFileCount===418);
  assert.ok(value.versionedResourceOnlyFileCount===415);
  for(let i=0;i<414;i++){
    assert.ok(value.fullLayoutCandidatePaths.includes(oldPath(i)));
    assert.ok(value.resourceOnlyCandidatePaths.includes(recordPath(i)));
  }
  assert.ok(value.fullLayoutCandidatePaths.includes(OLD_MANIFEST));
  assert.ok(value.resourceOnlyCandidatePaths.includes(MANIFEST));
  assert.ok(!value.fullLayoutCandidatePaths.includes(RUNTIME));
  assert.ok(!value.resourceOnlyCandidatePaths.includes(RUNTIME));
});
test('fake independent page/resource plans reconcile into one blocked proposed path inventory',()=>{
  const v=fakeJoined();
  const paths=assertJoinedPlans(v.layout,v.baseline,v.versioned,v.pageReview);
  assert.equal(paths.length,4);
  assert.deepEqual(new Set(paths.map(p=>p.path)),
    new Set([PAGES[0],recordPath(0),MANIFEST,RUNTIME]));
  assert.equal(paths.filter(p=>p.trackedInCurrentGit).length,2);
  assert.equal(paths.filter(p=>!p.trackedInCurrentGit).length,2);
  assert.equal(Object.isFrozen(paths),true);
});
test('independent 418-file and 415-file planners must agree on generated HTML and every changed resource SHA',()=>{
  const v=fakeJoined();
  v.baseline.plannedGeneratedSiteSha256='f'.repeat(64);
  assert.throws(()=>assertJoinedPlans(v.layout,v.baseline,v.versioned,v.pageReview),
    /Independent source plans disagree/);
  const x=fakeJoined();
  x.baseline.changedCandidateResourcePaths[0].nextSha256='f'.repeat(64);
  assert.throws(()=>assertJoinedPlans(x.layout,x.baseline,x.versioned,x.pageReview),
    /same resource edit produced a different fragment checksum/);
  const y=fakeJoined();
  y.baseline.changedCandidateResourcePaths[0].path='../index.html';
  assert.throws(()=>assertJoinedPlans(y.layout,y.baseline,y.versioned,y.pageReview),
    /Legacy resource path is not mapped/);
  const z=fakeJoined();
  z.versioned.receipt.proposedPaths[0].path='content/resource-overlays/resources/0415.fragment';
  assert.throws(()=>assertJoinedPlans(z.layout,z.baseline,z.versioned,z.pageReview),
    /same resource edit produced a different fragment checksum/);
});
test('duplicate and conflicting existing page, navigation or generated-site paths fail closed',()=>{
  const v=fakeJoined();
  v.baseline.changedExistingPagePaths[0].path=RUNTIME;
  assert.throws(()=>assertJoinedPlans(v.layout,v.baseline,v.versioned,v.pageReview),
    /Independent page\/navigation source plans disagree/);
  const x=fakeJoined();
  x.pageReview.proposedPageAndNavigationFiles[0].nextSha256='f'.repeat(64);
  assert.throws(()=>assertJoinedPlans(x.layout,x.baseline,x.versioned,x.pageReview),
    /Independent page\/navigation source plans disagree/);
  const y=fakeJoined();
  y.baseline.resourceRebuildExact=false;
  assert.throws(()=>assertJoinedPlans(y.layout,y.baseline,y.versioned,y.pageReview),
    /Independent source plans disagree/);
  const z=fakeJoined();
  z.baseline.changedCandidateResourcePaths.push({
    ...z.baseline.changedCandidateResourcePaths[0]});
  assert.throws(()=>assertJoinedPlans(z.layout,z.baseline,z.versioned,z.pageReview),
    /Resource edit cardinality differs/);
});
test('real original resource-v2 plus page/navigation-v3 drafts produce independent consistent combined review',async()=>{
  const original=fs.readFileSync(path.join(root,RUNTIME)),before=digest(original);
  const pageDraft=bytes(fictionalPageDraft(root));
  const resourceDraft=bytes(sampleResource());
  const pageBefore=digest(pageDraft),resourceBefore=digest(resourceDraft);
  const out=await reviewCombined(root,{
    expectedCommit:head,pagesDraft:pageDraft,resourcesDraft:resourceDraft
  });
  assert.equal(out.format,FORMAT);
  assert.equal(out.reviewedLocalGitCommit,head);
  assert.equal(out.localCheckoutVerified,true);
  assert.equal(out.remoteGitHubHeadVerified,false);
  assert.equal(out.resourcesVerified,414);
  assert.equal(out.existingPageAndNavigationFilesChecked,5);
  assert.equal(out.editedPageAndNavigationFiles,2);
  assert.equal(out.editedResources,2);
  assert.equal(out.unifiedProposedFileCount,6);
  assert.equal(out.proposedFiles.length,6);
  assert.equal(out.independentFullSiteSha256Matched,true);
  assert.equal(out.fullSourceLayoutFileCount,418);
  assert.equal(out.resourceOnlyLayoutFileCount,415);
  assert.equal(out.fullSourceTreeUsedForLegacyProofOnly,true);
  assert.equal(out.versionedOverlayUsedInDisposableFolderOnly,true);
  assert.equal(out.candidatePathsUntrackedAndUnapproved,true);
  assert.equal(out.sourceLayoutApproved,false);
  assert.equal(out.sourcePackageAdopted,false);
  assert.equal(out.independentBackupRestored,false);
  assert.equal(out.realAdminEditorVerified,false);
  assert.equal(out.noRemoteUpdateLease,true);
  assert.equal(out.noAutomaticDraftMigration,true);
  assert.equal(out.noDraftDeletion,true);
  assert.equal(out.githubWrites,0);
  assert.equal(out.repositoryFilesWritten,0);
  assert.equal(out.canApply,false);
  assert.equal(out.canMerge,false);
  assert.equal(out.canPublish,false);
  assert.ok(Object.isFrozen(out));
  assert.deepEqual(new Set(out.proposedFiles.map(x=>x.path)),new Set([
    PAGES[0],NAV,recordPath(0),recordPath(413),MANIFEST,RUNTIME
  ]));
  assert.equal(out.proposedFiles.filter(x=>x.trackedInCurrentGit).length,3);
  assert.equal(out.proposedFiles.filter(x=>!x.trackedInCurrentGit).length,3);
  assert.equal(digest(original),before);
  assert.equal(digest(pageDraft),pageBefore);
  assert.equal(digest(resourceDraft),resourceBefore);
});
test('wrong reviewed checkout commit and unsupported draft types are always refused',async()=>{
  const page=bytes(fictionalPageDraft(root)),resource=bytes(sampleResource());
  await assert.rejects(reviewCombined(root,{
    expectedCommit:'f'.repeat(40),pagesDraft:page,resourcesDraft:resource
  }),/Checkout commit changed since the requested draft review/);
  await assert.rejects(reviewCombined(root,{
    expectedCommit:head,pagesDraft:resource,resourcesDraft:page
  }),/only page-v3 and resource-v2/);
  await assert.rejects(reviewCombined(root,{
    expectedCommit:'invalid',pagesDraft:page,resourcesDraft:resource
  }),/exact reviewed checkout commit/);
});
test('page source drift or unsafe original resource edit is rejected before combined output',async()=>{
  const page=fictionalPageDraft(root),resource=sampleResource();
  page.files[0].sourceSha256='f'.repeat(64);
  await assert.rejects(reviewCombined(root,{
    expectedCommit:head,pagesDraft:bytes(page),resourcesDraft:bytes(resource)
  }),/Page source hash mismatch/);
  const good=fictionalPageDraft(root),unsafe=sampleResource();
  unsafe.changes[0].title='<script>blocked</script>';
  await assert.rejects(reviewCombined(root,{
    expectedCommit:head,pagesDraft:bytes(good),resourcesDraft:bytes(unsafe)
  }),/Invalid proposed title|unsafe|draft/i);
});
test('no publication path, remote update, source writer or secret is embedded in reconciliation module',()=>{
  const content=fs.readFileSync(path.resolve(__dirname,
    '../tools/reconcile-mixed-source-layouts.cjs'),'utf8');
  for(const forbidden of ['https.request(','fetch(','update_ref(',
    'create_commit(','writeFileSync(','GITHUB_TOKEN','process.env.GITHUB_TOKEN'])
    assert.equal(content.includes(forbidden),false,forbidden);
  assert.match(content,/readOnly:true/);
  assert.match(content,/canPublish:false/);
  assert.match(content,/sourceLayoutApproved:false/);
  assert.match(content,/versionedOverlayUsedInDisposableFolderOnly:true/);
});

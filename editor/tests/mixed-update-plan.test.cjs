'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process');
const {planMixed,verifyCheckout}=require('../tools/plan-mixed-editor-update.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const root=path.resolve(__dirname,'..','..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const base='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
function drafts(){
  const files=PAGES.map(relative=>({
    path:relative,sourceSha256:sha(fs.readFileSync(path.join(root,relative))),edits:{}
  }));
  const navBytes=fs.readFileSync(path.join(root,NAV));
  return {
    pages:{
      format:'naxx-local-draft-v3',sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-05T01:00:00Z',
      files,navigation:{
        path:NAV,sourceSha256:sha(navBytes),
        document:JSON.parse(navBytes.toString('utf8'))
      }
    },
    resources:{
      format:'naxx-local-resource-draft-v2',baselineSha256:base,
      changes:[
        {index:0,title:'Mixed plan verified title'},
        {index:413,content:'Edited resource content\n\nSecond paragraph.'}
      ]
    }
  };
}
function editedDrafts(){
  const d=drafts();
  const first=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(item=>item.kind==='text');
  assert.ok(first);
  d.pages.files[0].edits[first.id]='Safe mixed page draft edited text.';
  d.pages.navigation.document.pages[1].intro='Updated rules introduction for review.';
  return d;
}
test('both editor areas create one pinned, deterministic, non-deployable mixed path plan',async()=>{
  const d=editedDrafts();
  const result=await planMixed(root,d);
  assert.equal(result.currentCheckoutCommitVerified,true);
  assert.equal(result.draftBoundToExactCommit,false);
  assert.equal(result.pageDraftVerified,true);
  assert.equal(result.resourceDraftVerified,true);
  assert.equal(result.changedExistingPagePaths.length,2);
  assert.equal(result.changedCandidateResourcePaths.length,2);
  assert.equal(result.changedPathsTotal,4);
  assert.equal(result.proposedTreeFileCount,418);
  assert.equal(result.proposedSourceTreeCommitted,false);
  assert.equal(result.generatedSiteFileStaged,false);
  assert.equal(result.noRepositoryFilesWritten,true);
  assert.equal(result.githubReady,false);
  assert.equal(result.publishable,false);
  assert.equal(result.deployable,false);
  assert.equal(result.resourceRebuildExact,true);
  assert.equal(result.resourceRollbackExact,true);
  assert.notEqual(result.plannedGeneratedSiteSha256,base);
  assert.deepEqual(result.changedExistingPagePaths.map(x=>x.path),
    ['content/navigation.json','new-players/content.html']);
  assert.deepEqual(result.changedCandidateResourcePaths.map(x=>x.path),
    ['content/legacy/resources/0001.fragment','content/legacy/resources/0414.fragment']);
  assert.ok(result.changedCandidateResourcePaths.every(x=>x.existingTrackedGitPath===false));
  assert.ok(result.changedExistingPagePaths.every(x=>x.existingTrackedGitPath===true));
  assert.ok(!JSON.stringify(result).includes('Mixed plan verified title'));
  assert.ok(!JSON.stringify(result).includes('Edited resource content'));
  assert.ok(!JSON.stringify(result).includes('Safe mixed page draft edited text'));
});
test('page-only plan does not falsely claim a resource file migration',async()=>{
  const d=editedDrafts();
  const report=await planMixed(root,{pages:d.pages});
  assert.equal(report.resourceDraftVerified,false);
  assert.equal(report.changedCandidateResourcePaths.length,0);
  assert.equal(report.proposedTreeFileCount,0);
  assert.equal(report.plannedGeneratedSiteSha256,base);
  assert.equal(report.resourceRollbackExact,null);
  assert.equal(report.changedExistingPagePaths.length,2);
});
test('resource-only plan refuses to treat proposed fragment paths as already tracked',async()=>{
  const d=editedDrafts();
  const report=await planMixed(root,{resources:d.resources});
  assert.equal(report.pageDraftVerified,false);
  assert.equal(report.changedExistingPagePaths.length,0);
  assert.equal(report.changedCandidateResourcePaths.length,2);
  assert.equal(report.proposedSourceTreeCommitted,false);
  assert.equal(report.noRepositoryFilesWritten,true);
  assert.equal(report.resourceRollbackExact,true);
});
test('stale commit, changed draft SHA, forged path, unsafe resource data fail closed',async()=>{
  const d=editedDrafts();
  const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  assert.equal(verifyCheckout(root,head).verifiedCommit,head);
  assert.throws(()=>verifyCheckout(root,'0'.repeat(40)),/Checkout commit changed/);
  await assert.rejects(planMixed(root,{...d,expectedCommit:'0'.repeat(40)}),/Checkout commit changed/);
  const changed=editedDrafts();changed.pages.files[0].sourceSha256='0'.repeat(64);
  await assert.rejects(planMixed(root,changed),/Page source hash mismatch/);
  const pathEdit=editedDrafts();pathEdit.pages.files[0].path='index.html';
  await assert.rejects(planMixed(root,pathEdit),/Unapproved page path/);
  const badResource=editedDrafts();
  badResource.resources.changes[0].title='<script>unsafe</script>';
  await assert.rejects(planMixed(root,badResource),/Invalid|unsafe|Unsupported/);
  await assert.rejects(planMixed(root,{pages:editedDrafts().pages,
    resources:{...d.resources,baselineSha256:'0'.repeat(64)}}),/mismatched|Unsupported/);
});
test('empty drafts and missing draft sources are not usable mixed exports',async()=>{
  await assert.rejects(planMixed(root,{}),/at least one editor draft/);
  const d=drafts();
  await assert.rejects(planMixed(root,{pages:d.pages}),/contain no changes/);
});

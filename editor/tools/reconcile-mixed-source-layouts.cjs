'use strict';
/*
 * MULTI-DOMAIN SOURCE LAYOUT RECONCILIATION — PRIVATE READ-ONLY PROOF.
 *
 * Compare the existing 418-file candidate and newer 415-file versioned
 * overlay against the SAME original resource-v2 and page/navigation-v3 drafts
 * and the SAME exact clean Git checkout.
 *
 * Neither candidate layout is approved or adopted. Existing page/nav paths
 * are tracked; all experimental resource fragments are NOT tracked.
 * The complete generated site-content.html is a proposed output, not a
 * permission to overwrite the live runtime. No source bytes are returned.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {planMixed}=require('./plan-mixed-editor-update.cjs');
const {prepareResourceReview,inspectPageDraft,parseBytes,LEGACY_RESOURCE,LEGACY_PAGE}=
  require('./rehearse-legacy-draft-bridge.cjs');
const {withTemporaryVersions}=require('./rehearse-versioned-resource-sessions.cjs');
const {PAGES,NAV}=require('./plan-page-draft.cjs');
const legacy=require('./rehearse-proposed-resource-tree.cjs');
const overlay=require('./rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');

const FORMAT='naxx-private-unified-source-layout-review-v1';
const SHA=/^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const HASH=/^[0-9a-f]{64}$/;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const ordinary=part=>typeof part==='string'&&
  /^[a-z0-9][a-z0-9._/-]*$/i.test(part)&&
  !part.split('/').some(x=>!x||x==='.'||x==='..')&&!part.includes('..');

function layoutInventory(){
  const tracked=Object.freeze([...PAGES,NAV,RUNTIME]);
  const old=[...legacy.expectedPaths()],recent=[...overlay.filePaths()];
  if(new Set(tracked).size!==6||old.length!==418||recent.length!==415||
     new Set(old).size!==418||new Set(recent).size!==415)
    throw Error('Unexpected source layout cardinality.');
  const fixed=new Set(tracked);
  if(![...old,...recent,...tracked].every(ordinary)||
     old.some(p=>fixed.has(p))||recent.some(p=>fixed.has(p))||
     old.some(p=>recent.includes(p))||
     overlay.MANIFEST!== 'content/resource-overlays/manifest.json'||
     legacy.MANIFEST!== 'content/legacy/manifest.json')
    throw Error('Candidate resource layout would collide with an existing path.');
  for(let i=0;i<414;i++){
    if(!old.includes(legacy.resourcePath(i))||
       !recent.includes(overlay.recordPath(i)))
      throw Error('Original resource ordering is not preserved in both designs.');
  }
  return Object.freeze({
    existingTrackedPaths:tracked,
    fullLayoutCandidatePaths:Object.freeze(old.sort()),
    resourceOnlyCandidatePaths:Object.freeze(recent.sort()),
    existingTrackedFileCount:tracked.length,
    fullSourceTreeFileCount:old.length,
    versionedResourceOnlyFileCount:recent.length,
    resourceCount:414,
    disjointFromTrackedPagesAndRuntime:true,
    sourceLayoutsAreDistinct:true,
    sourceLayoutSelected:false,
    approved:false
  });
}
function assertJoinedPlans(layout,baseline,versioned,pageReview){
  if(!layout||!baseline||!versioned||!pageReview||
     !versioned.receipt||versioned.decision!=='review-only'||
     pageReview.decision!=='separate-page-review'||
     !baseline.pageDraftVerified||!baseline.resourceDraftVerified||
     !baseline.currentCheckoutCommitVerified||
     !baseline.resourceRebuildExact||!baseline.resourceRollbackExact||
     baseline.proposedSourceTreeCommitted!==false||
     baseline.generatedSiteFileStaged!==false||
     baseline.plannedGeneratedSiteSha256!==versioned.receipt.proposedFullSiteSha256)
    throw Error('Independent source plans disagree or have an unverified review.');
  const old=baseline.changedCandidateResourcePaths,prior=versioned.receipt;
  const fragments=prior.proposedPaths.filter(p=>p.kind==='proposed-resource-fragment');
  if(old.length!==fragments.length||
     prior.editedResourceCount!==old.length||
     prior.proposedFileCount!==old.length+2)
    throw Error('Resource edit cardinality differs between the two designs.');
  const byNew=new Map(fragments.map(p=>[p.path,p]));
  for(const item of old){
    const m=/^content\/legacy\/resources\/([0-9]{4})\.fragment$/.exec(item.path);
    if(!m)throw Error('Legacy resource path is not mapped.');
    const index=Number(m[1])-1;
    const expected=overlay.recordPath(index),match=byNew.get(expected);
    if(index<0||index>=414||!match||
       match.expectedOldSha256!==item.sourceSha256||
       match.proposedNewSha256!==item.nextSha256)
      throw Error('The same resource edit produced a different fragment checksum.');
  }
  const pages=baseline.changedExistingPagePaths;
  if(pages.length!==pageReview.proposedPageAndNavigationFiles.length||
     !pages.length||pages.some(p=>{
       const match=pageReview.proposedPageAndNavigationFiles
         .find(q=>q.path===p.path);
       return !match||match.expectedOldSha256!==p.sourceSha256||
         match.proposedNewSha256!==p.nextSha256||
         match.kind!==p.kind||!layout.existingTrackedPaths.includes(p.path);
     }))
    throw Error('Independent page/navigation source plans disagree.');
  const unified=[
    ...pages.map(p=>({path:p.path,domain:'existing-page-or-navigation',
      trackedInCurrentGit:true,oldSha256:p.sourceSha256,newSha256:p.nextSha256})),
    ...prior.proposedPaths.map(p=>({path:p.path,
      domain:p.kind==='proposed-resource-fragment'?'candidate-resource':
        p.kind==='proposed-source-manifest'?'candidate-manifest':
          'generated-runtime',
      trackedInCurrentGit:p.path===RUNTIME,
      oldSha256:p.expectedOldSha256,newSha256:p.proposedNewSha256}))
  ];
  if(unified.some(p=>!ordinary(p.path)||!HASH.test(p.oldSha256)||
      !HASH.test(p.newSha256)||
      p.oldSha256===p.newSha256)||
     new Set(unified.map(p=>p.path)).size!==unified.length||
     unified.filter(p=>p.path===RUNTIME).length!==1||
     unified.filter(p=>p.path===overlay.MANIFEST).length!==1||
     unified.filter(p=>p.domain==='existing-page-or-navigation').length!==pages.length)
    throw Error('Unified proposed paths are duplicated, invalid or incomplete.');
  if(unified.some(p=>p.domain==='candidate-resource'&&
     !layout.resourceOnlyCandidatePaths.includes(p.path)))
    throw Error('A resource path is outside the proposed overlay.');
  return Object.freeze(unified.sort((a,b)=>a.path.localeCompare(b.path)));
}
async function reviewCombined(root,{expectedCommit,pagesDraft,resourcesDraft}={}){
  if(typeof root!=='string'||!path.isAbsolute(root)||
     !SHA.test(expectedCommit||'')||
     !pagesDraft||!resourcesDraft)
    throw Error('Choose an exact reviewed checkout commit and two original drafts.');
  const layout=layoutInventory();
  const pages=parseBytes(pagesDraft),resources=parseBytes(resourcesDraft);
  if(pages.value.format!==LEGACY_PAGE||resources.value.format!==LEGACY_RESOURCE)
    throw Error('This proof accepts only page-v3 and resource-v2, never implicit draft migrations.');
  const original=fs.readFileSync(path.join(root,RUNTIME));
  if(sha(original)!==SOURCE_SHA)
    throw Error('Original site-content.html changed. Cannot reconcile source layouts.');
  // Existing preflight checks the entire clean Git checkout, BOTH legacy
  // draft formats, and the full 418-file resource-tree reconstruction+rollback.
  const old=await planMixed(root,{
    pages:pages.value,resources:resources.value,expectedCommit
  });
  if(old.commit!==expectedCommit||old.noRepositoryFilesWritten!==true)
    throw Error('The mixed plan is not bound to the expected clean Git checkout.');
  const pageReview=inspectPageDraft(root,pagesDraft);
  const newReview=await withTemporaryVersions(original,
    folder=>prepareResourceReview(folder,original,resourcesDraft));
  const paths=assertJoinedPlans(layout,old,newReview,pageReview);
  // The report includes no source/file bytes, draft field values, URLs or
  // raw per-record text. All four internal proposals are still PRIVATE.
  return Object.freeze({
    format:FORMAT,readOnly:true,reviewedLocalGitCommit:expectedCommit,
    localCheckoutVerified:true,remoteGitHubHeadVerified:false,
    originalWebsiteSha256Matched:true,resourcesVerified:414,
    originalDraftFormatsPreserved:true,
    oldPageDraftSha256:pages.originalSha256,
    oldResourceDraftSha256:resources.originalSha256,
    existingPageAndNavigationFilesChecked:pageReview.pageAndNavigationFilesChecked,
    editedPageAndNavigationFiles:pageReview.proposedPageAndNavigationFiles.length,
    editedResources:old.changedCandidateResourcePaths.length,
    unifiedProposedFileCount:paths.length,
    proposedFiles:paths,
    independentFullSiteSha256Matched:true,
    completeGeneratedSiteSha256:newReview.receipt.proposedFullSiteSha256,
    fullSourceLayoutFileCount:layout.fullSourceTreeFileCount,
    resourceOnlyLayoutFileCount:layout.versionedResourceOnlyFileCount,
    fullSourceTreeUsedForLegacyProofOnly:true,
    versionedOverlayUsedInDisposableFolderOnly:true,
    candidatePathsUntrackedAndUnapproved:true,
    sourceLayoutApproved:false,sourcePackageAdopted:false,
    independentBackupRestored:false,
    realAdminEditorVerified:false,
    noRemoteUpdateLease:true,
    noAutomaticDraftMigration:true,noDraftDeletion:true,
    repositoryFilesWritten:0,githubWrites:0,
    canApply:false,canMerge:false,canPublish:false
  });
}
function fictionalPageDraft(root){
  const {runs}=require('./plan-page-draft.cjs');
  const shaLocal=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const files=PAGES.map(relative=>({
    path:relative,sourceSha256:shaLocal(fs.readFileSync(path.join(root,relative))),
    edits:{}
  }));
  const first=fs.readFileSync(path.join(root,PAGES[0]),'utf8');
  const anchor=runs(first).find(p=>p.kind==='text');
  if(!anchor)throw Error('Cannot find a known editable page token.');
  files[0].edits[anchor.id]='Private unified source review — fictional page text';
  const navBytes=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navBytes.toString('utf8'));
  nav.pages[0].label='Private unified navigation example';
  return {
    format:LEGACY_PAGE,
    createdAt:'2026-11-06T00:00:00Z',
    files,navigation:{path:NAV,sourceSha256:shaLocal(navBytes),document:nav},
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false
  };
}
async function demonstrate(root,expectedCommit){
  const page=Buffer.from(JSON.stringify(fictionalPageDraft(root)));
  const resource=Buffer.from(JSON.stringify({
    format:LEGACY_RESOURCE,baselineSha256:SOURCE_SHA,
    changes:[{index:0,title:'Private unified resource title'},
      {index:413,content:'Private unified multiline content.\n\nSecond paragraph.'}]
  }));
  const review=await reviewCombined(root,{
    expectedCommit,pagesDraft:page,resourcesDraft:resource
  });
  if(review.editedPageAndNavigationFiles!==2||
     review.editedResources!==2||review.unifiedProposedFileCount!==6||
     review.githubWrites!==0)
    throw Error('Unified review did not contain the expected independent edits.');
  return {
    format:FORMAT,changedExistingPagesAndNavigation:review.editedPageAndNavigationFiles,
    changedResourceFragments:review.editedResources,
    changeSetPaths:review.unifiedProposedFileCount,
    independentLayoutsAgreedOnGeneratedHTML:true,
    verifiedOriginalPagesAndNavigation:review.existingPageAndNavigationFilesChecked,
    legacy418CandidateOnly:true,versioned415CandidateOnly:true,
    resourceOriginalDraftUnmodified:true,pageOriginalDraftUnmodified:true,
    originalWebsiteUnchanged:true,remoteWriteCalls:0,
    approved:false,canApply:false,canPublish:false
  };
}
if(require.main===module){
  demonstrate(path.resolve(__dirname,'..','..'),process.env.GITHUB_SHA)
    .then(r=>process.stdout.write(JSON.stringify(r,null,2)+'\n'))
    .catch(_=>{
      process.stderr.write('Private mixed source-layout comparison failed closed.\n');
      process.exitCode=1;
    });
}
module.exports={
  FORMAT,layoutInventory,assertJoinedPlans,reviewCombined,fictionalPageDraft,
  demonstrate
};

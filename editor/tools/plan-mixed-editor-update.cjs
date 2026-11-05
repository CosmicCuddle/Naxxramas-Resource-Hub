'use strict';
/*
 * MIXED PAGE/RESOURCE CHANGE PLAN — development preflight only.
 *
 * The existing page/navigation Git paths are real and tracked.
 * The proposed resource-fragment paths DO NOT EXIST in the checkout and
 * must not be represented as a deployable Git patch. This tool validates
 * two independent draft formats, verifies current checkout snapshot,
 * rehearses a proposed 418-file source tree and exact rollback, then reports
 * only hashes and approved paths. Never writes to the repository or publishes.
 */
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {inspectCheckout}=require('./audit-full-checkout.cjs');
const page=require('./plan-page-draft.cjs');
const {planChangeSet}=require('./rehearse-resource-change-set.cjs');
const {withCandidateTree,verifyCandidate,rollbackCandidate,resourcePath}=
  require('./rehearse-proposed-resource-tree.cjs');
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function git(root,args){
  const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',
    timeout:20000,stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024});
  if(r.status!==0||r.error)throw Error('Git source identity is unavailable.');
  return r.stdout.trim();
}
function verifyCheckout(root,expectedCommit){
  const clean=inspectCheckout(root);
  if(git(root,['status','--porcelain=v1','--untracked-files=all']))
    throw Error('Untracked or unsaved files prevent a combined change plan.');
  if(expectedCommit!==undefined&&expectedCommit!==clean.verifiedCommit)
    throw Error('Checkout commit changed since the requested draft review.');
  const tracked=git(root,['ls-files','-z']).split('\0').filter(Boolean);
  if(![...page.PAGES,page.NAV,'site-content.html'].every(f=>tracked.includes(f)))
    throw Error('Tracked website sources are incomplete.');
  return clean;
}
async function planMixed(root,{pages=null,resources=null,expectedCommit}={}){
  if(!path.isAbsolute(root)||(!pages&&!resources))
    throw Error('A checkout and at least one editor draft are required.');
  const original=fs.readFileSync(path.join(root,'site-content.html'));
  if(sha(original)!==BASE)
    throw Error('The original 414-resource website source was changed.');
  const checkout=verifyCheckout(root,expectedCommit);
  const pagePlan=pages?page.plan(root,pages):null;
  const resourcePlan=resources?await planChangeSet(original,resources):null;
  const resourceEvidence=resources?await withCandidateTree(original,resources,(tree,draftPlan)=>{
    const staged=verifyCandidate(tree,original,draftPlan);
    const rollback=rollbackCandidate(tree,original,draftPlan);
    if(!staged.intendedSourceByteIdentical||!rollback.originalSourceByteIdentical)
      throw Error('Resource tree reconstruction or rollback was not exact.');
    if(draftPlan.manifest.stagedSourceSha256!==resourcePlan.manifest.stagedSourceSha256)
      throw Error('Mixed plan and candidate resource reconstruction disagree.');
    return {staged,rollback};
  }):null;
  const pageChanges=pagePlan?pagePlan.changed.map(item=>({
    path:item.path,kind:item.kind,
    sourceSha256:item.sourceSha256,nextSha256:item.nextSha256,
    changedFields:item.modifiedFields,bytes:item.bytes.length,
    existingTrackedGitPath:true
  })):[];
  const resourceChanges=resourcePlan?resourcePlan.manifest.changes.map(item=>({
    path:resourcePath(item.position-1),kind:'proposed-resource-fragment',
    sourceSha256:item.originalSha256,nextSha256:item.stagedSha256,
    changedFields:item.fields,existingTrackedGitPath:false
  })):[];
  const paths=[...pageChanges,...resourceChanges];
  if(!paths.length)throw Error('Both supplied editor drafts contain no changes.');
  const names=new Set();
  for(const item of paths){
    if(names.has(item.path)||item.path==='index.html')
      throw Error('Duplicate or protected path in mixed change plan.');
    names.add(item.path);
  }
  const report={
    format:'naxx-mixed-source-change-preflight-v1',
    candidateOnly:true,githubReady:false,publishable:false,deployable:false,
    currentCheckoutCommitVerified:true,
    draftBoundToExactCommit:false,
    commit:checkout.verifiedCommit,
    trackedFilesVerified:checkout.trackedFiles,
    checkedOutSourceFingerprint:checkout.fingerprintSha256,
    sourceVersion:'exact-original-414-resources',
    originalSiteSha256:BASE,
    plannedGeneratedSiteSha256:resourcePlan?resourcePlan.manifest.stagedSourceSha256:BASE,
    pageDraftVerified:!!pagePlan,
    resourceDraftVerified:!!resourcePlan,
    changedExistingPagePaths:pageChanges,
    changedCandidateResourcePaths:resourceChanges,
    changedPathsTotal:paths.length,
    proposedTreeFileCount:resourcePlan?418:0,
    proposedSourceTreeCommitted:false,
    generatedSiteFileStaged:false,
    resourceRebuildExact:resourceEvidence?resourceEvidence.staged.intendedSourceByteIdentical:null,
    resourceRollbackExact:resourceEvidence?resourceEvidence.rollback.originalSourceByteIdentical:null,
    requiredBeforeGitUpdate:[
      'Owner approval and independently retained repository backup',
      'Owner decision on adopting the 418-file resource source tree',
      'Explicit source-commit binding for drafts and changed-path conflict checks',
      'Reviewed compatibility output build and visitor/admin acceptance tests'
    ],
    noRepositoryFilesWritten:true
  };
  // Only an in-memory, reviewable *plan* returned; no source bytes printed.
  return report;
}
if(require.main===module){
  process.stderr.write('Mixed update preflight is a library, not a GitHub publisher. No files were changed.\n');
}
module.exports={verifyCheckout,planMixed};

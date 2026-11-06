'use strict';
/*
 * PRIVATE, READ-ONLY GITHUB CHANGE-SET REVIEW RECEIPT — NEVER APPLY.
 *
 * Given the known original 31 MB non-resource shell, a disposable, fully
 * verified 415-file resource overlay and a version-bound draft:
 *   1. Independently verify every physical resource and the reconstructed HTML.
 *   2. Refuse stale, conflicted and unsafe draft versions.
 *   3. Calculate exactly which *proposed* repository paths would need updates.
 *   4. Return a source-bound, checksum-only change receipt (no file bytes).
 *
 * It cannot write a tree, stage a commit, create a PR, upload source, save,
 * merge or publish. Neither the experimental folder layout nor the generated
 * compatibility output is approved for GitHub adoption.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {verifyCompleteReadOnly,parseDraft}=require('./verify-physical-resource-sources.cjs');
const {verify,plan}=require('./rehearse-versioned-resource-sessions.cjs');
const {restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {recordPath,MANIFEST,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const encode=text=>Buffer.from(text,'utf8');
const FORMAT='naxx-private-github-changeset-review-v1';
const RUNTIME='site-content.html';

function proposedReceipt(folder,original,draftInput){
  // Physical check independently walks 415 paths and hashes all 414 file
  // bytes. This verifies the whole CURRENT compatibility source first.
  const physical=verifyCompleteReadOnly(folder,original,draftInput);
  if(physical.decision!=='review-only'||!physical.fullHtmlSha256Matched)
    throw Error('Source or draft version is not eligible for a dry-run review.');
  const draft=parseDraft(draftInput);
  const current=verify(folder,original);
  const next=plan(current,draft); // in-memory only; no call to save()
  if(!Array.isArray(next.indices)||next.indices.length===0||
     next.indices.length>COUNT||new Set(next.indices).size!==next.indices.length)
    throw Error('Unexpected proposed edit cardinality.');
  if(next.manifest.revision!==current.manifest.revision+1||
     next.manifest.parentSha256!==current.manifest.sourceSha256)
    throw Error('Proposed revision does not advance the exact current version.');
  const before=restoreInMemory(current.split,current.records);
  const after=restoreInMemory(current.split,next.newRecords);
  if(sha(before)!==current.manifest.sourceSha256||
     before.length!==current.manifest.sourceBytes||
     sha(after)!==next.manifest.sourceSha256||
     after.length!==next.manifest.sourceBytes||
     next.manifest.originalSha256!==SOURCE_SHA)
    throw Error('Complete proposed compatibility output is not source-bound.');

  const files=[];
  for(const index of next.indices){
    if(next.newRecords[index]===current.records[index])
      throw Error('Unchanged fragment cannot be included in proposed update.');
    const relative=recordPath(index);
    const prior=encode(current.records[index]);
    const candidate=encode(next.newRecords[index]);
    if(sha(prior)!==current.manifest.resources[index].sha256||
       sha(candidate)!==next.manifest.resources[index].sha256)
      throw Error('Proposed resource file hash does not match the manifest.');
    files.push({
      path:relative,kind:'proposed-resource-fragment',
      expectedOldSha256:sha(prior),proposedNewSha256:sha(candidate),
      oldBytes:prior.length,newBytes:candidate.length
    });
  }
  const previousManifest=encode(JSON.stringify(current.manifest)+'\n');
  const nextManifest=encode(JSON.stringify(next.manifest)+'\n');
  files.push({
    path:MANIFEST,kind:'proposed-source-manifest',
    expectedOldSha256:sha(previousManifest),
    proposedNewSha256:sha(nextManifest),
    oldBytes:previousManifest.length,newBytes:nextManifest.length
  });
  files.push({
    path:RUNTIME,kind:'proposed-generated-runtime',
    expectedOldSha256:sha(before),proposedNewSha256:sha(after),
    oldBytes:before.length,newBytes:after.length
  });
  // All update paths are predetermined, never constructed from resource
  // titles/content, externally supplied directories or raw JSON object keys.
  const permitted=new Set([MANIFEST,RUNTIME,...next.indices.map(recordPath)]);
  if(files.length!==next.indices.length+2||
     new Set(files.map(x=>x.path)).size!==files.length||
     files.some(x=>!permitted.has(x.path)||x.expectedOldSha256===x.proposedNewSha256))
    throw Error('The proposed path list is not complete or changed.');

  files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const unchanged=COUNT-next.indices.length;
  if(next.newRecords.some((record,i)=>!next.indices.includes(i)&&
       record!==current.records[i]))
    throw Error('A resource outside the requested edit set changed.');

  const receipt={
    format:FORMAT,reviewOnly:true,approved:false,githubReady:false,
    releaseBuilderAvailable:false,canonicalLayoutApproved:false,
    originalNonResourceShellPreserved:true,liveWebsiteUnchanged:true,
    currentRevision:current.manifest.revision,
    proposedRevision:next.manifest.revision,
    originalBaselineSha256:SOURCE_SHA,
    expectedCurrentSourceSha256:current.manifest.sourceSha256,
    proposedFullSiteSha256:next.manifest.sourceSha256,
    sourceBytesBefore:before.length,sourceBytesAfter:after.length,
    physicallyVerifiedResources:physical.resourceFilesVerified,
    physicalSourceFiles:physical.filesVerified,
    editedResourceCount:next.indices.length,unchangedResourceCount:unchanged,
    proposedPaths:files.map(x=>Object.freeze(x)),
    proposedFileCount:files.length,
    trustedGitCommitChecked:false,
    privateGitRecoveryBackupVerified:false,
    realAdminWriteFlowVerified:false,
    newSourceBytesIncluded:false,
    canApply:false,canMerge:false,canPublish:false,
    repoFilesWritten:0,gitActionsTaken:0
  };
  return Object.freeze({...receipt,proposedPaths:Object.freeze(receipt.proposedPaths)});
}
async function privateDemonstration(original){
  const {withTemporaryVersions,verify,draftFrom,save}=require('./rehearse-versioned-resource-sessions.cjs');
  let directory;
  const report=await withTemporaryVersions(original,dir=>{
    directory=dir;
    const originalState=verify(dir,original);
    const v0=draftFrom(originalState,[
      {index:0,title:'Private dry-run resource title'}
    ]);
    const first=proposedReceipt(dir,original,v0);
    if(first.editedResourceCount!==1||first.proposedFileCount!==3)
      throw Error('Unexpected first-session dry-run path count.');
    const saved=save(dir,original,v0); // only inside disposable temp folder
    if(saved.after.manifest.revision!==1)
      throw Error('Private simulated version did not advance.');
    let staleRejected=false;
    try{proposedReceipt(dir,original,v0);}
    catch(_){staleRejected=true;}
    if(!staleRejected)throw Error('Stale dry-run draft was not blocked.');
    const latest=verify(dir,original),v1=draftFrom(latest,[
      {index:413,content:'Private second-session line.\n\nNew paragraph.'}
    ]);
    const second=proposedReceipt(dir,original,v1);
    if(second.currentRevision!==1||second.proposedRevision!==2||
       second.proposedFileCount!==3)
      throw Error('A later dry-run receipt was not correctly version bound.');
    return {
      firstReview:{from:first.currentRevision,to:first.proposedRevision,
        proposedPaths:first.proposedFileCount},
      staleDraftRejected:staleRejected,
      secondReview:{from:second.currentRevision,to:second.proposedRevision,
        proposedPaths:second.proposedFileCount},
      physicallyVerifiedResources:second.physicallyVerifiedResources,
      originalNonResourceShellPreserved:true,
      realGitSourceFilesChanged:false
    };
  });
  if(!directory||fs.existsSync(directory))
    throw Error('Disposable dry-run source tree was not destroyed.');
  return Object.freeze({
    format:'naxx-private-github-changeset-demo-v1',
    ...report,temporaryDataDeleted:true,
    githubFilesWritten:0,liveWebsiteChanged:false,
    ownerApproved:false,githubReady:false
  });
}
if(require.main===module){
  (async()=>{
    const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(await privateDemonstration(original),null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Private GitHub changeset review stopped safely.\n');
    process.exitCode=1;
  });
}
module.exports={FORMAT,RUNTIME,proposedReceipt,privateDemonstration};

'use strict';
/*
 * COMMIT-REVIEWED RESOURCE PREVIEW ZIP — PRIVATE AND NON-DEPLOYABLE.
 *
 * Complements (but does not replace) the separately verified tracked-page
 * ZIP. Packages ONLY edited resource fragments under NON-GITHUB review paths
 * plus a full 31 MB PREVIEW-ONLY compatibility HTML. No public source tree
 * is written to Git, no generated live site-content.html is replaced.
 *
 * The browser draft and hash-only review receipt are untrusted input:
 * revalidate against a clean exact Git checkout before making the ZIP.
 * The restored full HTML is compared byte-for-byte with a deterministic,
 * independently verified source-tree reconstruction and rollback.
 */
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {verifyReviewBinding}=require('./bind-editor-drafts.cjs');
const {planChangeSet}=require('./rehearse-resource-change-set.cjs');
const {withCandidateTree,verifyCandidate,rollbackCandidate,resourcePath}=
  require('./rehearse-proposed-resource-tree.cjs');
const {restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {sourceDraft}=require('./create-draft-review-receipt.cjs');
const {encode,decode}=require('./private-source-zip.cjs');
const {outputOutsideCheckout,saveLocalArchive}=require('./package-private-resource-tree.cjs');

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FORMAT='naxx-reviewed-private-resource-preview-v1';
const ROOT='CANDIDATE-RESOURCE-FRAGMENTS';
const PREVIEW='PREVIEW-ONLY-generated-site-content.html';
const MANIFEST='RESOURCE-PREVIEW-REVIEW-MANIFEST.json';
const README='READ_ME_PRIVATE_RESOURCE_PREVIEW.txt';
const originalSha='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
function reviewPath(index){
  if(!Number.isInteger(index)||index<0||index>=414)
    throw Error('Candidate resource position must be a known index.');
  return ROOT+'/'+String(index+1).padStart(4,'0')+'.fragment';
}
function expectedPaths(plan){
  if(!plan||!(plan.fragments instanceof Map)||!plan.fragments.size||
     plan.fragments.size>414)
    throw Error('No verified candidate resource fragments.');
  return new Set([MANIFEST,README,PREVIEW,...[...plan.fragments.keys()].map(reviewPath)]);
}
function notice(manifest){
  return [
    'NAXXRAMAS RESOURCE PREVIEW — PRIVATE REVIEW ONLY',
    '',
    'DANGER: THIS ZIP CONTAINS THE COMPLETE GENERATED WEBSITE SOURCE.',
    'THE SOURCE MAY CONTAIN PRIVATE CUSTOM DATA. KEEP IT OFFLINE.',
    'DO NOT UPLOAD THIS ZIP TO A PUBLIC GITHUB BRANCH OR GITHUB PAGES.',
    '',
    'NOT A DEPLOYMENT. NOT A BACKUP. NOT A READY-TO-COMMIT PATCH.',
    'The resource fragment paths are REVIEW PATHS, NOT GitHub source paths.',
    'Do not replace root index.html or live site-content.html.',
    '',
    'Reviewed Git commit: '+manifest.reviewedGitCommit,
    'Review receipt checksum: '+manifest.reviewReceiptSha256,
    'Original complete HTML SHA-256: '+manifest.originalSourceSha256,
    'Preview complete HTML SHA-256: '+manifest.previewSourceSha256,
    'Approved candidate resource fragments: '+manifest.changedFragments.length,
    'Existing page/navigation changes excluded: '+manifest.excludedTrackedPageEdits,
    '',
    'Contents:',
    '- '+ROOT+'/NNNN.fragment: only the changed resource object literals',
    '- '+PREVIEW+': full compatibility website source for OFFLINE review',
    '- '+MANIFEST+': expected hashes and exact source-path mapping',
    '- '+README+': these instructions',
    '',
    'Both the fragment list and compatibility website are VERIFIED AGAINST',
    'THE EXACT ORIGINAL SOURCE and the original 414 resource records.',
    'The original source can be reconstructed from the reviewed Git commit.',
    'This ZIP alone is NOT a complete independent backup or source tree.',
    '',
    'Before adoption: retain a verified private Git backup, obtain owner',
    'approval for source-tree layout, check the full website in a private',
    'preview, and explicitly authorise any deployment or merge.',
    'Do not send this ZIP to public support or an external service.',
    ''
  ].join('\n');
}
async function createResourcePreview(root,drafts,receipt){
  if(!drafts||!drafts.resources)
    throw Error('An exact reviewed resource draft is required.');
  const binding=await verifyReviewBinding(root,drafts,receipt);
  if(!binding.checkoutMatchesRequestedCommit||binding.resourceDraftMatchesReceipt!==true)
    throw Error('Resource draft does not match its reviewed commit.');
  const original=fs.readFileSync(path.join(root,'site-content.html'));
  if(hash(original)!==originalSha)throw Error('Original generated source is not the pinned version.');
  const plan=await planChangeSet(original,drafts.resources);
  if(receipt.proposedGeneratedSiteSha256!==plan.manifest.stagedSourceSha256||
     receipt.originalSiteSha256!==originalSha||
     receipt.changedProposedResourceCount!==plan.fragments.size)
    throw Error('Review receipt resource hashes differ from the intended generated site.');
  for(const change of plan.manifest.changes){
    const reviewed=receipt.plannedChanges.find(
      item=>item.path===resourcePath(change.position-1));
    if(!reviewed||reviewed.trackedAtReview!==false||
       reviewed.originalSha256!==change.originalSha256||
       reviewed.reviewedSha256!==change.stagedSha256)
      throw Error('A candidate resource does not match its reviewed receipt.');
  }
  // Independent, disposable 418-file source-tree reconstruction + rollback.
  const treeReport=await withCandidateTree(original,drafts.resources,(tree,treePlan)=>{
    const staged=verifyCandidate(tree,original,treePlan);
    const restored=rollbackCandidate(tree,original,treePlan);
    if(!staged.intendedSourceByteIdentical||
       !restored.originalSourceByteIdentical||
       staged.stagedSourceSha256!==plan.manifest.stagedSourceSha256)
      throw Error('Candidate resource reconstruction or rollback failed.');
    return {staged,restored};
  });
  if(!treeReport.restored.originalSourceByteIdentical)
    throw Error('Candidate source tree cannot roll back.');
  const manifest={
    format:FORMAT,privateOnly:true,
    reviewedGitCommit:receipt.reviewedGitCommit,
    reviewedGitTree:receipt.reviewedGitTree,
    reviewReceiptSha256:receipt.receiptSha256,
    resourceDraftSha256:receipt.resourceDraftSha256,
    pageDraftSha256:receipt.pageDraftSha256,
    originalSourceSha256:originalSha,
    previewSourceSha256:plan.manifest.stagedSourceSha256,
    previewSourceBytes:plan.expected.length,
    previewPath:PREVIEW,
    originalResources:414,
    sourceTreeContainsAllResources:false,
    sourceTreeCommitted:false,
    generatedSiteForPreviewOnly:true,
    excludedTrackedPageEdits:receipt.changedExistingPageCount,
    partialWebsiteReview:receipt.changedExistingPageCount>0,
    publishable:false,deployable:false,githubReady:false,ownerApproved:false,
    includesRootLoader:false,includesLiveSiteContentPath:false,
    completeGitBackup:false,
    changedFragments:plan.manifest.changes.map(change=>({
      index:change.position-1,
      proposedGitPath:resourcePath(change.position-1),
      reviewOnlyPath:reviewPath(change.position-1),
      originalSha256:change.originalSha256,
      updatedSha256:change.stagedSha256,
      changedFields:change.fields
    })),
    rollbackVerified:true,
    warning:'Source fragments and full generated HTML are for offline preview, not GitHub publication.'
  };
  const entries=plan.manifest.changes.map(change=>({
    name:reviewPath(change.position-1),
    bytes:Buffer.from(plan.fragments.get(change.position-1),'utf8')
  }));
  entries.push({name:PREVIEW,bytes:plan.expected});
  entries.push({name:MANIFEST,bytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8')});
  entries.push({name:README,bytes:Buffer.from(notice(manifest),'utf8')});
  const bytes=encode(entries,expectedPaths(plan));
  const checked=verifyResourcePreview(bytes,manifest,plan,original);
  return {bytes,manifest,report:{
    format:FORMAT,archiveSha256:hash(bytes),archiveBytes:bytes.length,
    entries:checked.entries,changedFragments:plan.fragments.size,
    excludedTrackedPageEdits:manifest.excludedTrackedPageEdits,
    generatedCompatibilitySourceVerified:checked.previewExact,
    originalSourceRollbackVerified:true,
    reviewReceiptChecked:true,
    sourceTreeCommitted:false,deployable:false,ownerApproved:false,
    publicFilesWritten:0,backupPersisted:false
  }};
}
function verifyResourcePreview(bytes,manifest,plan,original){
  const allowed=expectedPaths(plan);
  const parsed=decode(bytes,allowed);
  const files=new Map(parsed.entries.map(item=>[item.name,item.bytes]));
  if(!Buffer.isBuffer(original)||hash(original)!==originalSha||
     !manifest||manifest.format!==FORMAT||
     manifest.previewPath!==PREVIEW||
     manifest.originalSourceSha256!==originalSha||
     !Array.isArray(manifest.changedFragments)||
     manifest.changedFragments.length!==plan.fragments.size||
     manifest.previewSourceSha256!==plan.manifest.stagedSourceSha256||
     manifest.previewSourceBytes!==plan.expected.length||
     manifest.sourceTreeCommitted!==false||
     manifest.generatedSiteForPreviewOnly!==true||
     manifest.publishable!==false||manifest.deployable!==false||
     manifest.githubReady!==false||manifest.ownerApproved!==false||
     manifest.includesLiveSiteContentPath!==false)
    throw Error('Private resource preview manifest contains unverified metadata.');
  const expectedManifest=Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8');
  if(!files.get(MANIFEST)?.equals(expectedManifest)||
     !files.get(README)?.equals(Buffer.from(notice(manifest),'utf8')))
    throw Error('Private resource preview manifest or safety notice was altered.');
  const records=plan.split.records.slice();
  const seen=new Set();
  for(const change of manifest.changedFragments){
    if(!Number.isInteger(change.index)||seen.has(change.index)||
       !plan.fragments.has(change.index)||
       change.proposedGitPath!==resourcePath(change.index)||
       change.reviewOnlyPath!==reviewPath(change.index)||
       change.originalSha256!==hash(Buffer.from(plan.split.records[change.index],'utf8'))||
       change.updatedSha256!==hash(Buffer.from(plan.fragments.get(change.index),'utf8'))||
       JSON.stringify(change.changedFields)!==
         JSON.stringify(plan.manifest.changes.find(x=>x.position===change.index+1)?.fields))
      throw Error('Unapproved or duplicated candidate fragment mapping.');
    seen.add(change.index);
    const fragment=files.get(change.reviewOnlyPath);
    if(!fragment||!fragment.equals(Buffer.from(plan.fragments.get(change.index),'utf8')))
      throw Error('Candidate resource fragment differs from intended content.');
    records[change.index]=fragment.toString('utf8');
  }
  if(seen.size!==plan.fragments.size)
    throw Error('Candidate resource preview omits a reviewed edit.');
  const reconstructed=restoreInMemory(plan.split,records);
  const preview=files.get(PREVIEW);
  if(!preview||!preview.equals(reconstructed)||
     !preview.equals(plan.expected)||
     hash(preview)!==manifest.previewSourceSha256)
    throw Error('Generated compatibility preview differs from independently rebuilt source.');
  return {
    entries:parsed.entryCount,archiveSha256:parsed.archiveSha256,
    previewExact:true,changedFragmentsVerified:seen.size,
    sourceUnchangedOutsideReviewedResources:true,
    originalSourceSha256:originalSha
  };
}
function parseArgs(args){
  if(!Array.isArray(args)||!args.length||args.length%2!==0)
    throw Error('Specify --resources, --receipt, --output and optional --pages.');
  const allowed=new Set(['--resources','--receipt','--output','--pages']),o={};
  for(let i=0;i<args.length;i+=2){
    if(!allowed.has(args[i])||Object.hasOwn(o,args[i])||
       typeof args[i+1]!=='string'||!args[i+1])
      throw Error('Unexpected or duplicate private resource preview option.');
    o[args[i]]=args[i+1];
  }
  if(!o['--resources']||!o['--receipt']||!o['--output'])
    throw Error('A resource draft, review receipt and output are required.');
  return {
    resourcesFile:o['--resources'],receiptFile:o['--receipt'],
    pagesFile:o['--pages']||null,output:o['--output']
  };
}
async function saveResourcePreview(root,{resourcesFile,pagesFile=null,receiptFile,output}={}){
  const filename=outputOutsideCheckout(output,root);
  const sourceFiles=[resourcesFile,receiptFile,...(pagesFile?[pagesFile]:[])];
  const loaded=sourceFiles.map(name=>sourceDraft(name));
  const drafts={resources:loaded[0].value};
  if(pagesFile)drafts.pages=loaded[2].value;
  const receipt=loaded[1].value;
  const result=await createResourcePreview(root,drafts,receipt);
  for(let i=0;i<sourceFiles.length;i++){
    if(sourceDraft(sourceFiles[i]).digest!==loaded[i].digest)
      throw Error('A private review input changed during packaging.');
  }
  const saved=saveLocalArchive(result.bytes,filename,root);
  if(saved.sha256!==result.report.archiveSha256)
    throw Error('Saved candidate preview ZIP differs from verified bytes.');
  return {...result.report,savedOutsideGit:true};
}
if(require.main===module){
  (async()=>{
    const options=parseArgs(process.argv.slice(2));
    return saveResourcePreview(path.resolve(__dirname,'..','..'),options);
  })().then(report=>process.stdout.write(JSON.stringify(report,null,2)+'\n'))
    .catch(_=>{
      process.stderr.write('Private resource preview rejected: check the exact Git receipt, drafts, and output location. Nothing published.\n');
      process.exitCode=1;
    });
}
module.exports={FORMAT,ROOT,PREVIEW,MANIFEST,README,reviewPath,
  createResourcePreview,verifyResourcePreview,saveResourcePreview,parseArgs,notice};

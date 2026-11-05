'use strict';
/*
 * Commit-reviewed EXISTING-PATH page/navigation ZIP.
 *
 * Scope: only changed, already tracked file paths:
 * new-players/content.html, rules/content.html, apply/content.html,
 * game-clients/content.html and content/navigation.json.
 *
 * This writer does not stage unpublished candidate resource fragments,
 * rewrite the website's loader or legacy source, commit, push or deploy.
 *
 * A valid commit-bound receipt is required and independently revalidated.
 * The ZIP is a REVIEWED PATCH CANDIDATE, NOT owner approval to publish.
 */
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {PAGES,NAV,plan:planPages}=require('./plan-page-draft.cjs');
const {verifyReviewBinding}=require('./bind-editor-drafts.cjs');
const {sourceDraft}=require('./create-draft-review-receipt.cjs');
const {encode,decode}=require('./private-source-zip.cjs');
const {outputOutsideCheckout,saveLocalArchive}=require('./package-private-resource-tree.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');

const FORMAT='naxx-reviewed-existing-page-paths-v1';
const MANIFEST='REVIEWED-PAGE-UPDATE-MANIFEST.json';
const GUIDE='READ_ME_BEFORE_GIT_REVIEW.txt';
const PAGE_PATHS=new Set([...PAGES,NAV]);
const FIXED_FILES=new Set([MANIFEST,GUIDE]);

function safeList(changes){
  if(!Array.isArray(changes)||!changes.length||changes.length>PAGE_PATHS.size)
    throw Error('At least one approved tracked page/navigation change is required.');
  const names=new Set();
  for(const item of changes){
    if(!item||!PAGE_PATHS.has(item.path)||names.has(item.path)||
       !Buffer.isBuffer(item.bytes)||!(/^[a-f0-9]{64}$/).test(item.sourceSha256)||
       sha(item.bytes)!==item.nextSha256)
      throw Error('Unverified tracked page update path or bytes.');
    names.add(item.path);
  }
  return new Set([...names,...FIXED_FILES]);
}
function instructions(manifest){
  return [
    'NAXXRAMAS REVIEWED EXISTING-PAGE PATHS — PRIVATE CHANGE PACKAGE',
    '',
    'The page/navigation files use their REAL tracked Git relative paths.',
    'This is a REVIEW CANDIDATE, not permission to publish.',
    'DO NOT COPY THIS ZIP TO A LIVE WEBSITE OR THE MAIN BRANCH.',
    '',
    'Original reviewed Git commit: '+manifest.reviewedGitCommit,
    'Verified review receipt SHA-256: '+manifest.reviewReceiptSha256,
    'Changed existing page/navigation paths: '+manifest.files.length,
    'Candidate resource edits excluded: '+manifest.excludedCandidateResourceChanges,
    '',
    'IMPORTANT: Resource edits are NOT included in this page package.',
    'If candidate resource edits exist, this is a PARTIAL website update.',
    'It cannot publish or replace the 31 MB site-content.html.',
    'It cannot change root index.html, scripts or custom website data.',
    '',
    'For manual review only:',
    '1. Keep this ZIP private until the owner has inspected the contents.',
    '2. Verify the exact reviewed Git commit and original file checksums.',
    '3. Compare each changed file with a disposable matching Git checkout.',
    '4. Review the changed HTML/JSON, links and site preview.',
    '5. Run editor, website and recovery checks; examine the diff.',
    '6. Do not merge, publish or deploy without CosmicCuddle approval.',
    '',
    'The commit-bound receipt is an integrity review, not a digital signature.',
    'It does not prove original draft authorship or provide a complete backup.',
    'See REVIEWED-PAGE-UPDATE-MANIFEST.json for changed-file SHA-256 hashes.',
    ''
  ].join('\n');
}
async function createPagePackage(root,drafts,receipt){
  if(!drafts||!drafts.pages)
    throw Error('A page/navigation draft must be supplied for a page-path package.');
  const binding=await verifyReviewBinding(root,drafts,receipt);
  if(!binding.checkoutMatchesRequestedCommit||binding.pageDraftMatchesReceipt!==true)
    throw Error('Commit-bound page review could not be verified.');
  const planned=planPages(root,drafts.pages);
  const paths=safeList(planned.changed);
  const allReceiptPagePaths=receipt.plannedChanges
    .filter(item=>item.trackedAtReview===true)
    .map(item=>item.path).sort();
  const plannedPaths=planned.changed.map(item=>item.path).sort();
  if(JSON.stringify(allReceiptPagePaths)!==JSON.stringify(plannedPaths)||
     receipt.changedExistingPageCount!==planned.changed.length)
    throw Error('Review receipt page paths differ from actual changes.');
  for(const entry of planned.changed){
    const reviewed=receipt.plannedChanges.find(item=>item.path===entry.path);
    if(!reviewed||reviewed.trackedAtReview!==true||
       reviewed.originalSha256!==entry.sourceSha256||
       reviewed.reviewedSha256!==entry.nextSha256)
      throw Error('Reviewed source file checksum differs from staged page bytes.');
  }
  const manifest={
    format:FORMAT,
    reviewedGitCommit:receipt.reviewedGitCommit,
    reviewedGitTree:receipt.reviewedGitTree,
    reviewReceiptSha256:receipt.receiptSha256,
    pageDraftSha256:receipt.pageDraftSha256,
    resourceDraftSha256:receipt.resourceDraftSha256,
    candidateOnly:true,ownerApproved:false,
    githubPathsAreTracked:true,
    githubReadyForDeployment:false,publishable:false,deployable:false,
    partialWebsiteUpdate:receipt.changedProposedResourceCount>0,
    excludedCandidateResourceChanges:receipt.changedProposedResourceCount,
    generatedSiteContentIncluded:false,
    rootLoaderIncluded:false,completeRepositoryBackup:false,
    files:planned.changed.map(item=>({
      path:item.path,kind:item.kind,
      originalSha256:item.sourceSha256,
      proposedSha256:item.nextSha256,
      proposedBytes:item.bytes.length,
      editedPieces:item.modifiedFields
    })).sort((a,b)=>a.path.localeCompare(b.path)),
    warning:'Review-only archive of existing tracked page files. A matching Git commit, owner approval and separate resource migration are required for a complete update.'
  };
  const entries=planned.changed.map(item=>({name:item.path,bytes:item.bytes}));
  entries.push({name:MANIFEST,bytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8')});
  entries.push({name:GUIDE,bytes:Buffer.from(instructions(manifest),'utf8')});
  const archive=encode(entries,paths);
  const checked=verifyPagePackage(archive,manifest,planned.changed);
  if(checked.verifiedEntries!==paths.size)
    throw Error('Reviewed archive verification did not cover every file.');
  return {
    bytes:archive,
    manifest,
    report:{
      format:FORMAT,
      reviewedCommit:receipt.reviewedGitCommit,
      changedTrackedFiles:planned.changed.length,
      excludedCandidateResourceChanges:receipt.changedProposedResourceCount,
      separateGithubPathsVerified:true,
      archiveEntries:checked.verifiedEntries,
      archiveSha256:sha(archive),archiveBytes:archive.length,
      reviewedSourceChecksumsMatch:true,
      ownerApproved:false,deployable:false,githubReadyForDeployment:false,
      completeWebsiteUpdate:false,repositoryModified:false
    }
  };
}
function verifyPagePackage(archive,expectedManifest,plannedChanged){
  const allowed=safeList(plannedChanged);
  const parsed=decode(archive,allowed);
  const metadata=parsed.entries.find(x=>x.name===MANIFEST);
  const guide=parsed.entries.find(x=>x.name===GUIDE);
  if(!metadata||!guide)throw Error('Missing reviewed update instructions or manifest.');
  const expectedBytes=Buffer.from(JSON.stringify(expectedManifest,null,2)+'\n','utf8');
  if(!metadata.bytes.equals(expectedBytes)||
     !guide.bytes.equals(Buffer.from(instructions(expectedManifest),'utf8')))
    throw Error('Archive review manifest or safety instructions changed.');
  for(const change of plannedChanged){
    const found=parsed.entries.find(x=>x.name===change.path);
    if(!found||!found.bytes.equals(change.bytes)||
       sha(found.bytes)!==change.nextSha256)
      throw Error('Reviewed path does not contain exact planned bytes.');
  }
  return {
    verifiedEntries:parsed.entryCount,
    archiveSha256:parsed.archiveSha256,
    originalPathsPreserved:true,
    unexpectedFilesAccepted:false
  };
}
function loadReviewFile(name){
  const entry=sourceDraft(name);
  return entry.value;
}
function parseArgs(args){
  if(!Array.isArray(args)||args.length%2!==0||!args.length)
    throw Error('Provide --pages private.json --receipt private.review.json --output /private/changed-pages.zip [--resources private.json]');
  const flags=new Set(['--pages','--receipt','--resources','--output']),obj={};
  for(let i=0;i<args.length;i+=2){
    if(!flags.has(args[i])||Object.hasOwn(obj,args[i])||
       typeof args[i+1]!=='string'||!args[i+1])
      throw Error('Unsupported, duplicate or empty reviewed export option.');
    obj[args[i]]=args[i+1];
  }
  if(!obj['--pages']||!obj['--receipt']||!obj['--output'])
    throw Error('A page draft, exact review receipt and private output are required.');
  return {pagesFile:obj['--pages'],receiptFile:obj['--receipt'],
    resourcesFile:obj['--resources']||null,output:obj['--output']};
}
async function saveReviewedPagePackage(root,{pagesFile,receiptFile,resourcesFile=null,output}={}){
  const outputFile=outputOutsideCheckout(output,root);
  const drafts={pages:loadReviewFile(pagesFile)};
  if(resourcesFile)drafts.resources=loadReviewFile(resourcesFile);
  const receipt=loadReviewFile(receiptFile);
  const result=await createPagePackage(root,drafts,receipt);
  // Check the private source files were not changed during verification.
  if(JSON.stringify(drafts.pages)!==JSON.stringify(loadReviewFile(pagesFile))||
     resourcesFile&&JSON.stringify(drafts.resources)!==
       JSON.stringify(loadReviewFile(resourcesFile))||
     JSON.stringify(receipt)!==JSON.stringify(loadReviewFile(receiptFile)))
    throw Error('Draft or receipt changed while creating the reviewed archive.');
  saveLocalArchive(result.bytes,outputFile,root);
  return {...result.report,savedOutsideRepository:true};
}
if(require.main===module){
  (async()=>{
    const args=parseArgs(process.argv.slice(2));
    return saveReviewedPagePackage(path.resolve(__dirname,'..','..'),args);
  })().then(report=>process.stdout.write(JSON.stringify(report,null,2)+'\n'))
    .catch(_=>{
      process.stderr.write('Reviewed page package refused: check source commit, exact draft/receipt and private output location. No source values printed.\n');
      process.exitCode=1;
    });
}
module.exports={FORMAT,MANIFEST,GUIDE,createPagePackage,verifyPagePackage,
  saveReviewedPagePackage,parseArgs,instructions};

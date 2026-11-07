'use strict';
/*
 * Commit-bound REVIEW receipt for existing v3 page/navigation and v2 resource
 * JSON drafts. A trusted local Git checkout is checked at review time.
 * This does NOT prove when a browser draft was originally authored, sign
 * any file, create deployable website source, publish or update Git refs.
 *
 * The receipt contains ONLY hashes, known relative paths and review flags.
 * Its SHA-256 is an integrity check, NOT an authentication signature.
 */
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {planMixed}=require('./plan-mixed-editor-update.cjs');
const {PAGES,NAV}=require('./plan-page-draft.cjs');

const FORMAT='naxx-draft-commit-review-binding-v1';
const HEX_SHA=/^[a-f0-9]{40,64}$/;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')
    return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))
    return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object'&&
     (Object.getPrototypeOf(value)===Object.prototype||
      Object.getPrototypeOf(value)===null)){
    const parts=[];
    for(const key of Object.keys(value).sort()){
      if(key==='__proto__'||key==='constructor'||key==='prototype')
        throw Error('Unsafe draft metadata.');
      parts.push(JSON.stringify(key)+':'+canonical(value[key]));
    }
    return '{'+parts.join(',')+'}';
  }
  throw Error('Draft contains a non-JSON value.');
}
function objectDigest(value){
  return hash(Buffer.from(canonical(value),'utf8'));
}
function git(root,args){
  const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',
    timeout:20000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
  if(r.error||r.status!==0)throw Error('Git source-tree identity unavailable.');
  return r.stdout.trim();
}
async function bindAtReview(root,drafts,expectedCommit){
  if(typeof root!=='string'||!path.isAbsolute(root)||
     typeof expectedCommit!=='string'||!HEX_SHA.test(expectedCommit)||
     !drafts||typeof drafts!=='object'||Array.isArray(drafts)||
     Object.keys(drafts).sort().join(',')!==
       (drafts.pages&&drafts.resources?'pages,resources':
        drafts.pages?'pages':drafts.resources?'resources':''))
    throw Error('Specify an explicit reviewed Git commit and supported draft fields.');
  // No implicit HEAD: a reviewer must deliberately specify the commit.
  const plan=await planMixed(root,{...drafts,expectedCommit});
  if(plan.commit!==expectedCommit||!plan.currentCheckoutCommitVerified||
     !plan.noRepositoryFilesWritten||!plan.changedPathsTotal)
    throw Error('Drafts could not be bound to the requested clean Git commit.');
  const tree=git(root,['rev-parse','HEAD^{tree}']);
  if(!HEX_SHA.test(tree))throw Error('Git root tree hash unavailable.');
  const files=[...PAGES,NAV,'site-content.html'].map(relative=>{
    const filename=path.join(root,...relative.split('/'));
    const stat=fs.lstatSync(filename);
    if(!stat.isFile()||stat.isSymbolicLink())
      throw Error('An expected bound source path is missing or unsafe.');
    return {path:relative,sourceSha256:hash(fs.readFileSync(filename))};
  });
  const knownChanges=[
    ...plan.changedExistingPagePaths.map(item=>({
      path:item.path,kind:item.kind,
      originalSha256:item.sourceSha256,reviewedSha256:item.nextSha256,
      trackedAtReview:true
    })),
    ...plan.changedCandidateResourcePaths.map(item=>({
      path:item.path,kind:item.kind,
      originalSha256:item.sourceSha256,reviewedSha256:item.nextSha256,
      trackedAtReview:false
    }))
  ].sort((a,b)=>a.path.localeCompare(b.path));
  const receipt={
    format:FORMAT,
    boundAtReview:true,
    authoredAtThisCommitProven:false,
    cryptographicallySigned:false,
    githubReady:false,publishable:false,deployable:false,
    approvedByOwner:false,
    reviewedGitCommit:expectedCommit,
    reviewedGitTree:tree,
    checkoutFingerprintSha256:plan.checkedOutSourceFingerprint,
    sourceFiles:files,
    pageDraftSha256:drafts.pages?objectDigest(drafts.pages):null,
    resourceDraftSha256:drafts.resources?objectDigest(drafts.resources):null,
    originalSiteSha256:plan.originalSiteSha256,
    proposedGeneratedSiteSha256:plan.plannedGeneratedSiteSha256,
    plannedChanges:knownChanges,
    changedExistingPageCount:plan.changedExistingPagePaths.length,
    changedProposedResourceCount:plan.changedCandidateResourcePaths.length,
    resourceSourceTreeCommitted:false,
    outputType:'review receipt only',
    warning:'The Git checkout and draft bytes were matched at review time. This does not prove draft authorship, grant deployment permission or authenticate the receipt.'
  };
  return {...receipt,receiptSha256:objectDigest(receipt)};
}
async function verifyReviewBinding(root,drafts,receipt){
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
     receipt.format!==FORMAT||!HEX_SHA.test(receipt.reviewedGitCommit)||
     receipt.boundAtReview!==true||receipt.authoredAtThisCommitProven!==false||
     receipt.githubReady!==false||receipt.publishable!==false||
     receipt.deployable!==false||receipt.cryptographicallySigned!==false||
     receipt.approvedByOwner!==false||receipt.resourceSourceTreeCommitted!==false)
    throw Error('Review receipt is not a permitted commit-bound source record.');
  const digest=receipt.receiptSha256;
  if(typeof digest!=='string'||!(/^[a-f0-9]{64}$/).test(digest))
    throw Error('Missing review receipt checksum.');
  const {receiptSha256:_ignored,...unsigned}=receipt;
  if(objectDigest(unsigned)!==digest)
    throw Error('Review receipt was modified after creation.');
  // Re-run the entire checkout + draft validation against its *original*
  // requested commit. Do not trust hashes supplied by the receipt.
  const current=await bindAtReview(root,drafts,receipt.reviewedGitCommit);
  if(canonical(current)!==canonical(receipt))
    throw Error('Review receipt no longer matches exact saved drafts and checkout.');
  return {
    format:'naxx-review-binding-verified-v1',
    checkedGitCommit:current.reviewedGitCommit,
    checkoutMatchesRequestedCommit:true,
    pageDraftMatchesReceipt:current.pageDraftSha256!==null?true:null,
    resourceDraftMatchesReceipt:current.resourceDraftSha256!==null?true:null,
    reviewedChangeCount:current.plannedChanges.length,
    existingPagePaths:current.changedExistingPageCount,
    proposedResourcePaths:current.changedProposedResourceCount,
    authoredAtThisCommitProven:false,
    githubReady:false,publishable:false,deployable:false,
    approvedByOwner:false,
    noRepositoryWrites:true
  };
}
if(require.main===module){
  process.stderr.write('Commit-binding library only. It never publishes or modifies a website.\n');
}
module.exports={FORMAT,canonical,objectDigest,bindAtReview,verifyReviewBinding};

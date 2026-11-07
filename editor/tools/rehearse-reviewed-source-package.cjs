'use strict';
/*
 * PRIVATE REVIEWED SOURCE-PACKAGE REHEARSAL — TEMPORARY FILES ONLY.
 *
 * Produces a candidate set of exact proposed GitHub file BYTES inside an
 * OS-private disposable folder, and independently rechecks those bytes
 * against the source-bound, checksum-only review receipt. No ZIP/export to
 * the user; no writes to any repository; no GitHub API or deployment.
 *
 * Source layout is UNAPPROVED. Do not connect this to live editor Save.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {proposedReceipt,RUNTIME}=require('./plan-private-github-source-review.cjs');
const {validateReceipt}=require('./rehearse-local-git-head-preflight.cjs');
const {verify,plan,draftFrom,withTemporaryVersions,save}=
  require('./rehearse-versioned-resource-sessions.cjs');
const {parseDraft}=require('./verify-physical-resource-sources.cjs');
const {restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {MANIFEST,recordPath,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');

const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const FORMAT='naxx-private-verified-file-package-v1';
const MAX_PACKAGED_FILE=35*1024*1024;
const MAX_PACKAGE_FILES=COUNT+2;
const b=text=>Buffer.from(text,'utf8');

function checkedPackagePath(root,relative){
  if(typeof root!=='string'||!path.isAbsolute(root)||
     typeof relative!=='string'||relative.startsWith('/')||
     relative.includes('\\')||relative.includes('\0')||
     relative.split('/').some(x=>!x||x==='.'||x==='..')||
     !([RUNTIME,MANIFEST].includes(relative)||
       Array.from({length:COUNT},(_,i)=>recordPath(i)).includes(relative)))
    throw Error('Unapproved proposed package path.');
  const resolved=path.resolve(root,...relative.split('/'));
  if(!resolved.startsWith(path.resolve(root)+path.sep))
    throw Error('Proposed path escapes private package folder.');
  return resolved;
}
function sourceBoundMap(sourceFolder,original,draft,receipt){
  // Review must precede staging, including checks on all 414 actual source
  // fragments, their manifest and complete rebuilt old source.
  const fresh=proposedReceipt(sourceFolder,original,draft);
  validateReceipt(fresh);
  if(!receipt||JSON.stringify(fresh)!==JSON.stringify(receipt))
    throw Error('Package receipt was changed since its full-source review.');
  const current=verify(sourceFolder,original),next=plan(current,parseDraft(draft));
  if(next.manifest.sourceSha256!==receipt.proposedFullSiteSha256||
     current.manifest.sourceSha256!==receipt.expectedCurrentSourceSha256||
     next.manifest.revision!==receipt.proposedRevision||
     current.manifest.revision!==receipt.currentRevision)
    throw Error('Source revision moved before staging the proposed files.');
  const generated=restoreInMemory(current.split,next.newRecords);
  if(sha(generated)!==receipt.proposedFullSiteSha256||
     generated.length!==receipt.sourceBytesAfter||
     sha(original)!==SOURCE_SHA)
    throw Error('Full rebuilt HTML differs from the reviewed source.');
  const expected=new Map([
    [RUNTIME,generated],
    [MANIFEST,b(JSON.stringify(next.manifest)+'\n')],
    ...next.indices.map(i=>[recordPath(i),b(next.newRecords[i])])
  ]);
  if(expected.size!==receipt.proposedFileCount||
     expected.size!==next.indices.length+2)
    throw Error('Incomplete proposed package file set.');
  for(const file of receipt.proposedPaths){
    const data=expected.get(file.path);
    if(!data||data.length<1||data.length>MAX_PACKAGED_FILE||
       data.length!==file.newBytes||
       sha(data)!==file.proposedNewSha256)
      throw Error('Proposed file bytes differ from source-bound receipt.');
  }
  return expected;
}
function writePrivateFile(root,relative,bytes){
  const dest=checkedPackagePath(root,relative);
  let folder=path.resolve(root);
  const chunks=relative.split('/');
  for(const chunk of chunks.slice(0,-1)){
    folder=path.join(folder,chunk);
    try{fs.mkdirSync(folder,{mode:0o700});}
    catch(e){if(e.code!=='EEXIST')throw e;}
    const s=fs.lstatSync(folder);
    if(!s.isDirectory()||s.isSymbolicLink())
      throw Error('Private package folder path is unsafe.');
  }
  fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});
}
function packageInventory(root,allowed){
  const actual=[];
  function visit(folder){
    const children=fs.readdirSync(folder,{withFileTypes:true});
    for(const entry of children){
      const full=path.join(folder,entry.name),st=fs.lstatSync(full);
      if(st.isSymbolicLink())throw Error('Symlink in private package.');
      if(st.isDirectory())visit(full);
      else if(st.isFile())actual.push(path.relative(root,full).split(path.sep).join('/'));
      else throw Error('Unsafe file type in private package.');
      if(actual.length>MAX_PACKAGE_FILES)
        throw Error('Unexpected extra files in private package.');
    }
  }
  visit(root);
  if(actual.length!==allowed.size||actual.some(file=>!allowed.has(file)))
    throw Error('Missing or unexpected files in proposed package.');
  return actual.length;
}
function verifyPackage(root,sourceFolder,original,draft,receipt){
  if(!receipt||typeof receipt!=='object')throw Error('Review receipt required.');
  validateReceipt(receipt);
  // Independently recalculate everything from the current *physical* source
  // and the exact draft. A matching SHA in a forged manifest is not enough.
  const expected=sourceBoundMap(sourceFolder,original,draft,receipt);
  const size=packageInventory(root,new Set(expected.keys()));
  let total=0;
  for(const item of receipt.proposedPaths){
    const filename=checkedPackagePath(root,item.path);
    let parent=path.resolve(root);
    for(const component of item.path.split('/').slice(0,-1)){
      parent=path.join(parent,component);
      const s=fs.lstatSync(parent);
      if(!s.isDirectory()||s.isSymbolicLink())
        throw Error('Unsafe folder inside proposed source package.');
    }
    const stat=fs.lstatSync(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||
       stat.size<1||stat.size>MAX_PACKAGED_FILE)
      throw Error('Unsafe staged source file.');
    const actual=fs.readFileSync(filename);
    if(actual.length!==item.newBytes||
       sha(actual)!==item.proposedNewSha256||
       !actual.equals(expected.get(item.path)))
      throw Error('Packaged source bytes or file hash do not match review.');
    total+=stat.size;
  }
  return Object.freeze({
    format:FORMAT,sourceBound:true,reviewOnly:true,
    stagedFileCount:size,editedResourceFiles:receipt.editedResourceCount,
    unchangedResourceFiles:receipt.unchangedResourceCount,
    completeHtmlRebuilt:true,completeHtmlSha256Matched:true,
    reconstructedWebsiteBytes:receipt.sourceBytesAfter,
    newSourceRevision:receipt.proposedRevision,
    originalNonResourceShellPreserved:true,
    privateStagingBytes:total,
    backedUpSeparately:false,canonicalLayoutApproved:false,
    githubReady:false,actualEditorSaveConnected:false,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    repositoryFilesWritten:0,gitHubWrites:0,
    sourceValuesPrinted:false
  });
}
async function withReviewedPackage(sourceFolder,original,draftInput,callback){
  if(typeof callback!=='function')throw Error('Private package callback required.');
  // No arbitrary output destinations accepted, and no installed-site files.
  const receipt=proposedReceipt(sourceFolder,original,draftInput);
  const data=sourceBoundMap(sourceFolder,original,draftInput,receipt);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-review-package-'));
  fs.chmodSync(root,0o700);
  try{
    for(const [relative,bytes] of data)
      writePrivateFile(root,relative,bytes);
    const verified=verifyPackage(root,sourceFolder,original,draftInput,receipt);
    return await callback(Object.freeze({root,receipt,verified}));
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
}
async function demonstrate(original){
  let packagePath;
  const result=await withTemporaryVersions(original,async source=>{
    const current=verify(source,original);
    const draft=draftFrom(current,[
      {index:0,title:'Private reviewed packaging title'}
    ]);
    const first=await withReviewedPackage(source,original,draft,({root,receipt,verified})=>{
      packagePath=root;
      if(verified.stagedFileCount!==3||
         verified.editedResourceFiles!==1||
         receipt.proposedFileCount!==3)
        throw Error('Unexpected disposable GitHub candidate file count.');
      return {filesVerified:verified.stagedFileCount,
        editedResources:verified.editedResourceFiles,
        completeHtmlSha256Matched:verified.completeHtmlSha256Matched};
    });
    if(fs.existsSync(packagePath))
      throw Error('Private package folder was retained unexpectedly.');
    save(source,original,draft); // private temp source only, not repo
    let staleDraftRejected=false;
    try{
      await withReviewedPackage(source,original,draft,()=>{});
    }catch(_){staleDraftRejected=true;}
    if(!staleDraftRejected)
      throw Error('Stale second-session package was unexpectedly generated.');
    const state=verify(source,original);
    const latest=draftFrom(state,[
      {index:413,content:'Private next reviewed content.\n\nSecond paragraph.'}
    ]);
    const second=await withReviewedPackage(source,original,latest,({root,verified})=>{
      packagePath=root;
      return {filesVerified:verified.stagedFileCount,
        editedResources:verified.editedResourceFiles,
        nextRevision:verified.newSourceRevision};
    });
    return {first,staleDraftRejected,second};
  });
  if(!packagePath||fs.existsSync(packagePath))
    throw Error('Disposable package was not deleted.');
  return Object.freeze({
    format:'naxx-private-reviewed-package-demo-v1',
    ...result,physicalResourcesPreserved:COUNT,
    generatedSiteWasStagedOnly:true,
    tempStagingDeleted:true,sourceShellUnchanged:true,
    gitHubWrites:0,productionSiteWrites:0,
    approved:false,canApply:false,canPublish:false
  });
}
if(require.main===module){
  (async()=>{
    const original=fs.readFileSync(
      path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(await demonstrate(original),null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Private proposed package verification stopped safely.\n');
    process.exitCode=1;
  });
}
module.exports={
  FORMAT,checkedPackagePath,sourceBoundMap,packageInventory,
  verifyPackage,withReviewedPackage,demonstrate
};

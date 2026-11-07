'use strict';
/*
 * PRIVATE READ-ONLY RESOURCE SOURCE VERIFICATION.
 *
 * Unlike the browser JSON preflight, this checks ALL 414 actual source
 * fragments and the exact 31 MB original site-content.html shell, using only
 * local files. It rebuilds the whole runtime HTML IN MEMORY and verifies its
 * length and SHA-256 against the manifest before assessing a versioned draft.
 * No source data, individual resource hashes, file paths, credentials, or
 * edited content are printed. No files are changed, exported or deployed.
 *
 * This is NOT production save code or a canonical source layout.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {recordPath,MANIFEST,COUNT,filePaths}=
  require('./rehearse-resource-only-overlay.cjs');
const preflight=require('../restore-preflight-core.js');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const MAX_FRAGMENT_BYTES=1000000;
const MAX_MANIFEST_BYTES=262144;
const MAX_DRAFT_BYTES=16777216;
const approvedPaths=filePaths();
function onlyRegular(base,relative,maxBytes){
  if(!approvedPaths.has(relative))throw Error('Unapproved resource source path.');
  const target=path.resolve(base,...relative.split('/'));
  if(target!==path.resolve(base)&&!target.startsWith(path.resolve(base)+path.sep))
    throw Error('Resource source path escapes the private folder.');
  let parent=path.resolve(base);
  for(const segment of relative.split('/').slice(0,-1)){
    parent=path.join(parent,segment);
    const st=fs.lstatSync(parent);
    if(!st.isDirectory()||st.isSymbolicLink())
      throw Error('Non-directory or symlink in resource source path.');
  }
  const stat=fs.lstatSync(target);
  if(!stat.isFile()||stat.isSymbolicLink()||!Number.isSafeInteger(stat.size)||
     stat.size===0||stat.size>maxBytes)
    throw Error('Resource source file is missing or unsafe.');
  return fs.readFileSync(target);
}
function verifyInventory(folder){
  const root=path.resolve(folder),items=[];
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const target=path.join(dir,entry.name),stat=fs.lstatSync(target);
      if(stat.isSymbolicLink())throw Error('Symlink in source folder.');
      if(stat.isDirectory())walk(target);
      else if(stat.isFile())items.push(path.relative(root,target).split(path.sep).join('/'));
      else throw Error('Unsupported filesystem entry in source folder.');
      if(items.length>approvedPaths.size)
        throw Error('Too many files in source folder.');
    }
  }
  walk(root);
  if(items.length!==approvedPaths.size||items.some(x=>!approvedPaths.has(x)))
    throw Error('Missing or unexpected resource files.');
  return items.length;
}
function readManifest(folder){
  let result;
  try{
    const bytes=onlyRegular(folder,MANIFEST,MAX_MANIFEST_BYTES);
    if(!Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes))
      throw Error('Manifest is not reversible UTF-8.');
    result=JSON.parse(bytes.toString('utf8'));
  }catch(_){
    throw Error('Resource manifest could not be verified.');
  }
  if(!preflight.validManifest(result))
    throw Error('Resource manifest has invalid version/record structure.');
  return result;
}
function checkSource(folder,original){
  if(!Buffer.isBuffer(original)||sha(original)!==SOURCE_SHA)
    throw Error('Original website shell fingerprint is incorrect.');
  const split=splitInMemory(original);
  if(split.records.length!==COUNT||!restoreInMemory(split).equals(original))
    throw Error('Original website shell could not reconstruct exactly.');
  const totalFiles=verifyInventory(folder);
  const manifest=readManifest(folder);
  const records=[];
  let totalFragmentBytes=0;
  for(let i=0;i<COUNT;i++){
    const bytes=onlyRegular(folder,recordPath(i),MAX_FRAGMENT_BYTES);
    if(!Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes))
      throw Error('One resource fragment has invalid encoding.');
    if(sha(bytes)!==manifest.resources[i].sha256)
      throw Error('One resource fragment does not match its manifest checksum.');
    records.push(bytes.toString('utf8'));
    totalFragmentBytes+=bytes.length;
  }
  // The original non-resource shell and all original separators come only
  // from the verified source; no stored duplicate 30 MB shell is used.
  const built=restoreInMemory(split,records);
  if(built.length!==manifest.sourceBytes||
     sha(built)!==manifest.sourceSha256)
    throw Error('Complete HTML reconstruction does not match the manifest.');
  if(manifest.revision===0&&!built.equals(original))
    throw Error('Initial revision differs from the exact original site.');
  return {
    manifest,resourceFilesVerified:records.length,
    filesVerified:totalFiles,resourceBytesVerified:totalFragmentBytes,
    rebuiltSha256Matched:true,originalShellSha256Matched:true,
    verifiedBaselineNonResourceBytesUnchanged:true
  };
}
function parseDraft(draftInput){
  let result;
  if(Buffer.isBuffer(draftInput)){
    if(draftInput.length===0||draftInput.length>MAX_DRAFT_BYTES)
      throw Error('Draft file size is not allowed.');
    if(!Buffer.from(draftInput.toString('utf8'),'utf8').equals(draftInput))
      throw Error('Draft encoding is invalid.');
    try{result=JSON.parse(draftInput.toString('utf8'));}
    catch(_){throw Error('Versioned resource draft JSON is invalid.');}
  }else result=draftInput;
  if(!preflight.validDraft(result))
    throw Error('Versioned resource draft structure is invalid.');
  return result;
}
function verifyCompleteReadOnly(folder,original,draftInput){
  const verified=checkSource(folder,original); // all 414 physical files first
  const draft=parseDraft(draftInput);
  const decision=preflight.assess(verified.manifest,draft);
  // Keep the original verdict visible. A review-only verdict is STILL
  // not permission to apply, export, merge, authenticate or publish.
  return Object.freeze({
    format:'naxx-physical-resource-source-review-v1',
    sourceVerified:true,resourceFilesVerified:verified.resourceFilesVerified,
    filesVerified:verified.filesVerified,
    resourceBytesVerified:verified.resourceBytesVerified,
    fullHtmlSha256Matched:verified.rebuiltSha256Matched,
    originalShellSha256Matched:verified.originalShellSha256Matched,
    originalNonResourceDataPreserved:
      verified.verifiedBaselineNonResourceBytesUnchanged,
    decision:decision.code,
    requestedResourceCount:decision.requestedResourceCount,
    conflictingTargetCount:decision.changedTargetCount,
    readOnly:true,canApply:false,canPublish:false,canAutoMerge:false,
    sourceValuesPrinted:false,filesWritten:0
  });
}
if(require.main===module){
  // Independent temporary demonstration; never reads a user-chosen location
  // from command arguments or writes into the repo.
  (async()=>{
    const {withTemporaryVersions,verify,draftFrom,save}=
      require('./rehearse-versioned-resource-sessions.cjs');
    const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    const result=await withTemporaryVersions(original,dir=>{
      const state0=verify(dir,original);
      const stale=draftFrom(state0,[{index:0,title:'Private physical-check test'}]);
      const first=verifyCompleteReadOnly(dir,original,stale);
      save(dir,original,draftFrom(state0,[
        {index:413,content:'Private revised content.\n\nSecond paragraph.'}
      ]));
      const second=verifyCompleteReadOnly(dir,original,stale);
      const recent=draftFrom(verify(dir,original),[
        {index:0,title:'Next private versioned text'}
      ]);
      const third=verifyCompleteReadOnly(dir,original,recent);
      if(first.decision!=='review-only'||second.decision!=='stale'||
         third.decision!=='review-only'||!third.fullHtmlSha256Matched)
        throw Error('Physical source verification did not reject stale edits.');
      return {
        initialDecision:first.decision,staleDecision:second.decision,
        currentDecision:third.decision,
        filesVerified:third.filesVerified,
        resourcesVerified:third.resourceFilesVerified,
        fullHtmlReconstructedAndChecked:true,
        originalShellChecked:true
      };
    });
    process.stdout.write(JSON.stringify({
      format:'naxx-private-physical-source-smoke-v1',...result,
      originalWebsiteUnchanged:true,temporaryFolderDeleted:true,
      sourceValuesPrinted:false,filesWritten:0,published:false,
      deployable:false,ownerApproved:false
    },null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Private physical source verification stopped safely.\n');
    process.exitCode=1;
  });
}
module.exports={checkSource,verifyCompleteReadOnly,verifyInventory,
  readManifest,parseDraft,MAX_FRAGMENT_BYTES,MAX_MANIFEST_BYTES,MAX_DRAFT_BYTES};

'use strict';
/*
 * PRIVATE FULL TRACKED-WEBSITE COPY + 415-SOURCE CANDIDATE + ROLLBACK.
 *
 * Real browser review ZIP -> fully verified candidate staging -> all tracked
 * Git website files copied twice, independently hashed -> reviewed changes
 * only inside disposable site -> exact original restored from a separately
 * verified private working copy. NEVER modifies the repository or GitHub.
 *
 * NOT a complete Git history/GitHub service backup; see existing bundle
 * creator, and do not deploy from these private preview directories.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {withCompletePrivateCandidate}=
  require('./rehearse-browser-zip-complete-source.cjs');
const {trackedPaths,safeTrackedSource,copyTracked}=
  require('./rehearse-complete-site-snapshot.cjs');
const {inventory,safeRel}=require('./audit-full-checkout.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {filePaths,ROOT,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FMT='naxx-private-browser-zip-full-tracked-site-rollback-v1';
const overlayFiles=filePaths();
const read=(root,relative)=>{
  if(!safeRel(relative))throw Error('Unsafe private website file path.');
  let parent=root;
  for(const item of relative.split('/').slice(0,-1)){
    parent=path.join(parent,item);
    const dir=fs.lstatSync(parent);
    if(!dir.isDirectory()||dir.isSymbolicLink())
      throw Error('Untrusted folder inside private copy.');
  }
  const file=path.join(root,...relative.split('/'));
  const st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink())
    throw Error('Missing or unsafe private website file.');
  return fs.readFileSync(file);
};
function write(root,relative,bytes,existing=false){
  if(!safeRel(relative)||!Buffer.isBuffer(bytes))
    throw Error('Unsafe private website file replacement.');
  const target=path.join(root,...relative.split('/'));
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
  if(existing)read(root,relative);
  fs.writeFileSync(target,bytes,{flag:existing?'w':'wx',mode:0o600});
}
function list(root){
  const files=[];
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name),st=fs.lstatSync(full);
      if(st.isSymbolicLink())throw Error('Private website contains a symlink.');
      if(st.isDirectory())walk(full);
      else if(st.isFile())files.push(path.relative(root,full).split(path.sep).join('/'));
      else throw Error('Private website contains an unsupported file type.');
    }
  }
  walk(root);
  return files;
}
function inventoryExact(root,allow){
  const actual=list(root);
  if(actual.length!==allow.size||actual.some(file=>!allow.has(file)))
    throw Error('Private full site has missing or unexpected paths.');
  return actual.length;
}
function verifiedBackup(root,backup,names,fingerprint){
  inventoryExact(backup,new Set(names));
  const result=inventory(backup,names);
  if(result.fingerprintSha256!==fingerprint||result.trackedFiles!==names.length)
    throw Error('Independent original website copy is damaged.');
  for(const relative of names){
    const source=fs.readFileSync(safeTrackedSource(root,relative));
    if(!read(backup,relative).equals(source))
      throw Error('Saved original website file differs from clean checkout.');
  }
  return true;
}
function verifyFullSite(site,originalCopy,stage,names,changed,expected){
  const allow=new Set([...names,...overlayFiles]);
  if(new Set(names).size!==names.length||
     names.some(x=>overlayFiles.has(x)||x===ROOT||x.startsWith(ROOT+'/'))||
     changed.size!==expected.editedTrackedFiles+1||
     !changed.has(RUNTIME)||
     inventoryExact(site,allow)!==names.length+overlayFiles.size)
    throw Error('Full website candidate inventory is incomplete.');
  let protectedUnchanged=0,changedTracked=0,resourceCount=0;
  for(const relative of names){
    const actual=read(site,relative);
    if(changed.has(relative)){
      const planned=read(stage,relative);
      if(!actual.equals(planned)||!sha(actual).match(/^[a-f0-9]{64}$/))
        throw Error('A reviewed tracked page or runtime was modified.');
      changedTracked++;
    }else{
      if(!actual.equals(read(originalCopy,relative)))
        throw Error('An untouched website asset, loader or custom file changed.');
      protectedUnchanged++;
    }
  }
  for(const relative of overlayFiles){
    if(!read(site,relative).equals(read(stage,relative)))
      throw Error('A source overlay fragment or manifest changed in complete site.');
    resourceCount++;
  }
  if(resourceCount!==COUNT+1||changedTracked!==expected.editedTrackedFiles+1||
     sha(read(site,RUNTIME))!==expected.generatedRuntimeSha256)
    throw Error('Complete website source and tracked edited-file counts disagree.');
  if(!read(site,'index.html').equals(read(originalCopy,'index.html')))
    throw Error('Original root loader was modified.');
  return Object.freeze({
    trackedFileCount:names.length,
    unchangedTrackedFiles:protectedUnchanged,
    changedTrackedFiles:changedTracked,
    resourceSourceFiles:resourceCount,
    totalSiteFiles:allow.size,
    rootIndexPreserved:true,
    completeSiteRuntimeHashMatched:true,
    originalAssetsAndCustomFilesUnchanged:true
  });
}
function restoreOriginal(site,backup,root,names,fingerprint){
  verifiedBackup(root,backup,names,fingerprint);
  const expected=new Set([...names,...overlayFiles]);
  inventoryExact(site,expected);
  for(const relative of names){
    const expectedBytes=read(backup,relative);
    // Re-copy every tracked original byte: rollback is independent of the
    // proposed edit list and preserves original page/media/script contents.
    write(site,relative,expectedBytes,true);
  }
  const resourceDir=path.join(site,...ROOT.split('/'));
  const dir=fs.lstatSync(resourceDir);
  if(!dir.isDirectory()||dir.isSymbolicLink())
    throw Error('Unsafe private candidate removal target.');
  fs.rmSync(resourceDir,{recursive:true,force:false});
  inventoryExact(site,new Set(names));
  const restored=inventory(site,names);
  if(restored.fingerprintSha256!==fingerprint)
    throw Error('Restored original website does not match every tracked file.');
  for(const relative of names)
    if(!read(site,relative).equals(read(backup,relative)))
      throw Error('Original website file was not fully restored.');
  return Object.freeze({
    originalTrackedWebsiteRestoredExactly:true,
    originalOverlayCandidateRemoved:true,
    restoredTrackedFiles:restored.trackedFiles,
    restoredFingerprintSha256:restored.fingerprintSha256
  });
}
async function withFullSiteRollback(checkout,zip,commit,inspect=null){
  if(inspect!==null&&typeof inspect!=='function')
    throw Error('Private full-site test inspector must be a function.');
  const before=verifyCheckout(checkout,commit);
  const all=trackedPaths(checkout),originalSet=new Set(all);
  if(originalSet.size!==all.length||!all.includes('index.html')||
     !all.includes(RUNTIME)||all.some(x=>x===ROOT||x.startsWith(ROOT+'/')))
    throw Error('The 415-file overlay collides with tracked website paths.');
  let directory;
  const result=await withCompletePrivateCandidate(checkout,zip,commit,
    async candidate=>{
      directory=fs.mkdtempSync(path.join(os.tmpdir(),
        'naxx-full-site-415-restore-trial-'));
      fs.chmodSync(directory,0o700);
      const backup=path.join(directory,'original'),
        site=path.join(directory,'staged');
      fs.mkdirSync(backup,{mode:0o700});
      fs.mkdirSync(site,{mode:0o700});
      try{
        const source=copyTracked(checkout,backup,all);
        const initial=copyTracked(checkout,site,all);
        if(source.fingerprintSha256!==before.fingerprintSha256||
           initial.fingerprintSha256!==before.fingerprintSha256)
          throw Error('Copied tracked source differs from verified Git checkout.');
        verifiedBackup(checkout,backup,all,source.fingerprintSha256);
        for(const rel of overlayFiles)write(site,rel,read(candidate.stage,rel));
        const edited=[RUNTIME,...candidate.proposedPages.map(x=>x.path)];
        const changeSet=new Set(edited);
        if(changeSet.size!==edited.length||edited.some(x=>!originalSet.has(x)))
          throw Error('Reviewed existing page changes cannot be applied to site copy.');
        for(const rel of edited)
          write(site,rel,read(candidate.stage,rel),true);
        const expected={
          editedTrackedFiles:candidate.evidence.editedPageNavigationFilesVerified,
          generatedRuntimeSha256:candidate.evidence.generatedRuntimeSha256
        };
        const staged=verifyFullSite(site,backup,candidate.stage,all,
          changeSet,expected);
        if(inspect)await inspect(Object.freeze({
          site,backup,stage:candidate.stage,checkout,trackedNames:all,
          expectedFingerprint:source.fingerprintSha256,changeSet,
          verifyStaged:()=>verifyFullSite(site,backup,candidate.stage,all,
            changeSet,expected),
          verifyBackup:()=>verifiedBackup(checkout,backup,all,
            source.fingerprintSha256)
        }));
        verifyFullSite(site,backup,candidate.stage,all,changeSet,expected);
        const restored=restoreOriginal(site,backup,checkout,all,
          source.fingerprintSha256);
        return Object.freeze({
          format:FMT,
          stagedTrackedFiles:staged.trackedFileCount,
          stagedSourceFiles:staged.resourceSourceFiles,
          preservedUnchangedTrackedFiles:staged.unchangedTrackedFiles,
          revisedTrackedFiles:staged.changedTrackedFiles,
          stagedTotalFiles:staged.totalSiteFiles,
          originalRootLoaderByteExact:staged.rootIndexPreserved,
          customScriptsAssetsAndUnchangedPagesPreserved:
            staged.originalAssetsAndCustomFilesUnchanged,
          completeSiteRuntimeHashMatched:staged.completeSiteRuntimeHashMatched,
          rollbackTrackedFiles:restored.restoredTrackedFiles,
          rollbackOriginalTrackedFingerprint:restored.restoredFingerprintSha256,
          privateRollbackExact:restored.originalTrackedWebsiteRestoredExactly,
          candidateResourceTreeDeleted:restored.originalOverlayCandidateRemoved,
          completeGitHistoryBackupRetained:false,
          externalBackupCreated:false,
          originalAdminAcceptanceCompleted:false,
          canonicalLayoutApproved:false,realGitHubSaveReady:false,
          ownerApproved:false,canApply:false,canMerge:false,canPublish:false,
          websiteFilesWritten:0,gitHubWrites:0,sourceValuesPrinted:false
        });
      }finally{
        fs.rmSync(directory,{recursive:true,force:true});
      }
    });
  if(!directory||fs.existsSync(directory)||
     result.sourceCheckoutUnchanged!==true||
     result.temporaryPackageDeleted!==true)
    throw Error('Private site or staging folder was not cleaned up.');
  const after=verifyCheckout(checkout,commit);
  if(after.fingerprintSha256!==before.fingerprintSha256)
    throw Error('Real Git checkout changed during private full-site trial.');
  return Object.freeze({...result,allTemporarySiteCopiesDeleted:true,
    originalRepositoryCheckoutUnchanged:true});
}
module.exports=Object.freeze({
  FMT,read,list,inventoryExact,verifiedBackup,verifyFullSite,restoreOriginal,
  withFullSiteRollback
});

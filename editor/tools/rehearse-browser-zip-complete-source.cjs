'use strict';
/*
 * PRIVATE COMPLETE 415-FILE SOURCE-MIGRATION PACKAGE REHEARSAL.
 *
 * Takes the REAL browser review ZIP and verified clean Git checkout, then
 * assembles every one of the 415 proposed resource overlay source files,
 * the rebuilt complete website and changed tracked page/navigation paths
 * exclusively under OS-private temporary directories. No Git objects,
 * branch mutation, network calls, release capability or site-source writes.
 *
 * An initial resource-source migration CANNOT consist solely of changed
 * fragments + manifest: all 413 unchanged resource fragments must be present.
 * This proof intentionally stages the complete proposed authoring layout.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {inspectArchive,planFromReviewZip,privateZip}=
  require('./review-private-combined-zip.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {plan:planPages,PAGES,NAV}=require('./plan-page-draft.cjs');
const {prepareResourceReview}=require('./rehearse-legacy-draft-bridge.cjs');
const {withTemporaryVersions,verify:verifyOverlay}=
  require('./rehearse-versioned-resource-sessions.cjs');
const {withReviewedPackage}=require('./rehearse-reviewed-source-package.cjs');
const {filePaths,recordPath,COUNT,MANIFEST}=
  require('./rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const {restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const FORMAT='naxx-private-complete-415-overlay-package-v1';
const GIT_SHA=/^[a-f0-9]{40}$/;
const sourcePaths=filePaths(),tracked=new Set([...PAGES,NAV,RUNTIME]);
const allow=new Set([...sourcePaths,...tracked]);
function relativeFile(root,relative){
  if(!allow.has(relative)||typeof root!=='string'||!path.isAbsolute(root))
    throw Error('Unexpected private source package path.');
  return path.join(root,...relative.split('/'));
}
function safeRead(root,relative){
  const file=relativeFile(root,relative);
  let check=root;
  for(const part of relative.split('/').slice(0,-1)){
    check=path.join(check,part);
    const s=fs.lstatSync(check);
    if(!s.isDirectory()||s.isSymbolicLink())
      throw Error('Unexpected private source package directory.');
  }
  const s=fs.lstatSync(file);
  if(!s.isFile()||s.isSymbolicLink()||s.size>36*1024*1024)
    throw Error('Unexpected private source package file type or size.');
  return fs.readFileSync(file);
}
function safeWrite(root,relative,bytes,overwrite=false){
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>36*1024*1024)
    throw Error('Unverified candidate source bytes.');
  const destination=relativeFile(root,relative);
  fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
  if(overwrite)safeRead(root,relative);
  fs.writeFileSync(destination,bytes,{flag:overwrite?'w':'wx',mode:0o600});
}
function walk(root){
  const found=[];
  function step(folder){
    for(const child of fs.readdirSync(folder,{withFileTypes:true})){
      const file=path.join(folder,child.name),s=fs.lstatSync(file);
      if(s.isSymbolicLink())throw Error('Symlink forbidden in private candidate.');
      if(s.isDirectory())step(file);
      else if(s.isFile())found.push(path.relative(root,file).split(path.sep).join('/'));
      else throw Error('Special file forbidden in private candidate.');
    }
  }
  step(root);
  return found;
}
function assertExactInventory(root,expected){
  const files=walk(root);
  if(files.length!==expected.size||
     files.some(file=>!expected.has(file)))
    throw Error('Private candidate has missing or extra paths.');
  return files.length;
}
function verifyCompletePackage(stage,overlay,original,proposedPages,resourceReceipt){
  if(!resourceReceipt||!Array.isArray(resourceReceipt.proposedPaths)||
     !Array.isArray(proposedPages)||!proposedPages.length)
    throw Error('Original reviewed resources and page edits are required.');
  const selected=verifyOverlay(overlay,original);
  if(selected.manifest.revision!==1||
     selected.manifest.parentSha256!==SOURCE_SHA||
     selected.records.length!==COUNT)
    throw Error('The verified resource overlay is not an exact first revision.');
  const rebuilt=restoreInMemory(selected.split,selected.records);
  const candidateRuntime=safeRead(stage,RUNTIME);
  if(!candidateRuntime.equals(rebuilt)||
     sha(rebuilt)!==selected.manifest.sourceSha256||
     sha(rebuilt)!==resourceReceipt.proposedFullSiteSha256)
    throw Error('Candidate runtime is not reconstructed from physical 414 resources.');
  const expected=new Set([...sourcePaths,RUNTIME,
    ...proposedPages.map(p=>p.path)]);
  const count=assertExactInventory(stage,expected);
  if(count!==COUNT+2+proposedPages.length)
    throw Error('Initial source migration candidate omitted unchanged files.');
  let same=0,changed=0;
  for(const name of sourcePaths){
    const actual=safeRead(stage,name),source=safeRead(overlay,name);
    if(!actual.equals(source))throw Error('Packaged overlay source differs from checked 415-file source.');
    if(name===MANIFEST)continue;
    if(sha(actual)!==selected.manifest.resources[Number(name.match(/(\d{4})\.fragment$/)[1])-1].sha256)
      throw Error('A packaged resource SHA does not match the manifest.');
    same++;
  }
  for(const item of proposedPages){
    const bytes=safeRead(stage,item.path);
    if(!bytes.equals(item.bytes)||sha(bytes)!==item.nextSha256)
      throw Error('Packaged page/navigation bytes differ from the reviewed source.');
    changed++;
  }
  const proposals=resourceReceipt.proposedPaths;
  if(proposals.length!==resourceReceipt.editedResourceCount+2)
    throw Error('Resource change receipt is incomplete.');
  for(const entry of proposals){
    const actual=safeRead(stage,entry.path);
    if(actual.length!==entry.newBytes||sha(actual)!==entry.proposedNewSha256)
      throw Error('Candidate source files conflict with the reviewed resource receipt.');
  }
  return Object.freeze({
    completeResourceSourceFiles:same+1,
    resourceFragmentsVerified:same,
    trackedCompatibilityFileVerified:true,
    editedPageNavigationFilesVerified:changed,
    stagedPathCount:count,
    generatedRuntimeSha256:sha(rebuilt),
    initialSourceMigrationComplete:true
  });
}
async function withCompletePrivateCandidate(checkout,archive,reviewedCommit,callback){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !Buffer.isBuffer(archive)||archive.length<22||
     archive.length>20*1024*1024||
     !GIT_SHA.test(reviewedCommit||'')||typeof callback!=='function')
    throw Error('Private browser archive, clean checkout, Git SHA and callback required.');
  const before=verifyCheckout(checkout,reviewedCommit);
  const inspected=await inspectArchive(archive);
  if(!inspected.hasPageDraft||!inspected.hasResourceDraft)
    throw Error('Full mixed source package requires page and resource review drafts.');
  const original=fs.readFileSync(path.join(checkout,RUNTIME));
  if(sha(original)!==SOURCE_SHA)throw Error('Exact original full website source required.');
  const plan=await planFromReviewZip(checkout,archive,reviewedCommit);
  const pages=planPages(checkout,JSON.parse(inspected.pageDraftText));
  if(!pages.changed.length||pages.changed.length!==plan.existingPageAndNavigationChanges)
    throw Error('No matching edited page/navigation files available.');
  let tempRoot;
  const result=await withTemporaryVersions(original,async sourceFolder=>{
    const resourceReview=await prepareResourceReview(sourceFolder,original,
      Buffer.from(inspected.resourceDraftText,'utf8'));
    if(resourceReview.decision!=='review-only'||
       resourceReview.editedResourceCount!==plan.proposedResourceChanges)
      throw Error('Resources cannot be converted to a reviewed first revision.');
    return withReviewedPackage(sourceFolder,original,
      resourceReview.convertedDraft,async ({root:patchRoot,receipt,verified})=>{
        if(verified.stagedFileCount!==receipt.proposedFileCount||
           !verified.completeHtmlSha256Matched||
           receipt.proposedFullSiteSha256!==plan.proposedCompatibilitySha256)
          throw Error('Source-bound resource package disagrees with the browser ZIP.');
        tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-browser-full-source-stage-'));
        fs.chmodSync(tempRoot,0o700);
        const overlay=path.join(tempRoot,'overlay'),stage=path.join(tempRoot,'stage');
        fs.mkdirSync(overlay,{mode:0o700});
        fs.mkdirSync(stage,{mode:0o700});
        try{
          for(const rel of sourcePaths)
            safeWrite(overlay,rel,safeRead(sourceFolder,rel));
          for(const item of receipt.proposedPaths){
            if(item.path===RUNTIME)continue;
            safeWrite(overlay,item.path,safeRead(patchRoot,item.path),true);
          }
          const assembled=verifyOverlay(overlay,original);
          if(assembled.manifest.sourceSha256!==receipt.proposedFullSiteSha256)
            throw Error('415-file source tree cannot regenerate the reviewed website.');
          // Full initial migration package, not just edited fragments.
          for(const rel of sourcePaths)
            safeWrite(stage,rel,safeRead(overlay,rel));
          safeWrite(stage,RUNTIME,safeRead(patchRoot,RUNTIME));
          for(const item of pages.changed)
            safeWrite(stage,item.path,item.bytes);
          const evidence=verifyCompletePackage(stage,overlay,original,
            pages.changed,receipt);
          if(evidence.generatedRuntimeSha256!==plan.proposedCompatibilitySha256||
             evidence.editedPageNavigationFilesVerified!==
               plan.existingPageAndNavigationChanges)
            throw Error('Mixed physical staged paths do not match reviewed ZIP.');
          const sourceStillOriginal=verifyOverlay(sourceFolder,original);
          if(sourceStillOriginal.manifest.revision!==0||
             sourceStillOriginal.manifest.sourceSha256!==SOURCE_SHA)
            throw Error('Original temporary resource source was unexpectedly edited.');
          const view=Object.freeze({
            stage,overlay,sourceFolder,
            proposedPages:pages.changed,resourceReceipt:receipt,
            evidence,original
          });
          return await callback(view);
        }finally{fs.rmSync(tempRoot,{recursive:true,force:true});}
      });
  });
  if(!tempRoot||fs.existsSync(tempRoot))
    throw Error('Disposable complete source package was not deleted.');
  const after=verifyCheckout(checkout,reviewedCommit);
  if(before.fingerprintSha256!==after.fingerprintSha256)
    throw Error('Real Git checkout changed during private file staging.');
  return Object.freeze({...result,
    sourceCheckoutUnchanged:true,temporaryPackageDeleted:true});
}
async function demonstrate(checkout,archive,reviewedCommit){
  return withCompletePrivateCandidate(checkout,archive,reviewedCommit,
    ({stage,overlay,original,proposedPages,resourceReceipt,evidence})=>{
      const final=verifyCompletePackage(stage,overlay,original,
        proposedPages,resourceReceipt);
      if(final.stagedPathCount!==evidence.stagedPathCount)
        throw Error('Staged physical package changed since verification.');
      return Object.freeze({
        format:FORMAT,readOnly:true,reviewOnly:true,
        initialFullResourceLayoutStaged:true,
        sourceFilesStaged:final.completeResourceSourceFiles,
        editedExistingFiles:final.editedPageNavigationFilesVerified,
        fullCompatibilityStaged:final.trackedCompatibilityFileVerified,
        totalCandidatePaths:final.stagedPathCount,
        completeCompatibilityHashVerified:true,
        initialUnchangedResourceFragmentsIncluded:true,
        originalWebsiteResourceCount:COUNT,
        originalNonResourceShellPreserved:true,
        sourceLayoutChosen:false,sourceMigrationApproved:false,
        realGitHubWriter:false,fullRepositoryBackup:false,
        authenticatedAdminAccepted:false,
        canApply:false,canPush:false,canMerge:false,canPublish:false,
        repositoryFilesWritten:0,gitHubWrites:0
      });
    });
}
async function inspectSavedZip(checkout,filename,commit){
  const selected=privateZip(checkout,filename);
  const result=await demonstrate(selected.root,selected.bytes,commit);
  const after=privateZip(checkout,filename);
  if(after.file!==selected.file||sha(after.bytes)!==sha(selected.bytes))
    throw Error('Private ZIP changed while preparing a disposable source package.');
  return result;
}
if(require.main===module){
  (async()=>{
    const {parseArgs}=require('./review-private-combined-zip.cjs');
    const args=parseArgs(process.argv.slice(2));
    process.stdout.write(JSON.stringify(await inspectSavedZip(args.checkout,
      args.archive,args.expectedCommit),null,2)+'\n');
  })().catch(()=>{
    process.stderr.write('Private full-source staging refused; nothing was deployed.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({
  FORMAT,verifyCompletePackage,withCompletePrivateCandidate,
  demonstrate,inspectSavedZip
});

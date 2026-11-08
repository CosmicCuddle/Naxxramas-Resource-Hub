'use strict';
/*
 * Browser ZIP -> independently verified, byte-exact candidate for a SEPARATE
 * disposable GitHub sandbox repository. SOURCE PREPARATION ONLY.
 *
 * The real original website and its full Git checkout are NEVER modified.
 * The physical 415-file source layout is staged only in OS-private folders,
 * independently checked against the original Git tree, and rolled back
 * BEFORE this method returns the candidate bytes to an injected test API.
 *
 * No remote adapter/token/network in this module; no CLI or browser export.
 * A successful candidate is NOT authorization to upload, save or publish.
 */
const fs=require('node:fs'),path=require('node:path');
const {withFullSiteRollback,read}=
  require('./rehearse-browser-zip-full-site-rollback.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {deriveIntent,gitBlobOid}=
  require('./rehearse-browser-zip-git-tree-intent.cjs');
const {checkedCandidate}=require('./stage-sandbox-git-objects.cjs');
const {ensureRepo}=require('./github-sandbox-api.cjs');
const {filePaths,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const FORMAT='naxx-original-browser-zip-to-sandbox-source-v1';
const SHA=/^[0-9a-f]{40}$/;
const MAX_ZIP=20*1024*1024;
async function prepareSandboxSource(checkout,zip,expectedCommit,targetRepository){
  ensureRepo(targetRepository);
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !Buffer.isBuffer(zip)||zip.length<22||zip.length>MAX_ZIP||
     !SHA.test(expectedCommit||''))
    throw Error('Exact source checkout, protected browser ZIP and pinned Git commit required.');
  const before=verifyCheckout(checkout,expectedCommit);
  let candidate=null;
  const result=await withFullSiteRollback(checkout,zip,expectedCommit,async view=>{
    view.verifyBackup();
    view.verifyStaged();
    const proof=deriveIntent(checkout,view.site,view.stage,
      view.trackedNames,view.changeSet,expectedCommit);
    const overlay=Array.from(filePaths());
    if(overlay.length!==COUNT+1||proof.newOverlayGitBlobs!==COUNT+1||
       proof.sourceLayoutOwnerApproved!==false||
       proof.originalGitBlobsVerified<1)
      throw Error('The physical original resource source did not verify.');
    const modes=new Map(proof.changedPaths.map(x=>[x.path,x.mode]));
    const names=[...overlay,...modes.keys()];
    if(new Set(names).size!==names.length||
       names.length!==COUNT+1+proof.changedExistingGitBlobs)
      throw Error('Reviewed source paths are incomplete or duplicated.');
    const files=names.map(relative=>{
      const bytes=read(view.site,relative);
      if(!bytes.equals(read(view.stage,relative)))
        throw Error('Prepared source bytes differ from the temporary verified stage.');
      return Object.freeze({
        path:relative,
        mode:modes.get(relative)||'100644',
        oid:gitBlobOid(bytes),
        bytes
      });
    });
    const proposal={
      targetRepository,expectedParent:expectedCommit,
      expectedBaseTree:proof.originalTreeOid,
      expectedNextTree:proof.proposedTreeOidCalculatedInMemory,
      proof,files
    };
    const validated=checkedCandidate(proposal);
    if(validated.files.length!==names.length||
       validated.changedTracked!==proof.changedExistingGitBlobs||
       validated.overlayFiles!==COUNT+1)
      throw Error('Complete source files did not match the reviewed Git proof.');
    candidate=proposal;
  });
  if(!candidate || result.privateRollbackExact!==true ||
     result.originalRepositoryCheckoutUnchanged!==true||
     result.allTemporarySiteCopiesDeleted!==true||
     result.completeSiteRuntimeHashMatched!==true ||
     result.customScriptsAssetsAndUnchangedPagesPreserved!==true ||
     result.originalRootLoaderByteExact!==true)
    throw Error('Original full-site rollback and preservation evidence was not verified.');
  const after=verifyCheckout(checkout,expectedCommit);
  if(before.fingerprintSha256!==after.fingerprintSha256)
    throw Error('Source Git checkout changed while preparing a sandbox candidate.');
  // Candidate bytes were read from a private temporary copy, and all temp
  // staged files were deleted before handing the bytes to the caller.
  return Object.freeze({
    format:FORMAT,
    candidate,
    originalSourceCommit:expectedCommit,
    originalSourceCheckoutPreserved:true,
    localTemporarySiteRolledBackAndDeleted:true,
    ownerHeldGitHistoryBackupPresent:false,
    canonical415SourceLayoutApproved:false,
    productionGitHubWriteAuthorized:false,
    canPublish:false
  });
}
module.exports=Object.freeze({FORMAT,prepareSandboxSource});

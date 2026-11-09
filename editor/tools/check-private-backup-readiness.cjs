'use strict';
/*
 * PRIVATE OWNER BACKUP READINESS — READ ONLY.
 *
 * Requires a clean, complete, ordinary Git checkout of the original 31 MB
 * Resource Hub website. It uses the SAME fail-closed Git and tracked-byte
 * checks as the verified owner backup creation/recovery tools. It does NOT
 * create a bundle, install software, contact GitHub, or print private paths.
 *
 * This preflight does not prove a retained/off-machine backup exists.
 */
const path=require('node:path');
const {baseline}=require('./rehearse-full-git-recovery.cjs');
const FORMAT='naxx-owner-git-backup-readiness-v1';
const COMMIT=/^[a-f0-9]{40,64}$/;
function checkBackupReadiness(checkout,{requireWebsite=true}={}){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout))
    throw Error('The local source must be an absolute checkout folder.');
  const checked=baseline(checkout,{requireWebsite});
  if(!COMMIT.test(checked.head)||!COMMIT.test(checked.tree)||
     !checked.trackedFiles.length||checked.snapshot.trackedFiles!==checked.trackedFiles.length||
     checked.refs.size<1)
    throw Error('Git source could not be verified completely.');
  // This report is SAFE to show locally: commit identity and boolean status
  // only, never the source path, ignored files, receipts, or Git credentials.
  return Object.freeze({
    format:FORMAT,
    sourceCommit:checked.head,
    sourceTreeVerified:true,
    cleanCompleteGitCheckout:true,
    fullFetchedHistoryPresent:true,
    originalWebsiteChecksumVerified:requireWebsite,
    trackedFileCount:checked.trackedFiles.length,
    privateBackupWritten:false,
    ownerHeldOffMachineCopyVerified:false,
    githubWrites:0,
    realSaveEnabled:false,
    publishEnabled:false
  });
}
if(require.main===module){
  try {
    if(process.argv.length!==3||process.argv[2]!=='--check')
      throw Error('Read-only website backup readiness requires --check.');
    process.stdout.write(JSON.stringify(
      checkBackupReadiness(path.resolve(__dirname,'..','..')),null,2)+'\n');
  }catch(_){
    // Never print private paths, git status, secrets or filenames.
    process.stderr.write(
      'Private website backup readiness refused. A full, clean Git checkout of the original source is required.\n');
    process.exitCode=1;
  }
}
module.exports=Object.freeze({FORMAT,checkBackupReadiness});

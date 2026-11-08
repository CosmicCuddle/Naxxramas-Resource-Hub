'use strict';
/*
 * RETAINED BACKUP READINESS CHECK — READ-ONLY FOR ALL EXISTING USER DATA.
 *
 * An operator-created Git bundle and its two private sidecars must exist
 * OUTSIDE the original clean Git checkout. Check exact checkout HEAD/tree,
 * fetched refs, protected tracked-file fingerprint, bundle SHA-256, original
 * receipt, recovery instructions, AND actually clone the saved bundle into
 * a new disposable private directory once again. Then remove the disposable
 * clone. Existing bundle, sidecars and source repository are never written.
 *
 * This checks an existing local copy; it does NOT prove the user holds an
 * off-machine copy, GitHub settings backup, live-server backup, or consent
 * to use the new 415-file source layout. It does not activate remote Save.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {baseline,verifyRecovery}=require('./rehearse-full-git-recovery.cjs');
const {verifyBackupBinding}=
  require('./rehearse-backup-bound-browser-review.cjs');
const FORMAT='naxx-existing-private-git-backup-verified-v1';
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function resolvedBackupPath(checkout,bundle) {
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     typeof bundle!=='string'||!path.isAbsolute(bundle)||
     path.extname(bundle)!=='.bundle')
    throw Error('A clean source checkout and absolute private Git bundle filename are required.');
  const root=fs.realpathSync(checkout),name=fs.realpathSync(bundle);
  const relative=path.relative(root,name);
  if(relative==='' || (relative!=='..'&&!relative.startsWith('..'+path.sep)&&
     !path.isAbsolute(relative)))
    throw Error('The retained Git backup cannot be inside the website repository.');
  const parent=fs.lstatSync(name);
  if(!parent.isFile()||parent.isSymbolicLink())
    throw Error('The retained backup must be a regular local file.');
  return name;
}
function verifyRetainedBackup(checkout,bundle,options={}) {
  // requireWebsite:false is reserved for synthetic fixtures/tests.
  const initial=baseline(checkout,options);
  const original=resolvedBackupPath(checkout,bundle);
  const receiptFile=original+'.receipt.json',noticeFile=original+'.READ_ME_FIRST.txt';
  // These files must be side by side. The existing binding check rejects
  // symlinks, world-readable bytes on Unix, forged receipts and bad warnings.
  const binding=verifyBackupBinding(original,initial.head,
    initial.snapshot.fingerprintSha256,initial.tree,
    initial.snapshot.trackedFiles);
  const initialDigests=[original,receiptFile,noticeFile].map(f=>sha(fs.readFileSync(f)));
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-retained-backup-check-'));
  fs.chmodSync(work,0o700);
  let outcome;
  try {
    const restore=verifyRecovery(checkout,original,work,initial);
    if(!restore.independentGitMirrorRestored||
       !restore.headMatches||!restore.treeMatches||
       !restore.trackedFilesMatch||!restore.trackedBytesMatch||
       restore.localFetchedRefsRestored!==initial.refs.size||
       restore.reachableCommitCount<1)
      throw Error('The physically retained Git bundle failed a fresh private restore.');
    const finalBinding=verifyBackupBinding(original,initial.head,
      initial.snapshot.fingerprintSha256,initial.tree,initial.snapshot.trackedFiles);
    if(finalBinding.fetchedRefCount!==binding.fetchedRefCount||
       [original,receiptFile,noticeFile].some((f,i)=>sha(fs.readFileSync(f))!==initialDigests[i]))
      throw Error('A retained bundle or recovery sidecar changed during verification.');
    // Re-run strict complete checkout checks after recovering, including
    // source files, fetched refs, exact commit/tree and zero local changes.
    const after=baseline(checkout,options);
    if(initial.head!==after.head||initial.tree!==after.tree||
       initial.snapshot.fingerprintSha256!==after.snapshot.fingerprintSha256||
       initial.refs.size!==after.refs.size||
       [...initial.refs].some(([ref,oid])=>after.refs.get(ref)!==oid))
      throw Error('Original website Git history changed during private backup recovery.');
    outcome=Object.freeze({
      format:FORMAT,verifiedOriginalCommit:initial.head,
      verifiedOriginalTree:initial.tree,
      verifiedTrackedFiles:initial.snapshot.trackedFiles,
      verifiedFetchedRefs:initial.refs.size,
      verifiedReachableCommits:restore.reachableCommitCount,
      exactGitCheckoutBound:true,
      existingBundleAndSidecarsIntact:true,
      restoredAgainFromExistingBundle:true,
      GitHistoryRecoveryVerified:true,
      localBundleReadOnly:true,originalCheckoutUnchanged:true,
      originalWebsiteWritten:false,githubWrites:0,
      ownerOffMachineCopyConfirmed:false,
      wholeServerOrGitHubSettingsBackup:false,
      sourceLayoutApproved:false,realSaveEnabled:false,
      publicationApproved:false
    });
  }finally {
    fs.rmSync(work,{recursive:true,force:true});
  }
  if(!outcome||fs.existsSync(work))
    throw Error('Backup recovery test did not clean up its private working area.');
  return outcome;
}
if(require.main===module) {
  try {
    const args=process.argv.slice(2);
    if(args.length!==2||args[0]!=='--backup')
      throw Error('Use --backup /absolute/private/name.bundle.');
    const output=verifyRetainedBackup(path.resolve(__dirname,'..','..'),args[1]);
    process.stdout.write(JSON.stringify(output,null,2)+'\n');
  } catch(_) {
    process.stderr.write('Retained Git backup verification refused or failed; no website changes were made.\n');
    process.exitCode=1;
  }
}
module.exports=Object.freeze({FORMAT,resolvedBackupPath,verifyRetainedBackup});

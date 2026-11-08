'use strict';
/*
 * LOCAL BACKUP -> DISPOSABLE SANDBOX BRANCH SEED REHEARSAL.
 *
 * Reads one EXISTING verified private Git-history bundle and reconstructs
 * the exact original source commit, ancestry, tree and tracked file bytes
 * in a NEW OS-private local bare repository under ONE test-only branch.
 *
 * Never opens a network socket, touches a GitHub repository, updates main,
 * alters an existing local repository, or retains copied history. The full
 * bundle remains owner-controlled; just the source HEAD ancestry is imported
 * into the test branch. It is NOT a remote import tool or authority to push.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {baseline,fingerprint}=require('./rehearse-full-git-recovery.cjs');
const {verifyRetainedBackup}=require('./verify-retained-backup.cjs');
const FORMAT='naxx-offline-verified-bundle-to-single-sandbox-branch-v1';
const SEED='refs/heads/editor-saves/original-seed';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function command(cwd,args,{binary=false}={}){
  const p=cp.spawnSync('git',args,{
    cwd,encoding:binary?null:'utf8',stdio:['ignore','pipe','pipe'],
    timeout:180000,maxBuffer:16*1024*1024
  });
  if(p.error||p.status!==0)throw Error('Local private Git seed rehearsal failed safely.');
  return p.stdout;
}
function readSnapshot(checkout,requireWebsite){
  const original=baseline(checkout,{requireWebsite});
  return original;
}
function verifyNoMainRef(repo){
  const all=command(repo,['for-each-ref','--format=%(refname)','refs/heads','refs/tags'])
    .trim().split('\n').filter(Boolean);
  if(all.length!==1||all[0]!==SEED)
    throw Error('The disposable private import must create exactly one editor-saves ref.');
  return all;
}
function rehearsePrivateSandboxSeed(checkout,bundle,options={}){
  if(!options||options.testOnly!==true||
     options.sourceLayoutApproved!==false||
     options.githubWritesApproved!==false||
     options.productionRepoWriteAllowed!==false||
     typeof checkout!=='string'||!path.isAbsolute(checkout)||
     typeof bundle!=='string'||!path.isAbsolute(bundle))
    throw Error('Explicit test-only local Git-history seed parameters required.');
  const requireWebsite=options.requireWebsite!==false;
  const original=readSnapshot(checkout,requireWebsite);
  const recovery=verifyRetainedBackup(checkout,bundle,{requireWebsite});
  if(recovery.verifiedOriginalCommit!==original.head||
     recovery.verifiedOriginalTree!==original.tree||
     recovery.existingBundleAndSidecarsIntact!==true||
     recovery.restoredAgainFromExistingBundle!==true||
     recovery.originalCheckoutUnchanged!==true)
    throw Error('A still-restorable bundle from the exact original Git source is required.');
  const evidence=sha(fs.readFileSync(bundle));
  const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-seed-'));
  fs.chmodSync(privateDir,0o700);
  let receipt;
  try{
    const repo=path.join(privateDir,'disposable.git');
    command(privateDir,['init','--bare','--quiet',repo]);
    // Import only HEAD and its ancestor objects. Do not mirror all refs,
    // expose old internal branches or import a main/tags branch.
    command(privateDir,['--git-dir='+repo,'fetch','--no-tags',bundle,'HEAD:'+SEED]);
    verifyNoMainRef(repo);
    const got=command(privateDir,['--git-dir='+repo,'rev-parse',SEED]).trim();
    const gotTree=command(privateDir,['--git-dir='+repo,'rev-parse',SEED+'^{tree}']).trim();
    if(got!==original.head||gotTree!==original.tree)
      throw Error('The offline test branch did not preserve the original Git commit and tree.');
    const expectedAncestry=Number(command(checkout,['rev-list','--count',original.head]).trim());
    const importedAncestry=Number(command(privateDir,[
      '--git-dir='+repo,'rev-list','--count',SEED
    ]).trim());
    if(!Number.isInteger(expectedAncestry)||expectedAncestry<1||
       expectedAncestry!==importedAncestry)
      throw Error('The imported branch has incomplete original commit ancestry.');
    const restore=path.join(privateDir,'restored-working');
    command(privateDir,['clone','--quiet','--no-checkout',repo,restore]);
    command(restore,['checkout','--quiet','--detach',original.head]);
    const paths=original.trackedFiles;
    const recovered=fingerprint(restore,paths);
    if(recovered.fingerprintSha256!==original.snapshot.fingerprintSha256||
       recovered.trackedFiles!==original.snapshot.trackedFiles||
       recovered.trackedBytes!==original.snapshot.trackedBytes)
      throw Error('Private import did not preserve the original tracked source bytes.');
    if(sha(fs.readFileSync(bundle))!==evidence)
      throw Error('The retained owner backup changed during branch seed rehearsal.');
    receipt=Object.freeze({
      format:FORMAT,
      originalCommitVerified:got,
      originalTreeVerified:gotTree,
      importedAncestorCommits:importedAncestry,
      originalTrackedFilesVerified:recovered.trackedFiles,
      originalTrackedSourceFingerprintMatched:true,
      onlyEditorSavesTestRefCreated:true,
      noMainOrTagRefCreated:true,
      originalWebsiteUnmodified:true,
      backupLeftIntact:true,
      fullFetchedRefsStayedInPrivateBundle:true,
      noNetworkRequestMade:true,
      realGitHubWrites:0,
      ownerOffMachineBackupConfirmed:false,
      originalSiteSourceLayoutApproved:false,
      realSandboxGitHubImportAuthorized:false,
      publishEnabled:false
    });
  }finally{
    fs.rmSync(privateDir,{recursive:true,force:true});
  }
  if(!receipt||fs.existsSync(privateDir))
    throw Error('Private Git import rehearsal did not delete its temporary repository.');
  const after=readSnapshot(checkout,requireWebsite);
  if(after.head!==original.head||after.tree!==original.tree||
     after.snapshot.fingerprintSha256!==original.snapshot.fingerprintSha256||
     after.refs.size!==original.refs.size||
     [...original.refs].some(([ref,oid])=>after.refs.get(ref)!==oid))
    throw Error('Original Git checkout changed during private branch seed rehearsal.');
  return receipt;
}
module.exports=Object.freeze({FORMAT,SEED,rehearsePrivateSandboxSeed});

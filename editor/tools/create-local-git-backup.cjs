'use strict';
/*
 * OPTIONAL OFFLINE BUNDLE CREATOR. Nothing is written unless the operator
 * explicitly passes --output /absolute/private/name.bundle. Source code,
 * history and old commits may contain confidential data. Never publish.
 *
 * The bundle plus two private sidecars protect the current clean tracked
 * Git checkout and all LOCALLY FETCHED reachable refs/history. GitHub
 * project settings, issues, secrets, Pages, LFS, untracked files and remote
 * history not fetched are outside its scope. No server deployment actions.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {baseline,verifyRecovery}=require('./rehearse-full-git-recovery.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function command(root,args){
  const p=cp.spawnSync('git',args,{
    cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],
    timeout:180000,maxBuffer:3*1024*1024
  });
  if(p.error||p.status!==0)throw Error('Private Git bundle operation failed.');
}
function safeOutput(output,checkout){
  if(typeof output!=='string'||!path.isAbsolute(output)||
     !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,160}\.bundle$/i.test(path.basename(output)))
    throw Error('An absolute private .bundle filename is required.');
  const parent=fs.realpathSync(path.dirname(output));
  const source=fs.realpathSync(checkout);
  const rel=path.relative(source,parent);
  if(!rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))
    throw Error('Backup output must be outside the Git repository.');
  const bundle=path.join(parent,path.basename(output));
  const names=[bundle,bundle+'.receipt.json',bundle+'.READ_ME_FIRST.txt'];
  for(const name of names){
    try{fs.lstatSync(name);throw Error('Backup output or receipt already exists; never overwrite.');}
    catch(err){if(err.code!=='ENOENT')throw err;}
  }
  return names;
}
function createExclusive(file,bytes){
  let fd=null,created=false;
  try{
    fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_EXCL|
      fs.constants.O_WRONLY,0o600);
    created=true;
    let offset=0;
    while(offset<bytes.length){
      const written=fs.writeSync(fd,bytes,offset,Math.min(1024*1024,bytes.length-offset));
      if(written<=0)throw Error('Private backup write did not complete.');
      offset+=written;
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd);fd=null;
    if(!fs.readFileSync(file).equals(bytes))
      throw Error('Private backup contents differ after writing.');
  }catch(error){
    if(fd!==null){try{fs.closeSync(fd);}catch(_){}}
    if(created)fs.rmSync(file,{force:true});
    throw error;
  }
}
function instructions(receipt){
  return [
    'NAXXRAMAS — PRIVATE FETCHED-GIT-HISTORY BACKUP',
    '',
    'KEEP THIS .bundle AND BOTH SIDECARS PRIVATE AND OFFLINE.',
    'THE GIT HISTORY MAY CONTAIN SENSITIVE DATA FROM EARLIER COMMITS.',
    'DO NOT COMMIT, UPLOAD TO A PUBLIC HOST, OR INCLUDE IN GITHUB ACTIONS.',
    '',
    'THIS IS NOT A WHOLE-SERVER OR GITHUB-SERVICE BACKUP.',
    'Excluded: unpublished/unfetched remote refs, GitHub issues/settings,',
    'GitHub Pages/deployment settings, Actions secrets, external services,',
    'Git LFS objects, ignored/untracked files and reflog-only objects.',
    '',
    'Original commit: '+receipt.sourceCommit,
    'Original tree: '+receipt.sourceTree,
    'Bundle SHA-256: '+receipt.bundleSha256,
    'Bundle size in bytes: '+receipt.bundleBytes,
    '',
    'MANUAL RECOVERY (in a private disposable folder, not your live site):',
    '1. Keep the bundle filename together with this receipt.',
    '2. Verify the bundle SHA-256 against the receipt using a trusted hasher.',
    '3. Run: git clone --mirror "/path/to/backup.bundle" "recovered.git"',
    '4. Run: git clone "recovered.git" "recovered-working"',
    '5. Run: git -C "recovered-working" checkout --detach '+receipt.sourceCommit,
    '6. Independently compare restored file content and test visitor/admin pages.',
    '7. Obtain CosmicCuddle approval before any replacement or deployment.',
    '',
    'No private website connection IPs should be shared through public channels.',
    ''
  ].join('\n');
}
function saveBackup(root,output,options={}){
  const source=baseline(root,options);
  const [name,receiptName,noticeName]=safeOutput(output,root);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-save-git-'));
  fs.chmodSync(temp,0o700);
  const created=[];
  try{
    const sourceBundle=path.join(temp,'source.bundle');
    command(root,['bundle','create',sourceBundle,'--all','HEAD']);
    const verified=verifyRecovery(root,sourceBundle,temp,source);
    const bytes=fs.readFileSync(sourceBundle);
    if(bytes.length<32)throw Error('The Git bundle is empty.');
    const receipt={
      format:'naxx-private-fetched-git-recovery-v1',
      containsPrivateSourceHistory:true,publishable:false,
      fullServerBackup:false,githubSettingsIncluded:false,
      localFetchedRefsOnly:true,
      sourceCommit:source.head,sourceTree:source.tree,
      trackedFiles:source.snapshot.trackedFiles,
      trackedBytes:source.snapshot.trackedBytes,
      trackedSha256:source.snapshot.fingerprintSha256,
      fetchedRefs:[...source.refs].map(([ref,id])=>({ref,id})).sort((a,b)=>a.ref.localeCompare(b.ref)),
      reachableCommits:verified.reachableCommitCount,
      bundleBytes:bytes.length,bundleSha256:sha(bytes),
      independentRestoreVerified:true,
      exclusions:'No never-fetched remote refs, GitHub settings/secrets, external providers, LFS objects, untracked/ignored files or reflog-only objects.'
    };
    createExclusive(name,bytes);created.push(name);
    // Validate the final file, not just a temporary copy.
    if(sha(fs.readFileSync(name))!==receipt.bundleSha256)
      throw Error('Saved Git bundle checksum differs.');
    const second=path.join(temp,'saved-copy-verification');
    fs.mkdirSync(second,{mode:0o700});
    const rechecked=verifyRecovery(root,name,second,source);
    if(!rechecked.trackedFilesMatch||!rechecked.treeMatches)
      throw Error('The saved bundle did not independently restore.');
    createExclusive(receiptName,Buffer.from(JSON.stringify(receipt,null,2)+'\n'));created.push(receiptName);
    createExclusive(noticeName,Buffer.from(instructions(receipt)));created.push(noticeName);
    return {
      format:receipt.format,
      bundleAndTwoSidecarsCreated:true,
      sourceCommit:source.head,sourceTree:source.tree,
      trackedFiles:receipt.trackedFiles,
      trackedBytes:receipt.trackedBytes,
      reachableCommits:receipt.reachableCommits,
      localFetchedRefs:receipt.fetchedRefs.length,
      bundleBytes:receipt.bundleBytes,bundleSha256:receipt.bundleSha256,
      independentlyRecoveredTwice:true,
      githubWritten:false,serverModified:false,
      completeServerBackup:false
    };
  }catch(error){
    for(const file of created)fs.rmSync(file,{force:true});
    throw error;
  }finally{
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
if(require.main===module){
  const args=process.argv.slice(2);
  try{
    if(args.length!==2||args[0]!=='--output')
      throw Error('Usage: node editor/tools/create-local-git-backup.cjs --output /private/location/name.bundle');
    const report=saveBackup(path.resolve(__dirname,'..','..'),args[1]);
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }catch(_){
    process.stderr.write('Private Git backup was not saved. Use a complete clean checkout and a new absolute private path outside the repository.\n');
    process.exitCode=1;
  }
}
module.exports={safeOutput,saveBackup,instructions};

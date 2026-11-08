'use strict';
/*
 * RESEARCH: Independently RECHECK an EXISTING private .bundle, receipt and
 * recovery warning against separately supplied expected Git identities.
 *
 * Never creates/overwrites a backup, alters source refs, or authorizes Save.
 * The restoration happens only inside a disposable 0700 OS temp folder.
 * Existence now is NOT owner-controlled durable retention or remote identity.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {baseline,verifyRecovery}=require('./rehearse-full-git-recovery.cjs');
const {instructions}=require('./create-local-git-backup.cjs');
const HEX=/^[a-f0-9]{40}$|^[a-f0-9]{64}$/;
const SHA=/^[a-f0-9]{64}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const MAX_BUNDLE_BYTES=512*1024*1024;
const MAX_RECEIPT_BYTES=256*1024;
const MAX_NOTICE_BYTES=64*1024;
const FORMAT='naxx-private-existing-bundle-read-only-recheck-v1';
function exactKeys(object,fields){
  return !!object&&typeof object==='object'&&!Array.isArray(object)&&
    Object.keys(object).sort().join(',')===fields.slice().sort().join(',');
}
function fileBytes(name,max){
  const stat=fs.lstatSync(name);
  if(!stat.isFile()||stat.isSymbolicLink()||
     stat.size<1||stat.size>max)
    throw Error('Missing, unsafe or oversized saved recovery file.');
  if(process.platform!=='win32'&&(stat.mode&0o077)!==0)
    throw Error('A private saved recovery file has unsafe permissions.');
  const data=fs.readFileSync(name);
  if(data.length!==stat.size)
    throw Error('A saved recovery file changed during inspection.');
  return data;
}
function approvePath(repo,bundle){
  if(typeof bundle!=='string'||!path.isAbsolute(bundle)||
     !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,160}\.bundle$/i.test(path.basename(bundle)))
    throw Error('An existing absolute private .bundle path is required.');
  const parent=fs.realpathSync(path.dirname(bundle));
  const root=fs.realpathSync(repo);
  const rel=path.relative(root,parent);
  if(!rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))
    throw Error('Saved recovery files must be outside the source checkout.');
  if(fs.realpathSync(bundle)!==path.join(parent,path.basename(bundle)))
    throw Error('Saved recovery bundle may not follow a symlink.');
  return [bundle,bundle+'.receipt.json',bundle+'.READ_ME_FIRST.txt'];
}
function validateReceipt(receipt,source,bundleBytes,pins){
  const fields=[
    'format','containsPrivateSourceHistory','publishable','fullServerBackup',
    'githubSettingsIncluded','localFetchedRefsOnly','sourceCommit','sourceTree',
    'trackedFiles','trackedBytes','trackedSha256','fetchedRefs',
    'reachableCommits','bundleBytes','bundleSha256',
    'independentRestoreVerified','exclusions'
  ];
  if(!exactKeys(receipt,fields)||
     receipt.format!=='naxx-private-fetched-git-recovery-v1'||
     receipt.containsPrivateSourceHistory!==true||
     receipt.publishable!==false||
     receipt.fullServerBackup!==false||
     receipt.githubSettingsIncluded!==false||
     receipt.localFetchedRefsOnly!==true||
     receipt.sourceCommit!==source.head||
     receipt.sourceTree!==source.tree||
     receipt.trackedFiles!==source.snapshot.trackedFiles||
     receipt.trackedBytes!==source.snapshot.trackedBytes||
     receipt.trackedSha256!==source.snapshot.fingerprintSha256||
     receipt.independentRestoreVerified!==true||
     !Number.isSafeInteger(receipt.reachableCommits)||
     receipt.reachableCommits<1||
     receipt.bundleBytes!==bundleBytes.length||
     receipt.bundleSha256!==sha(bundleBytes)||
     receipt.bundleSha256!==pins.expectedBundleSha256||
     typeof receipt.exclusions!=='string'||
     !receipt.exclusions.includes('untracked/ignored')||
     !Array.isArray(receipt.fetchedRefs)||
     receipt.fetchedRefs.length!==source.refs.size)
    throw Error('Saved recovery receipt disagrees with pinned source and bundle bytes.');
  const expected=[...source.refs].map(([ref,id])=>({ref,id}))
    .sort((a,b)=>a.ref.localeCompare(b.ref));
  for(let i=0;i<expected.length;i++){
    if(!exactKeys(receipt.fetchedRefs[i],['ref','id'])||
       receipt.fetchedRefs[i].ref!==expected[i].ref||
       receipt.fetchedRefs[i].id!==expected[i].id)
      throw Error('Saved Git ref receipt differs from the independently pinned source.');
  }
}
function mirrorRefsMatch(temp,expected){
  // verifyRecovery has already cloned the bundle to this disposable mirror.
  // Recheck exact restored ref SET, not just preservation of expected refs.
  const mirror=path.join(temp,'mirror.git');
  const git=cp.spawnSync('git',['-C',mirror,'for-each-ref',
    '--format=%(refname)%00%(objectname)',
    'refs/heads','refs/tags','refs/remotes'],{
    encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,
    stdio:['ignore','pipe','pipe']
  });
  if(git.error||git.status!==0)
    throw Error('Recovered Git ref inventory was unavailable.');
  const rows=git.stdout.trim().split('\n').filter(Boolean);
  const actual=new Map();
  for(const entry of rows){
    const parts=entry.split('\0');
    if(parts.length!==2||actual.has(parts[0])||
       !/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(parts[1]))
      throw Error('Recovered Git ref inventory has invalid or duplicated entries.');
    actual.set(parts[0],parts[1]);
  }
  if(actual.size!==expected.size||
     [...expected].some(([ref,id])=>actual.get(ref)!==id))
    throw Error('Recovered Git bundle contains missing, unexpected or changed refs.');
}
function inspectSavedBackup(repo,bundle,pins,options={}){
  if(!exactKeys(pins,[
    'expectedCommit','expectedTree','expectedTrackedSha256','expectedBundleSha256'
  ])||!HEX.test(pins.expectedCommit)||!HEX.test(pins.expectedTree)||
     !SHA.test(pins.expectedTrackedSha256)||
     !SHA.test(pins.expectedBundleSha256))
    throw Error('Independently supplied original Git and saved-bundle pins are required.');
  const source=baseline(repo,options);
  if(source.head!==pins.expectedCommit||
     source.tree!==pins.expectedTree||
     source.snapshot.fingerprintSha256!==pins.expectedTrackedSha256)
    throw Error('The independently pinned Git checkout no longer matches.');
  const [archive,receiptName,noticeName]=approvePath(repo,bundle);
  const bundleBytes=fileBytes(archive,MAX_BUNDLE_BYTES);
  const receiptText=fileBytes(receiptName,MAX_RECEIPT_BYTES).toString('utf8');
  const noticeText=fileBytes(noticeName,MAX_NOTICE_BYTES).toString('utf8');
  let receipt;
  try{receipt=JSON.parse(receiptText);}
  catch(_){throw Error('Private saved recovery receipt is not valid JSON.');}
  validateReceipt(receipt,source,bundleBytes,pins);
  if(noticeText!==instructions(receipt))
    throw Error('Saved recovery instructions differ from the expected private notice.');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-existing-bundle-check-'));
  fs.chmodSync(temporary,0o700);
  let result;
  try{
    result=verifyRecovery(repo,archive,temporary,source);
    mirrorRefsMatch(temporary,source.refs);
    if(result.independentGitMirrorRestored!==true||
       result.headMatches!==true||result.treeMatches!==true||
       result.trackedFilesMatch!==true||result.trackedBytesMatch!==true||
       result.localFetchedRefsRestored!==source.refs.size||
       result.recoveredCheckoutSha256!==source.snapshot.fingerprintSha256||
       result.reachableCommitCount!==receipt.reachableCommits)
      throw Error('An existing private backup could not restore complete pinned history and bytes.');
  }finally{
    fs.rmSync(temporary,{recursive:true,force:true});
  }
  // Confirm both source checkout and saved files were unchanged while
  // restoring a private disposable copy. No remote or owner-access proof.
  const after=baseline(repo,options);
  if(after.head!==source.head||after.tree!==source.tree||
     after.snapshot.fingerprintSha256!==source.snapshot.fingerprintSha256||
     after.refs.size!==source.refs.size||
     [...source.refs].some(([ref,id])=>after.refs.get(ref)!==id)||
     sha(fileBytes(archive,MAX_BUNDLE_BYTES))!==pins.expectedBundleSha256||
     sha(fileBytes(receiptName,MAX_RECEIPT_BYTES))!==sha(Buffer.from(receiptText))||
     sha(fileBytes(noticeName,MAX_NOTICE_BYTES))!==sha(Buffer.from(noticeText)))
    throw Error('Source or saved recovery package changed during inspection.');
  return Object.freeze({
    format:FORMAT,readOnlyOnSourceAndBackup:true,
    independentlyPinnedLocalCheckout:true,
    sourceCommit:source.head,sourceTree:source.tree,
    sourceTrackedSha256:source.snapshot.fingerprintSha256,
    savedBundleSha256:pins.expectedBundleSha256,
    trackedFilesVerified:source.snapshot.trackedFiles,
    fetchedRefsVerified:source.refs.size,
    reachableCommitsVerified:result.reachableCommitCount,
    savedBundleFilesPresentAtCheck:true,
    existingBundleRestoredInDisposableCheckout:true,
    locallyFetchedGitHistoryAndTrackedFilesMatched:true,
    temporaryRestorationDeleted:true,
    externallyAuthenticatedGitHubSource:false,
    durableOwnerRetentionIndependentlyProven:false,
    externalServicesBackedUp:false,
    sourceLayoutApproved:false,ownerApproved:false,
    canSave:false,canApply:false,canPush:false,canMerge:false,
    canPublish:false,gitHubWrites:0,sourceFilesWritten:0
  });
}
module.exports=Object.freeze({FORMAT,inspectSavedBackup});

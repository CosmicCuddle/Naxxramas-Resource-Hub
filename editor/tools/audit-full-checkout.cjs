'use strict';
/*
 * Read-only checkout inventory preflight for future repository backup.
 * This does NOT generate a backup, ZIP, commit, branch or GitHub write.
 * Git-tracked files only; untracked files, .git history, submodules, and
 * connected service state require separate recovery procedures.
 * Reports counts/hashes, never private content or individual file names.
 */
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const EXPECTED_SITE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function safeRel(rel){
  return typeof rel==='string'&&rel.length>0&&!rel.startsWith('/')&&
    !rel.includes('\\')&&!rel.includes('\0')&&
    !rel.split('/').some(x=>x===''||x==='.'||x==='..')&&
    rel!=='.git'&&!rel.startsWith('.git/');
}
function inventory(root,files){
  if(!path.isAbsolute(root)||!Array.isArray(files)||files.length===0)
    throw Error('Expected an absolute checkout and nonempty tracked-file list.');
  const sorted=files.slice().sort();
  let total=0,original=0;
  const records=[],seen=new Set();
  for(const rel of sorted){
    if(!safeRel(rel)||seen.has(rel.toLowerCase()))
      throw Error('Unsafe or duplicate tracked-file pathname.');
    seen.add(rel.toLowerCase());
    const full=path.join(root,...rel.split('/'));
    const stat=fs.lstatSync(full);
    if(!stat.isFile()||stat.isSymbolicLink())
      throw Error('Tracked path is missing or not a regular file.');
    const bytes=fs.readFileSync(full),digest=sha(bytes);
    total+=bytes.length;
    records.push(Buffer.from(JSON.stringify([rel,bytes.length,digest])+'\n'));
    if(rel==='site-content.html'){
      original++;
      if(digest!==EXPECTED_SITE)
        throw Error('Original site-content.html differs from the protected source baseline.');
    }
  }
  if(original!==1)throw Error('Complete tracked snapshot must contain the original website source.');
  if(!sorted.includes('index.html'))
    throw Error('Root website loader is missing from tracked snapshot.');
  return {
    format:'naxx-tracked-repository-inventory-preflight-v1',
    completeTrackedListInspected:true,
    sourceCodeExecuted:false,
    backedUp:false,
    trackedFiles:sorted.length,trackedBytes:total,
    fingerprintSha256:sha(Buffer.concat(records)),
    originalSiteSourceVerified:true,
    trackedNamesOrContentPrinted:false,
    exclusions:'This is not a backup. Git history, untracked/ignored files, submodules, connected apps and external service state are not captured.'
  };
}
function git(root,args){
  return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024,stdio:['ignore','pipe','pipe']});
}
function inspectCheckout(root){
  const top=git(root,['rev-parse','--show-toplevel']).trim();
  if(path.resolve(top)!==path.resolve(root))
    throw Error('Expected the exact root of the checked-out repository.');
  const head=git(root,['rev-parse','HEAD']).trim();
  if(!/^[a-f0-9]{40,64}$/.test(head))throw Error('Git commit identity is invalid.');
  // Does not try to back up local dirty changes; they need a separate approval.
  const dirty=cp.spawnSync('git',['diff','--quiet','HEAD','--'],{
    cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']
  });
  if(dirty.status!==0)throw Error('Tracked checkout differs from its current commit.');
  const tracked=git(root,['ls-files','-z']).split('\0').filter(Boolean);
  const result=inventory(root,tracked);
  return {
    ...result,verifiedCommit:head,checkoutMatchesCommittedTrackedFiles:true,
    gitHistoryBackedUp:false,archiveGenerated:false,
    releaseAuthorised:false
  };
}
if(require.main===module){
  try{
    process.stdout.write(JSON.stringify(inspectCheckout(path.resolve(__dirname,'..','..')),null,2)+'\n');
  }catch(_){
    process.stderr.write('Whole-checkout preflight stopped safely; no source details printed.\n');
    process.exitCode=1;
  }
}
module.exports={inventory,inspectCheckout,safeRel};

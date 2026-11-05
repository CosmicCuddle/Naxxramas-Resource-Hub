'use strict';
/*
 * Mixed editor update rehearsal: edits real page/navigation file SHAPES only
 * inside a disposable private temp folder; resource tree verified separately.
 * The complete current Git repository is checked before and after.
 * No new source tree, generated website, source ZIP, Git commit or deployment.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {planMixed,verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {PAGES,NAV,plan:pagePlan}=require('./plan-page-draft.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FILES=[...PAGES,NAV];
function checkedFile(root,relative){
  if(!FILES.includes(relative))throw Error('Unexpected private page sandbox path.');
  const file=path.join(root,...relative.split('/'));
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())
    throw Error('Private page sandbox file is missing or not regular.');
  return file;
}
function writeChecked(root,relative,bytes){
  if(!Buffer.isBuffer(bytes))throw Error('Page edits must be verified UTF-8 bytes.');
  const name=checkedFile(root,relative);
  fs.writeFileSync(name,bytes,{flag:'w'});
}
async function rehearseMixed(root,drafts){
  const verified=await planMixed(root,drafts);
  const originalCheckoutCommit=verified.commit;
  const pages=drafts.pages?pagePlan(root,drafts.pages):null;
  const source=new Map();
  for(const relative of FILES){
    const target=path.join(root,...relative.split('/'));
    const stat=fs.lstatSync(target);
    if(!stat.isFile()||stat.isSymbolicLink())
      throw Error('Source path is not a regular file.');
    source.set(relative,fs.readFileSync(target));
  }
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-mixed-pages-test-'));
  fs.chmodSync(directory,0o700);
  const created=directory;
  let result;
  try{
    for(const [relative,bytes] of source){
      const name=path.join(directory,...relative.split('/'));
      fs.mkdirSync(path.dirname(name),{recursive:true,mode:0o700});
      fs.writeFileSync(name,bytes,{flag:'wx',mode:0o600});
    }
    const delta=new Map((pages?.changed||[]).map(item=>[item.path,item]));
    for(const [relative,change] of delta){
      if(sha(source.get(relative))!==change.sourceSha256)
        throw Error('Page source hash differs before staging.');
      writeChecked(directory,relative,change.bytes);
    }
    let staged=0,untouched=0;
    for(const [relative,before] of source){
      const changed=delta.get(relative),actual=fs.readFileSync(checkedFile(directory,relative));
      if(changed){
        if(!actual.equals(changed.bytes)||sha(actual)!==changed.nextSha256)
          throw Error('Staged page bytes do not match the intended edit.');
        staged++;
      }else{
        if(!actual.equals(before))throw Error('Unchanged page was modified.');
        untouched++;
      }
    }
    // Roll back ALL actual page and navigation bytes in the private folder.
    for(const [relative,bytes] of source)writeChecked(directory,relative,bytes);
    for(const [relative,bytes] of source){
      if(!fs.readFileSync(checkedFile(directory,relative)).equals(bytes))
        throw Error('Page rollback did not recover exact source bytes.');
    }
    result={
      format:'naxx-private-mixed-git-preflight-v1',
      pagesStaged:staged,pagesUntouched:untouched,
      existingPageFilesVerified:5,
      existingPageRollbackExact:true,
      candidateResourcesVerified:verified.changedCandidateResourcePaths.length,
      candidateResourceSourceRebuilt:verified.resourceRebuildExact,
      candidateResourceRollbackExact:verified.resourceRollbackExact,
      checkoutCommit:verified.commit,
      combinedReport:verified,
      privateOnly:true,githubReady:false,deployable:false,
      liveFilesWritten:0,rootLoaderChanged:false,generatedWebsiteChanged:false
    };
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
  if(fs.existsSync(created))throw Error('Private mixed test folder was not removed.');
  const after=verifyCheckout(root,originalCheckoutCommit);
  if(after.fingerprintSha256!==verified.checkedOutSourceFingerprint)
    throw Error('Git checkout fingerprint changed during private mixed rehearsal.');
  result.privateFolderDeleted=true;
  result.originalCheckoutUnchanged=true;
  return result;
}
if(require.main===module){
  process.stderr.write('Mixed dry-run is a private library. It cannot deploy or commit website files.\n');
}
module.exports={rehearseMixed};

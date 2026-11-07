'use strict';
/*
 * Private GitHub runner proof for the actual, fetched Git history.
 * Calls explicit local backup command only inside a newly created OS temp
 * directory. Reads receipt and ZIP-like recovery instructions, then deletes
 * the entire temporary backup. NEVER uploads artifacts or pushes Git refs.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {saveBackup}=require('./create-local-git-backup.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function run(){
  const root=path.resolve(__dirname,'..','..');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-full-history-save-test-'));
  fs.chmodSync(temp,0o700);
  try{
    const target=path.join(temp,'private-complete-git-history.bundle');
    const report=saveBackup(root,target);
    const expected=[
      target,target+'.receipt.json',target+'.READ_ME_FIRST.txt'
    ];
    if(!expected.every(file=>fs.existsSync(file)))
      throw Error('A verified private recovery file is missing.');
    const receipt=JSON.parse(fs.readFileSync(expected[1],'utf8'));
    const warning=fs.readFileSync(expected[2],'utf8');
    if(report.bundleAndTwoSidecarsCreated!==true||
       report.independentlyRecoveredTwice!==true||
       receipt.sourceCommit!==report.sourceCommit||
       receipt.sourceTree!==report.sourceTree||
       receipt.bundleSha256!==sha(fs.readFileSync(target))||
       receipt.fetchedRefs.length!==report.localFetchedRefs||
       !warning.includes('THIS IS NOT A WHOLE-SERVER OR GITHUB-SERVICE BACKUP.')||
       !warning.includes('KEEP THIS .bundle AND BOTH SIDECARS PRIVATE AND OFFLINE.'))
      throw Error('Private saved bundle, receipt or warning failed verification.');
    for(const file of expected){
      if(process.platform!=='win32'&&(fs.statSync(file).mode&0o077)!==0)
        throw Error('A saved backup file allows unintended file-system access.');
    }
    return {
      format:'naxx-temporary-saved-git-backup-rehearsal-v1',
      trackedFiles:report.trackedFiles,
      fetchedRefs:report.localFetchedRefs,
      reachableCommits:report.reachableCommits,
      bundleBytes:report.bundleBytes,
      restoredAndVerifiedTwice:true,
      savedBundleAndReceiptVerified:true,
      publicUpload:false,
      privateTemporaryOnly:true
    };
  }finally{
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
if(require.main===module){
  try{process.stdout.write(JSON.stringify(run(),null,2)+'\n');}
  catch(_){
    process.stderr.write('Full-history private backup save/restore rehearsal failed safely.\n');
    process.exitCode=1;
  }
}
module.exports={run};

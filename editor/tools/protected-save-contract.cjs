'use strict';
/*
 * Protected development-branch Save HTTP contract.
 * Validates explicit, independently supplied permission/capability and
 * server-verified Save receipts. Nothing here can access GitHub or write files.
 *
 * IMPORTANT: A caller must still implement a real authenticated, scoped
 * GitHub writer and independently verify the pre-existing owner backup.
 * No production writer is instantiated by the normal local companion CLI.
 */
const REPOSITORY='CosmicCuddle/Naxxramas-Resource-Hub';
const SHA=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const BRANCH=/^editor-saves\/[a-z0-9][a-z0-9._/-]{0,100}$/;
function safeBranch(value){
  return typeof value==='string'&&BRANCH.test(value)&&
    value.length<=114&&!value.includes('..')&&!value.includes('//')&&
    !value.endsWith('.')&&!value.endsWith('/')&&
    !value.split('/').some(x=>x.endsWith('.lock'));
}
function checkedSetup(setup){
  if(!setup||typeof setup!=='object'||Array.isArray(setup)||
     setup.repository!==REPOSITORY||!safeBranch(setup.branch)||
     !SHA.test(setup.expectedHead||'')||
     setup.publishDisabled!==true||
     setup.ownerApprovedDevelopmentBranchSave!==true||
     setup.independentlyRestoredOwnerBackup===undefined||
     setup.independentlyRestoredOwnerBackup!==true||
     setup.authenticatedScopedWriter!==true||
     setup.exactOldHeadEnforced!==true||
     typeof setup.write!=='function')
    throw Error('Real Save requires an explicitly approved, source-protected development branch writer.');
  return Object.freeze({repository:REPOSITORY,branch:setup.branch,
    expectedHead:setup.expectedHead,publishDisabled:true,writer:setup.write});
}
function checkedReceipt(receipt,setup){
  if(!receipt||receipt.format!=='naxx-editor-local-save-result-v1'||
     receipt.result!=='saved-and-independently-verified'||
     receipt.repository!==setup.repository||
     receipt.branch!==setup.branch||
     receipt.parentCommit!==setup.expectedHead||
     !SHA.test(receipt.commit||'')||receipt.commit===setup.expectedHead||
     !SHA256.test(receipt.fullSiteSha256||'')||
     receipt.remoteRefVerified!==true||
     receipt.sourceFilesVerified!==true||
     receipt.backupVerified!==true||
     receipt.published!==false)
    throw Error('The GitHub development-branch Save result was not independently verified.');
  return Object.freeze({
    format:'naxx-editor-local-save-result-v1',
    result:'saved-and-independently-verified',
    repository:setup.repository,
    branch:setup.branch,
    parentCommit:setup.expectedHead,
    commit:receipt.commit,
    fullSiteSha256:receipt.fullSiteSha256,
    remoteRefVerified:true,sourceFilesVerified:true,
    backupVerified:true,published:false
  });
}
module.exports=Object.freeze({REPOSITORY,safeBranch,checkedSetup,checkedReceipt});

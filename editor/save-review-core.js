/* NAXX PRIVATE FILE-CHANGE REVIEW — metadata-only, read-only.
 * Accepts only a versioned source manifest and the previous verified,
 * checksum-only dry-run review receipt. The JSON fields are untrusted claims,
 * NOT authentication of real source files or permission to save/publish.
 */
(function(root,factory){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const core=factory(node?require('./restore-preflight-core.js'):root.NaxxRestorePreflight);
  if(node)module.exports=core;
  else root.NaxxSaveReviewCore=core;
})(typeof globalThis==='object'?globalThis:this,function(preflight){
  'use strict';
  if(!preflight||typeof preflight.validManifest!=='function')
    throw Error('Original version metadata checker is missing.');
  const FORMAT='naxx-private-github-changeset-review-v1';
  const RUNTIME='site-content.html';
  const MANIFEST='content/resource-overlays/manifest.json';
  const MAX_MANIFEST_BYTES=262144,MAX_RECEIPT_BYTES=262144;
  const MAX_RESOURCE_BYTES=1000000,MAX_SITE_BYTES=45*1024*1024;
  const HASH=/^[0-9a-f]{64}$/;
  const REQUIRED_RECEIPT=[
    'format','reviewOnly','approved','githubReady','releaseBuilderAvailable',
    'canonicalLayoutApproved','originalNonResourceShellPreserved',
    'liveWebsiteUnchanged','currentRevision','proposedRevision',
    'originalBaselineSha256','expectedCurrentSourceSha256',
    'proposedFullSiteSha256','sourceBytesBefore','sourceBytesAfter',
    'physicallyVerifiedResources','physicalSourceFiles','editedResourceCount',
    'unchangedResourceCount','proposedPaths','proposedFileCount',
    'trustedGitCommitChecked','privateGitRecoveryBackupVerified',
    'realAdminWriteFlowVerified','newSourceBytesIncluded','canApply',
    'canMerge','canPublish','repoFilesWritten','gitActionsTaken'
  ];
  const FILE_KEYS=[
    'path','kind','expectedOldSha256','proposedNewSha256','oldBytes','newBytes'
  ];
  function sameKeys(value,keys){
    return !!value&&typeof value==='object'&&!Array.isArray(value)&&
      Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
  }
  function size(value,max){
    return Number.isSafeInteger(value)&&value>0&&value<=max;
  }
  function labelFor(p){
    if(p===RUNTIME)return 'Generated complete website';
    if(p===MANIFEST)return 'Resource version manifest';
    const found=/^content\/resource-overlays\/resources\/([0-9]{4})\.fragment$/.exec(p);
    if(!found)return null;
    const number=Number(found[1]);
    if(number<1||number>preflight.COUNT||preflight.pathFor(number-1)!==p)
      return null;
    return 'Resource '+found[1];
  }
  function validReceipt(receipt){
    if(!sameKeys(receipt,REQUIRED_RECEIPT)||
       receipt.format!==FORMAT||receipt.reviewOnly!==true||
       receipt.approved!==false||receipt.githubReady!==false||
       receipt.releaseBuilderAvailable!==false||
       receipt.canonicalLayoutApproved!==false||
       receipt.originalNonResourceShellPreserved!==true||
       receipt.liveWebsiteUnchanged!==true||
       receipt.trustedGitCommitChecked!==false||
       receipt.privateGitRecoveryBackupVerified!==false||
       receipt.realAdminWriteFlowVerified!==false||
       receipt.newSourceBytesIncluded!==false||
       receipt.canApply!==false||receipt.canMerge!==false||
       receipt.canPublish!==false||
       receipt.repoFilesWritten!==0||receipt.gitActionsTaken!==0||
       receipt.originalBaselineSha256!==preflight.BASE||
       !HASH.test(receipt.expectedCurrentSourceSha256)||
       !HASH.test(receipt.proposedFullSiteSha256)||
       receipt.expectedCurrentSourceSha256===receipt.proposedFullSiteSha256||
       !Number.isSafeInteger(receipt.currentRevision)||
       receipt.currentRevision<0||
       receipt.proposedRevision!==receipt.currentRevision+1||
       receipt.physicallyVerifiedResources!==preflight.COUNT||
       receipt.physicalSourceFiles!==preflight.COUNT+1||
       !Number.isSafeInteger(receipt.editedResourceCount)||
       receipt.editedResourceCount<1||
       receipt.editedResourceCount>preflight.COUNT||
       receipt.unchangedResourceCount!==
         preflight.COUNT-receipt.editedResourceCount||
       !size(receipt.sourceBytesBefore,MAX_SITE_BYTES)||
       !size(receipt.sourceBytesAfter,MAX_SITE_BYTES)||
       !Array.isArray(receipt.proposedPaths)||
       receipt.proposedFileCount!==receipt.editedResourceCount+2||
       receipt.proposedPaths.length!==receipt.proposedFileCount)
      return false;
    const paths=new Set();
    let resources=0,manifestCount=0,runtimeCount=0;
    for(const file of receipt.proposedPaths){
      if(!sameKeys(file,FILE_KEYS)||typeof file.path!=='string'||
         paths.has(file.path)||!labelFor(file.path)||
         !HASH.test(file.expectedOldSha256)||
         !HASH.test(file.proposedNewSha256)||
         file.expectedOldSha256===file.proposedNewSha256)
        return false;
      const role=file.path===RUNTIME?'proposed-generated-runtime':
        file.path===MANIFEST?'proposed-source-manifest':
          'proposed-resource-fragment';
      if(file.kind!==role)return false;
      const max=file.path===RUNTIME?MAX_SITE_BYTES:
        file.path===MANIFEST?MAX_MANIFEST_BYTES:MAX_RESOURCE_BYTES;
      if(!size(file.oldBytes,max)||!size(file.newBytes,max))return false;
      paths.add(file.path);
      if(file.path===RUNTIME){
        runtimeCount++;
        if(file.expectedOldSha256!==receipt.expectedCurrentSourceSha256||
           file.proposedNewSha256!==receipt.proposedFullSiteSha256||
           file.oldBytes!==receipt.sourceBytesBefore||
           file.newBytes!==receipt.sourceBytesAfter)return false;
      }else if(file.path===MANIFEST)manifestCount++;
      else resources++;
    }
    return runtimeCount===1&&manifestCount===1&&
      resources===receipt.editedResourceCount;
  }
  const messages={
    'missing':'Choose the current version manifest and a proposed change receipt, or try a fictional example.',
    'invalid-source':'The version manifest is not a supported, complete 414-resource record. Nothing was changed.',
    'invalid-receipt':'The change receipt has an unsupported or unsafe structure. Nothing was changed.',
    'stale':'This review is based on an older or different source version. Keep the draft. Reopen the latest source and review changes again. Nothing was overwritten.',
    'resource-conflict':'A proposed resource no longer matches the selected version manifest. Do not overwrite newer edits.',
    'review-only':'The receipt matches the selected version metadata. Inspect the proposed files below. This is NOT approval to save, merge or publish.',
    'file-limit':'At least one selected JSON file is empty or exceeds the review-only size limit.',
    'read-failed':'The selected JSON files could not be read safely. Nothing was changed.',
    'rejected':'This proposal was dismissed from this private preview. Your selected JSON files and saved drafts were not deleted or changed. Choose Review to inspect it again.'
  };
  function status(code,manifest,receipt,showFiles){
    const list=showFiles&&receipt&&validReceipt(receipt)?
      receipt.proposedPaths.map(file=>Object.freeze({
        label:labelFor(file.path),path:file.path,
        oldBytes:file.oldBytes,newBytes:file.newBytes
      })): [];
    return Object.freeze({
      code,message:messages[code],
      latestRevision:manifest&&Number.isSafeInteger(manifest.revision)?
        manifest.revision:null,
      proposedRevision:receipt&&Number.isSafeInteger(receipt.proposedRevision)?
        receipt.proposedRevision:null,
      editedResources:showFiles?receipt.editedResourceCount:0,
      unchangedResources:showFiles?receipt.unchangedResourceCount:0,
      proposedFileCount:list.length,files:Object.freeze(list),
      metadataChecked:code==='review-only'||code==='stale'||code==='resource-conflict',
      actualSourceFilesVerified:false,fullHtmlReconstructed:false,
      remoteHeadAuthenticated:false,ownerApprovalChecked:false,
      canApply:false,canMerge:false,canPublish:false,readOnly:true,
      noDataSaved:true
    });
  }
  function inspect(manifest,receipt){
    if(!preflight.validManifest(manifest))
      return status('invalid-source',null,null,false);
    if(!validReceipt(receipt))
      return status('invalid-receipt',manifest,null,false);
    if(receipt.currentRevision!==manifest.revision||
       receipt.expectedCurrentSourceSha256!==manifest.sourceSha256||
       receipt.sourceBytesBefore!==manifest.sourceBytes)
      return status('stale',manifest,receipt,true);
    for(const file of receipt.proposedPaths){
      if(file.kind!=='proposed-resource-fragment')continue;
      const i=Number(file.path.slice(-13,-9))-1;
      // Always derive the index from an exact previously validated file path.
      if(!Number.isInteger(i)||i<0||i>=preflight.COUNT||
         manifest.resources[i].sha256!==file.expectedOldSha256)
        return status('resource-conflict',manifest,receipt,true);
    }
    return status('review-only',manifest,receipt,true);
  }
  function parseJson(text,max){
    // Browser File.size is UTF-8 bytes, while JS string.length is not.
    // Enforce the same bound even for programmatic JSON checks.
    if(typeof text!=='string'||!size(new TextEncoder().encode(text).byteLength,max))
      return null;
    try{return JSON.parse(text);}catch(_){return null;}
  }
  function inspectJSON(manifestText,receiptText){
    const manifest=parseJson(manifestText,MAX_MANIFEST_BYTES);
    const receipt=parseJson(receiptText,MAX_RECEIPT_BYTES);
    return inspect(manifest,receipt);
  }
  return Object.freeze({
    FORMAT,RUNTIME,MANIFEST,MAX_MANIFEST_BYTES,MAX_RECEIPT_BYTES,
    validReceipt,inspect,inspectJSON,parseJson,size,labelFor,
    missing:()=>status('missing',null,null,false),
    tooLarge:()=>status('file-limit',null,null,false),
    failed:()=>status('read-failed',null,null,false),
    rejected:()=>status('rejected',null,null,false)
  });
});

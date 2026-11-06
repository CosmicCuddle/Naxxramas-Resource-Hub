/* PRIVATE NAXX MULTI-DOMAIN CHANGE REVIEW. Untrusted receipt metadata ONLY.
 * A well-formed receipt cannot authenticate GitHub, the original website,
 * real resource bytes, a backup, or the owner's approval. Never saves files.
 */
(function(root,factory){
  'use strict';
  const modulePresent=typeof module==='object'&&module.exports;
  const core=factory();
  if(modulePresent)module.exports=core;
  else root.NaxxUnifiedReviewCore=core;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const FORMAT='naxx-private-unified-source-layout-review-v1';
  const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
  const MAX_JSON_BYTES=262144;
  const SHA256=/^[a-f0-9]{64}$/;
  const GIT_SHA=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
  const PAGES=Object.freeze([
    'new-players/content.html','rules/content.html','apply/content.html',
    'game-clients/content.html','content/navigation.json'
  ]);
  const MANIFEST='content/resource-overlays/manifest.json';
  const RUNTIME='site-content.html';
  const MAIN_KEYS=[
    'format','readOnly','reviewedLocalGitCommit','localCheckoutVerified',
    'remoteGitHubHeadVerified','originalWebsiteSha256Matched',
    'resourcesVerified','originalDraftFormatsPreserved',
    'oldPageDraftSha256','oldResourceDraftSha256',
    'existingPageAndNavigationFilesChecked','editedPageAndNavigationFiles',
    'editedResources','unifiedProposedFileCount','proposedFiles',
    'independentFullSiteSha256Matched','completeGeneratedSiteSha256',
    'fullSourceLayoutFileCount','resourceOnlyLayoutFileCount',
    'fullSourceTreeUsedForLegacyProofOnly',
    'versionedOverlayUsedInDisposableFolderOnly',
    'candidatePathsUntrackedAndUnapproved','sourceLayoutApproved',
    'sourcePackageAdopted','independentBackupRestored',
    'realAdminEditorVerified','noRemoteUpdateLease','noAutomaticDraftMigration',
    'noDraftDeletion','repositoryFilesWritten','githubWrites',
    'canApply','canMerge','canPublish'
  ];
  const FILE_KEYS=['path','domain','trackedInCurrentGit','oldSha256','newSha256'];
  function sameKeys(value,required){
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const a=Object.keys(value);
    return a.length===required.length&&a.every(k=>required.includes(k));
  }
  function resourceNumber(path){
    const matched=/^content\/resource-overlays\/resources\/(\d{4})\.fragment$/.exec(path);
    if(!matched)return null;
    const n=Number(matched[1]);
    return n>=1&&n<=414&&String(n).padStart(4,'0')===matched[1]?n:null;
  }
  function fileRole(file){
    if(PAGES.includes(file.path)&&file.domain==='existing-page-or-navigation'&&
      file.trackedInCurrentGit===true)
      return {kind:'existing',label:file.path==='content/navigation.json'?
        'Navigation settings':'Website page'};
    const n=resourceNumber(file.path);
    if(n!==null&&file.domain==='candidate-resource'&&file.trackedInCurrentGit===false)
      return {kind:'candidate',label:'Resource '+String(n).padStart(4,'0')};
    if(file.path===MANIFEST&&file.domain==='candidate-manifest'&&
      file.trackedInCurrentGit===false)
      return {kind:'manifest',label:'Proposed resource manifest'};
    if(file.path===RUNTIME&&file.domain==='generated-runtime'&&
      file.trackedInCurrentGit===true)
      return {kind:'runtime',label:'Generated complete website'};
    return null;
  }
  function valid(receipt){
    if(!sameKeys(receipt,MAIN_KEYS)||receipt.format!==FORMAT||
       receipt.readOnly!==true||!GIT_SHA.test(receipt.reviewedLocalGitCommit)||
       receipt.localCheckoutVerified!==true||
       receipt.remoteGitHubHeadVerified!==false||
       receipt.originalWebsiteSha256Matched!==true||
       receipt.resourcesVerified!==414||
       receipt.originalDraftFormatsPreserved!==true||
       !SHA256.test(receipt.oldPageDraftSha256)||
       !SHA256.test(receipt.oldResourceDraftSha256)||
       receipt.existingPageAndNavigationFilesChecked!==5||
       !Number.isSafeInteger(receipt.editedPageAndNavigationFiles)||
       receipt.editedPageAndNavigationFiles<1||
       receipt.editedPageAndNavigationFiles>5||
       !Number.isSafeInteger(receipt.editedResources)||
       receipt.editedResources<1||receipt.editedResources>414||
       !SHA256.test(receipt.completeGeneratedSiteSha256)||
       receipt.completeGeneratedSiteSha256===BASE||
       receipt.independentFullSiteSha256Matched!==true||
       receipt.fullSourceLayoutFileCount!==418||
       receipt.resourceOnlyLayoutFileCount!==415||
       receipt.fullSourceTreeUsedForLegacyProofOnly!==true||
       receipt.versionedOverlayUsedInDisposableFolderOnly!==true||
       receipt.candidatePathsUntrackedAndUnapproved!==true||
       receipt.sourceLayoutApproved!==false||
       receipt.sourcePackageAdopted!==false||
       receipt.independentBackupRestored!==false||
       receipt.realAdminEditorVerified!==false||
       receipt.noRemoteUpdateLease!==true||
       receipt.noAutomaticDraftMigration!==true||
       receipt.noDraftDeletion!==true||
       receipt.repositoryFilesWritten!==0||receipt.githubWrites!==0||
       receipt.canApply!==false||receipt.canMerge!==false||
       receipt.canPublish!==false||
       !Array.isArray(receipt.proposedFiles)||
       receipt.unifiedProposedFileCount!==
         receipt.editedPageAndNavigationFiles+receipt.editedResources+2||
       receipt.proposedFiles.length!==receipt.unifiedProposedFileCount)
      return false;
    const seen=new Set(),counts={existing:0,candidate:0,manifest:0,runtime:0};
    for(const f of receipt.proposedFiles){
      if(!sameKeys(f,FILE_KEYS)||typeof f.path!=='string'||seen.has(f.path)||
         !SHA256.test(f.oldSha256)||!SHA256.test(f.newSha256)||
         f.oldSha256===f.newSha256)return false;
      const role=fileRole(f);
      if(!role)return false;
      if(role.kind==='runtime'&&(
        f.oldSha256!==BASE||f.newSha256!==receipt.completeGeneratedSiteSha256
      ))return false;
      seen.add(f.path);
      counts[role.kind]++;
    }
    return counts.existing===receipt.editedPageAndNavigationFiles&&
      counts.candidate===receipt.editedResources&&
      counts.manifest===1&&counts.runtime===1;
  }
  const messages=Object.freeze({
    missing:'Select a proposed unified receipt JSON or try a fictional example.',
    invalid:'This receipt contains missing, unexpected, unsafe or unsupported metadata. Nothing was changed.',
    preview:'The receipt has the expected format. These are CLAIMED file changes only: the real GitHub source and files were not verified in this browser.',
    dismissed:'Proposal hidden. Your selected JSON and saved draft files have not been deleted or edited. You may review the same selection again.',
    limit:'The JSON file is empty or exceeds the private review size limit. Nothing was changed.',
    failed:'This JSON could not be safely read. Nothing was changed.'
  });
  function state(code,receipt){
    const approvedStructure=code==='preview'&&valid(receipt);
    const files=approvedStructure?receipt.proposedFiles.map(f=>Object.freeze({
      label:fileRole(f).label,path:f.path,
      trackedInCurrentGit:f.trackedInCurrentGit,
      sourceType:fileRole(f).kind
    })):[];
    return Object.freeze({
      code,message:messages[code],files:Object.freeze(files),
      existingFileChanges:approvedStructure?receipt.editedPageAndNavigationFiles:0,
      resourceChanges:approvedStructure?receipt.editedResources:0,
      totalProposedPaths:files.length,
      reviewedCommit:approvedStructure?receipt.reviewedLocalGitCommit:null,
      sourceAuthenticatedInBrowser:false,remoteHeadVerifiedInBrowser:false,
      canonicalLayoutApproved:false,backupRestoredInBrowser:false,
      actualResourceContentDisplayed:false,readOnly:true,
      canApply:false,canMerge:false,canPublish:false
    });
  }
  function inspect(receipt){return state(valid(receipt)?'preview':'invalid',receipt);}
  function inspectJSON(text){
    // The UI advertises a byte limit, not a UTF-16 character count.
    // Match File.size for multibyte JSON; never rely on string.length.
    if(typeof text!=='string'||text.length<1||
       new TextEncoder().encode(text).byteLength>MAX_JSON_BYTES)
      return state('limit',null);
    try{return inspect(JSON.parse(text));}catch(_){return state('invalid',null);}
  }
  return Object.freeze({FORMAT,BASE,PAGES,MANIFEST,RUNTIME,MAX_JSON_BYTES,
    valid,inspect,inspectJSON,resourceNumber,fileRole,
    missing:()=>state('missing',null),
    dismissed:()=>state('dismissed',null),
    failed:()=>state('failed',null),
    limit:()=>state('limit',null)
  });
});

/* Entirely fictional receipt metadata. No Naxxramas resource values. */
(function(root,factory){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const result=factory(node?require('./unified-review-core.js'):root.NaxxUnifiedReviewCore);
  if(node)module.exports=result;
  else root.NaxxUnifiedReviewExamples=result;
})(typeof globalThis==='object'?globalThis:this,function(core){
  'use strict';
  const h=c=>c.repeat(64);
  function generate(){
    const files=[
      {path:'new-players/content.html',domain:'existing-page-or-navigation',
        trackedInCurrentGit:true,oldSha256:h('1'),newSha256:h('2')},
      {path:'content/navigation.json',domain:'existing-page-or-navigation',
        trackedInCurrentGit:true,oldSha256:h('3'),newSha256:h('4')},
      {path:'content/resource-overlays/resources/0001.fragment',
        domain:'candidate-resource',trackedInCurrentGit:false,
        oldSha256:h('5'),newSha256:h('6')},
      {path:'content/resource-overlays/resources/0414.fragment',
        domain:'candidate-resource',trackedInCurrentGit:false,
        oldSha256:h('7'),newSha256:h('8')},
      {path:core.MANIFEST,domain:'candidate-manifest',
        trackedInCurrentGit:false,oldSha256:h('9'),newSha256:h('a')},
      {path:core.RUNTIME,domain:'generated-runtime',
        trackedInCurrentGit:true,oldSha256:core.BASE,newSha256:h('b')}
    ];
    const current={
      format:core.FORMAT,readOnly:true,
      reviewedLocalGitCommit:'c'.repeat(40),localCheckoutVerified:true,
      remoteGitHubHeadVerified:false,originalWebsiteSha256Matched:true,
      resourcesVerified:414,originalDraftFormatsPreserved:true,
      oldPageDraftSha256:h('d'),oldResourceDraftSha256:h('e'),
      existingPageAndNavigationFilesChecked:5,
      editedPageAndNavigationFiles:2,editedResources:2,
      unifiedProposedFileCount:6,proposedFiles:files,
      independentFullSiteSha256Matched:true,completeGeneratedSiteSha256:h('b'),
      fullSourceLayoutFileCount:418,resourceOnlyLayoutFileCount:415,
      fullSourceTreeUsedForLegacyProofOnly:true,
      versionedOverlayUsedInDisposableFolderOnly:true,
      candidatePathsUntrackedAndUnapproved:true,
      sourceLayoutApproved:false,sourcePackageAdopted:false,
      independentBackupRestored:false,realAdminEditorVerified:false,
      noRemoteUpdateLease:true,noAutomaticDraftMigration:true,noDraftDeletion:true,
      repositoryFilesWritten:0,githubWrites:0,
      canApply:false,canMerge:false,canPublish:false
    };
    const unsafe={...current,proposedFiles:files.map(f=>({...f}))};
    unsafe.proposedFiles[0].path='../index.html';
    const forged={...current,canPublish:true};
    return {current,unsafe,forged};
  }
  return Object.freeze({generate});
});

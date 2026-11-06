/* FICTIONAL EXAMPLES ONLY. This is not a real Naxxramas source manifest.
 * No source values, real resource fields or actual edited HTML are included.
 */
(function(root,factory){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const lib=factory(node?require('./restore-preflight-core.js'):root.NaxxRestorePreflight,
    node?require('./save-review-core.js'):root.NaxxSaveReviewCore);
  if(node)module.exports=lib;
  else root.NaxxSaveReviewExamples=lib;
})(typeof globalThis==='object'?globalThis:this,function(preflight,review){
  'use strict';
  function fakeHash(i){return String(i).padStart(64,'0');}
  function generate(){
    const resources=Array.from({length:preflight.COUNT},(_,i)=>({
      index:i,path:preflight.pathFor(i),sha256:fakeHash(i+1)
    }));
    const manifest={
      format:preflight.MANIFEST,privateOnly:true,
      publishable:false,deployable:false,originalSha256:preflight.BASE,
      revision:0,parentSha256:null,sourceSha256:preflight.BASE,
      sourceBytes:30976969,resources
    };
    const files=[{
      path:preflight.pathFor(0),kind:'proposed-resource-fragment',
      expectedOldSha256:resources[0].sha256,
      proposedNewSha256:'a'.repeat(64),oldBytes:50,newBytes:64
    },{
      path:review.MANIFEST,kind:'proposed-source-manifest',
      expectedOldSha256:'b'.repeat(64),
      proposedNewSha256:'c'.repeat(64),oldBytes:80000,newBytes:80022
    },{
      path:review.RUNTIME,kind:'proposed-generated-runtime',
      expectedOldSha256:preflight.BASE,
      proposedNewSha256:'d'.repeat(64),oldBytes:30976969,newBytes:30976983
    }];
    const receipt={
      format:review.FORMAT,reviewOnly:true,approved:false,
      githubReady:false,releaseBuilderAvailable:false,
      canonicalLayoutApproved:false,originalNonResourceShellPreserved:true,
      liveWebsiteUnchanged:true,
      currentRevision:0,proposedRevision:1,
      originalBaselineSha256:preflight.BASE,
      expectedCurrentSourceSha256:preflight.BASE,
      proposedFullSiteSha256:'d'.repeat(64),
      sourceBytesBefore:30976969,sourceBytesAfter:30976983,
      physicallyVerifiedResources:414,physicalSourceFiles:415,
      editedResourceCount:1,unchangedResourceCount:413,
      proposedPaths:files,proposedFileCount:3,
      trustedGitCommitChecked:false,
      privateGitRecoveryBackupVerified:false,
      realAdminWriteFlowVerified:false,newSourceBytesIncluded:false,
      canApply:false,canMerge:false,canPublish:false,
      repoFilesWritten:0,gitActionsTaken:0
    };
    const stale={...manifest,revision:1,parentSha256:preflight.BASE,
      sourceSha256:'e'.repeat(64),sourceBytes:30976969};
    const changed={...manifest,resources:resources.map(x=>({...x}))};
    changed.resources[0].sha256='f'.repeat(64);
    return {manifest,receipt,stale,changed};
  }
  return Object.freeze({generate});
});

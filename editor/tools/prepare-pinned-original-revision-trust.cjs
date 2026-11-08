'use strict';
/*
 * PRIVATE READ-ONLY EXPERIMENT: derive original Revision 0 trust from an
 * exact, pinned LOCAL Git commit's verified site-content.html blob.
 *
 * The Git commit MUST be independently supplied (e.g. CI's pinned
 * checkout commit); an uploaded manifest, ZIP or draft never supplies it.
 * This does not authenticate the current remote GitHub HEAD, adopt the
 * 415-file overlay, authorize a Save, or support published later revisions.
 *
 * No filesystem writers, network access, credential handling, website
 * script evaluation, source text logging, GitHub writes, merge or deploy.
 */
const crypto=require('node:crypto');
const {verifyCheckoutBaseline,getBlob,runGit}=
  require('./rehearse-local-git-head-preflight.cjs');
const {splitBase,makeManifest}=require('./rehearse-versioned-resource-sessions.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {recordPath,COUNT}=require('./rehearse-resource-only-overlay.cjs');

const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const COMMIT=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const RUNTIME='site-content.html';

function originalTrustFromPinnedCheckout(repo,expectedCommit){
  if(typeof repo!=='string'||!repo||
     typeof expectedCommit!=='string'||!COMMIT.test(expectedCommit))
    throw Error('A separately supplied, exact local Git commit is required.');

  // Existing guard verifies HEAD matches expectedCommit AND the original
  // runtime blob SHA, byte length and ordinary tracked file type.
  const checkout=verifyCheckoutBaseline(repo,expectedCommit);
  if(!checkout.checkedOutCommitMatched||
     !checkout.originalWebsiteSha256Matched||
     checkout.checkedWebsiteBytes!==30976969||
     checkout.checkedGitBlobs!==1||
     checkout.canApply!==false||checkout.canPublish!==false)
    throw Error('Pinned checkout did not pass original source preflight.');

  // Read the pinned Git *object*, not a possibly dirty worktree copy.
  const original=getBlob(repo,expectedCommit,RUNTIME);
  if(original.length!==30976969||sha(original)!==SOURCE_SHA)
    throw Error('The pinned Git source object is not the original website.');
  const split=splitBase(original);
  if(split.records.length!==COUNT)
    throw Error('The pinned original does not have all resource records.');
  const snapshot={
    manifest:makeManifest(split,split.records,0,null),
    shell:{
      prefix:split.source.slice(0,split.arrayBegin),
      suffix:split.source.slice(split.arrayEnd),
      separators:split.separators.slice()
    },
    fragments:split.records.slice()
  };
  if(snapshot.manifest.sourceSha256!==SOURCE_SHA||
     snapshot.manifest.sourceBytes!==original.length)
    throw Error('The private revision-zero manifest differs from the pinned Git blob.');

  // The independently expected values are derived from the verified pinned
  // Git object, NOT read back from an untrusted draft/overlay manifest.
  const trust={
    expectedRevision:0,
    expectedSourceSha256:SOURCE_SHA,
    expectedParentSha256:null,
    expectedShellSha256:sha(Buffer.from(JSON.stringify([
      snapshot.shell.prefix,snapshot.shell.suffix,snapshot.shell.separators
    ]),'utf8')),
    expectedRecordPaths:Array.from({length:COUNT},(_,i)=>recordPath(i))
  };
  for(let i=0;i<COUNT;i++){
    if(snapshot.manifest.resources[i].path!==trust.expectedRecordPaths[i]||
       snapshot.manifest.resources[i].sha256!==
         sha(Buffer.from(snapshot.fragments[i],'utf8')))
      throw Error('A pinned original resource fragment does not match its expected path or hash.');
  }

  // Local checkout stability is checked before returning. This is NOT a
  // cross-process lock and does not authenticate the remote GitHub branch.
  const after=runGit(repo,['rev-parse','--verify','HEAD^{commit}']).trim();
  if(after!==expectedCommit)
    throw Error('Local Git checkout changed during the read-only trust check.');

  return {
    snapshot,trust,
    evidence:Object.freeze({
      format:'naxx-private-pinned-original-revision-trust-v1',
      pinnedLocalGitCommit:expectedCommit,
      sourceFromGitBlob:true,revision:0,resourcesChecked:COUNT,
      originalSourceSha256:SOURCE_SHA,
      fullSourceBytesVerified:original.length,
      checkoutStableAtEnd:true,
      remoteGitHubTipAuthenticated:false,
      futureRevisionAuthenticated:false,
      sourceLayoutApproved:false,readOnly:true,reviewOnly:true,
      canApply:false,canPush:false,canMerge:false,canPublish:false,
      filesWritten:0,gitHubWrites:0
    })
  };
}
module.exports={originalTrustFromPinnedCheckout};

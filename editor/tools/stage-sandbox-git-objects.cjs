'use strict';
/*
 * VERIFIED GIT OBJECT UPLOAD — SANDBOX TRANSPORT ONLY.
 *
 * Existing ZIP and complete physical 415-file source proof must be verified
 * BEFORE entering this module. This module stages complete Git blobs, a tree
 * and a commit via an explicitly INJECTED disposable-test repository API.
 * It refuses the production Resource Hub. It NEVER advances a Git ref.
 *
 * No fetch, HTTPS client, GitHub credential, filesystem writer or browser API.
 * All unreferenced test-repo objects are intentionally abandoned if any
 * step fails; no automatic retry on unknown upload outcome.
 */
const crypto=require('node:crypto');
const {gitBlobOid}=require('./rehearse-browser-zip-git-tree-intent.cjs');
const {filePaths,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const FORMAT='naxx-sandbox-verified-415-git-object-staging-v1';
const PRODUCTION='CosmicCuddle/Naxxramas-Resource-Hub';
const SHA=/^[0-9a-f]{40}$/;
const REPO=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const OVERLAY=new Set(filePaths());
const sha256=x=>crypto.createHash('sha256').update(x).digest('hex');
function checkedCandidate(input) {
  const proof=input&&input.proof;
  if(!input || input.targetRepository===PRODUCTION ||
     !REPO.test(input.targetRepository||'')||
     !SHA.test(input.expectedParent||'')||
     !SHA.test(input.expectedBaseTree||'')||
     !SHA.test(input.expectedNextTree||'')||
     input.expectedBaseTree===input.expectedNextTree ||
     !proof||
     proof.format!=='naxx-private-git-tree-intent-from-browser-zip-v1'||
     proof.reviewedGitCommit!==input.expectedParent||
     proof.originalTreeOid!==input.expectedBaseTree||
     proof.proposedTreeOidCalculatedInMemory!==input.expectedNextTree||
     proof.newOverlayGitBlobs!==COUNT+1||
     proof.completeResourceCount!==COUNT||
     !Number.isInteger(proof.changedExistingGitBlobs)||
     proof.changedExistingGitBlobs<2||proof.changedExistingGitBlobs>6||
     proof.allOriginalFileModesPreserved!==true||
     proof.newCandidateFilesRegularMode100644!==true||
     proof.sourceLayoutOwnerApproved!==false||
     proof.realGitCommitObjectCreated!==false||
     proof.canApply!==false||proof.canPush!==false||
     proof.canPublish!==false||
     !Array.isArray(proof.changedPaths)||
     proof.changedPaths.length!==proof.changedExistingGitBlobs||
     !Array.isArray(input.files)||
     input.files.length!==COUNT+1+proof.changedExistingGitBlobs)
    throw Error('An independently checked complete 415-source sandbox candidate is required.');
  const expectedTracked=new Map();
  for(const entry of proof.changedPaths) {
    if(!entry||typeof entry.path!=='string'||
       entry.path==='index.html'||OVERLAY.has(entry.path)||
       !['100644','100755'].includes(entry.mode)||
       !SHA.test(entry.newGitBlobOid||'')||
       typeof entry.newSha256!=='string'||
       !/^[a-f0-9]{64}$/.test(entry.newSha256))
      throw Error('Unexpected modified existing Git path in source proof.');
    if(expectedTracked.has(entry.path))
      throw Error('Duplicate original Git path in source proof.');
    expectedTracked.set(entry.path,entry);
  }
  if(!expectedTracked.has(RUNTIME))
    throw Error('Rebuilt complete site source is missing.');
  const seen=new Set(),files=[];
  for(const part of input.files) {
    if(!part||typeof part.path!=='string'||
       seen.has(part.path)||!Buffer.isBuffer(part.bytes)||
       part.bytes.length<1||part.bytes.length>36*1024*1024)
      throw Error('Duplicate, missing, oversized or unverified source bytes.');
    seen.add(part.path);
    const overlay=OVERLAY.has(part.path);
    const tracked=expectedTracked.get(part.path);
    if(!overlay&&!tracked)
      throw Error('The reviewed source package contains an unexpected Git path.');
    const mode=overlay?'100644':tracked.mode;
    if(part.mode!==mode)
      throw Error('The reviewed file mode was changed.');
    const oid=gitBlobOid(part.bytes);
    if(!SHA.test(oid)||part.oid!==oid||
       tracked&&(tracked.newGitBlobOid!==oid||
         tracked.newSha256!==sha256(part.bytes)))
      throw Error('Source Git blob identity differs from reviewed physical bytes.');
    files.push(Object.freeze({path:part.path,mode,oid,bytes:part.bytes}));
  }
  if([...OVERLAY].some(path=>!seen.has(path))||
     [...expectedTracked.keys()].some(path=>!seen.has(path)))
    throw Error('The initial 415-file source or changed tracked paths are incomplete.');
  return Object.freeze({targetRepository:input.targetRepository,
    parent:input.expectedParent,baseTree:input.expectedBaseTree,
    expectedNextTree:input.expectedNextTree,
    files:Object.freeze(files.sort((a,b)=>a.path.localeCompare(b.path))),
    changedTracked:expectedTracked.size,overlayFiles:OVERLAY.size});
}
async function stageSandboxGitObjects(input,api) {
  const selected=checkedCandidate(input);
  if(!api||typeof api.createBlob!=='function'||
     typeof api.createTree!=='function'||
     typeof api.createCommit!=='function'||
     typeof api.readCommit!=='function')
    throw Error('An injected sandbox Git object service is required.');
  const entries=[];
  for(const file of selected.files) {
    // GitHub REST create-blob requires base64 for an exact binary-opaque
    // copy, including the ~31MB legacy website runtime when staged for real.
    // The separate test repo is the ONLY permitted injected target here.
    let object;
    try {
      object=await api.createBlob({
        repository:selected.targetRepository,
        content:file.bytes.toString('base64'),encoding:'base64'
      });
    }catch(_){
      throw Error('GIT_OBJECT_OUTCOME_UNCERTAIN: stop and retain the original draft.');
    }
    if(!object||object.sha!==file.oid)
      throw Error('GitHub test blob identity differs from the reviewed source.');
    entries.push({path:file.path,mode:file.mode,type:'blob',sha:file.oid});
  }
  let tree;
  try {
    tree=await api.createTree({repository:selected.targetRepository,
      base_tree:selected.baseTree,tree:entries});
  }catch(_){
    throw Error('GIT_OBJECT_OUTCOME_UNCERTAIN: test tree creation failed.');
  }
  if(!tree||tree.sha!==selected.expectedNextTree)
    throw Error('Created Git test tree differs from independent full-site proof.');
  let commit;
  try {
    commit=await api.createCommit({
      repository:selected.targetRepository,
      message:'Disposable, non-publishing website editor Save rehearsal',
      tree:selected.expectedNextTree,parents:[selected.parent]
    });
  }catch(_){
    throw Error('GIT_OBJECT_OUTCOME_UNCERTAIN: test commit creation failed.');
  }
  if(!commit||!SHA.test(commit.sha||'')||commit.sha===selected.parent)
    throw Error('Git test commit did not return a valid new Git identity.');
  try {
    const saved=await api.readCommit(commit.sha);
    if(!saved||saved.repository!==selected.targetRepository||
       saved.sha!==commit.sha||
       saved.treeOid!==selected.expectedNextTree||
       !Array.isArray(saved.parents)||saved.parents.length!==1||
       saved.parents[0]!==selected.parent)
      throw Error('Test commit identity and exact parent were not independently confirmed.');
  }catch(_){
    throw Error('GIT_OBJECT_OUTCOME_UNCERTAIN: test commit readback failed.');
  }
  return Object.freeze({
    format:FORMAT,
    targetRepository:selected.targetRepository,
    proposedCommitOid:commit.sha,
    reviewedParentOid:selected.parent,
    originalTreeOid:selected.baseTree,
    verifiedProposedTreeOid:selected.expectedNextTree,
    fullSourceBlobsVerified:entries.length,
    resourceOverlayBlobsVerified:selected.overlayFiles,
    editedTrackedBlobsVerified:selected.changedTracked,
    exactOneParentVerified:true,readBackVerified:true,
    gitRefAdvanced:false,realWebsiteRepositoryWritten:false,
    productionSaveAuthorized:false,canPush:false,canPublish:false,
    testRepositoryGitObjectsCreated:true
  });
}
module.exports=Object.freeze({FORMAT,checkedCandidate,stageSandboxGitObjects});

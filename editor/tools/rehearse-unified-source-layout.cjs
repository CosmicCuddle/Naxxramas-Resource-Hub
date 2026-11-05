'use strict';
/*
 * NON-DEPLOYABLE UNIFIED SOURCE-TREE REHEARSAL
 *
 * Builds a sparse 425-file website layout ONLY inside an isolated OS temp
 * folder, after exact two-ZIP, two-draft and commit-receipt verification.
 * It never stages any content/legacy source in Git, publishes an archive,
 * changes the real root site-content.html, copies the real game server,
 * or claims to be a complete browser-ready site checkout.
 *
 * Sparse candidate layout = 418 resource source-tree files + 4 page HTML
 * files + navigation JSON + original index.html + generated site-content.html.
 * It independently reconstructs the generated compatibility source directly
 * FROM THE STAGED FILES and checks byte-exact restoration to original.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {PAGES,NAV,plan:planPages}=require('./plan-page-draft.cjs');
const {planChangeSet}=require('./rehearse-resource-change-set.cjs');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {ROOT,MANIFEST,layout,resourcePath,expectedPaths,
  writeCandidate,verifyCandidate}=require('./rehearse-proposed-resource-tree.cjs');
const {verifyPairedArchives}=require('./verify-paired-editor-archives.cjs');
const {decode}=require('./private-source-zip.cjs');
const {MANIFEST:PAGE_MANIFEST,GUIDE:PAGE_GUIDE}=
  require('./package-reviewed-page-update.cjs');
const {MANIFEST:RESOURCE_MANIFEST,README:RESOURCE_README,
  PREVIEW:RESOURCE_PREVIEW,reviewPath}=
  require('./package-reviewed-resource-preview.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ORIGINAL='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const TRACKED=[...PAGES,NAV,'site-content.html','index.html'];
const SPARSE_COUNT=expectedPaths().size+TRACKED.length;
function assertCandidateTreeUnadopted(root){
  const proposed=path.join(root,...ROOT.split('/'));
  if(fs.existsSync(proposed))
    throw Error('The proposed resource source-tree path already exists. Revalidate the approved migration before testing.');
  return true;
}
function safePath(root,relative){
  if(!expectedPaths().has(relative)&&!TRACKED.includes(relative))
    throw Error('Unexpected candidate workspace path.');
  return path.join(root,...relative.split('/'));
}
function writeFile(root,relative,bytes,overwrite=false){
  if(!Buffer.isBuffer(bytes))throw Error('Candidate source must be verified file bytes.');
  const file=safePath(root,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  if(overwrite){
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink())
      throw Error('Unsafe candidate workspace file replacement.');
  }
  fs.writeFileSync(file,bytes,{flag:overwrite?'w':'wx',mode:0o600});
}
function readFile(root,relative){
  const file=safePath(root,relative),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())
    throw Error('Missing or unsafe private candidate file.');
  return fs.readFileSync(file);
}
function listFiles(root){
  const found=[];
  function walk(directory){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const full=path.join(directory,entry.name);
      const meta=fs.lstatSync(full);
      if(meta.isSymbolicLink())throw Error('Candidate workspace cannot contain symlinks.');
      if(meta.isDirectory())walk(full);
      else if(meta.isFile())found.push(path.relative(root,full).split(path.sep).join('/'));
      else throw Error('Candidate workspace cannot contain special files.');
    }
  }
  walk(root);
  return found;
}
function sparseInventory(root,expected){
  const found=listFiles(root);
  if(found.length!==expected.size||
     found.some(name=>!expected.has(name)))
    throw Error('Candidate workspace has missing, extra or unapproved files.');
  return found.length;
}
function verifyAssembled(root,source,resourcePlan,pagePlan,expectedPreview){
  const expected=new Set([...expectedPaths(),...TRACKED]);
  const count=sparseInventory(root,expected);
  const split=splitInMemory(source);
  const manifest=JSON.parse(readFile(root,MANIFEST).toString('utf8'));
  if(manifest.resources?.length!==414||
     manifest.changedPaths?.length!==resourcePlan.fragments.size||
     manifest.stagedSourceSha256!==resourcePlan.manifest.stagedSourceSha256)
    throw Error('Candidate source tree manifest conflicts with reviewed resources.');
  const expectedPrefix=Buffer.from(split.source.slice(0,split.arrayBegin),'utf8');
  const expectedSuffix=Buffer.from(split.source.slice(split.arrayEnd),'utf8');
  const expectedSeparators=Buffer.from(JSON.stringify(split.separators),'utf8');
  if(!readFile(root,layout.prefix).equals(expectedPrefix)||
     !readFile(root,layout.suffix).equals(expectedSuffix)||
     !readFile(root,layout.separators).equals(expectedSeparators))
    throw Error('Candidate source layout differs from original custom site.');
  const currentRecords=[];
  for(let index=0;index<414;index++){
    const file=readFile(root,resourcePath(index));
    const correct=resourcePlan.fragments.has(index)?
      Buffer.from(resourcePlan.fragments.get(index),'utf8'):
      Buffer.from(split.records[index],'utf8');
    if(!file.equals(correct)||
       sha(file)!==manifest.resources[index].stagedSha256)
      throw Error('Candidate resource fragment bytes or checksums differ.');
    currentRecords.push(file.toString('utf8'));
  }
  const reconstructed=restoreInMemory(split,currentRecords);
  const stagedCompat=readFile(root,'site-content.html');
  if(!stagedCompat.equals(reconstructed)||
     !stagedCompat.equals(expectedPreview)||
     !stagedCompat.equals(resourcePlan.expected)||
     sha(stagedCompat)!==resourcePlan.manifest.stagedSourceSha256)
    throw Error('Generated compatibility website differs from staged source fragments.');
  for(const relative of [...PAGES,NAV]){
    const edited=pagePlan.changed.find(x=>x.path===relative);
    const expectedBytes=edited?edited.bytes:fs.readFileSync(path.join(source.root,relative));
    if(!readFile(root,relative).equals(expectedBytes))
      throw Error('Staged page or navigation file differs from the reviewed edit.');
  }
  if(!readFile(root,'index.html').equals(fs.readFileSync(path.join(source.root,'index.html'))))
    throw Error('Candidate rehearsal changed protected root index.html.');
  return {
    exactCompatibilityRebuild:true,
    allResourceBytesVerified:true,
    exactEditedPagesVerified:true,
    customSourceLayoutUnchanged:true,
    rootLoaderUnchanged:true,
    fileCount:count,
    candidateResourceFiles:expectedPaths().size,
    trackedCompatibilityFiles:TRACKED.length,
    stagedSourceSha256:sha(stagedCompat)
  };
}
function restoreOriginal(root,originals){
  // Cleanup only an isolated workspace whose path was created by this tool.
  for(const [name,bytes] of originals)writeFile(root,name,bytes,true);
  fs.rmSync(path.join(root,...ROOT.split('/')),{recursive:true,force:true});
  const restored=new Set(TRACKED);
  const count=sparseInventory(root,restored);
  for(const [name,bytes] of originals){
    if(!readFile(root,name).equals(bytes))
      throw Error('Candidate rollback changed an original tracked file.');
  }
  return {originalTrackedFilesByteExact:true,originalResourceSourceRestored:
    sha(readFile(root,'site-content.html'))===ORIGINAL,
    candidateTreeRemoved:count===TRACKED.length};
}
async function rehearseUnified(root,drafts,receipt,pageZip,resourceZip){
  if(typeof root!=='string'||!path.isAbsolute(root))
    throw Error('An absolute local Git checkout root is required.');
  assertCandidateTreeUnadopted(root);
  const matched=await verifyPairedArchives(root,drafts,receipt,pageZip,resourceZip);
  if(!matched.pairCompleteForReview||matched.finalGitHubPackage!==false)
    throw Error('The two private review archives do not form one reviewed plan.');
  const before=verifyCheckout(root,receipt.reviewedGitCommit);
  if(before.fingerprintSha256!==receipt.checkoutFingerprintSha256)
    throw Error('Checkout differs from the approved reviewed source.');
  const originals=new Map(TRACKED.map(name=>{
    const sourceFile=path.join(root,...name.split('/'));
    const stat=fs.lstatSync(sourceFile);
    if(!stat.isFile()||stat.isSymbolicLink())
      throw Error('An original website file is not a safe tracked source.');
    return [name,fs.readFileSync(sourceFile)];
  }));
  const original=originals.get('site-content.html');
  if(sha(original)!==ORIGINAL)throw Error('Original custom website SHA-256 differs.');
  const resources=await planChangeSet(original,drafts.resources);
  const pages=planPages(root,drafts.pages);
  if(pages.changed.length!==matched.existingPageChanges||
     resources.fragments.size!==matched.proposedResourceChanges)
    throw Error('Combined candidate path counts differ from the paired review.');
  // Decode the VERIFIED INPUT ARCHIVES, not a freshly fabricated replacement.
  // The pairing verifier already proved every byte matches the same receipt.
  const pageFiles=new Map(decode(pageZip,new Set([
    PAGE_MANIFEST,PAGE_GUIDE,...pages.changed.map(item=>item.path)
  ])).entries.map(item=>[item.name,item.bytes]));
  const resourceFiles=new Map(decode(resourceZip,new Set([
    RESOURCE_MANIFEST,RESOURCE_README,RESOURCE_PREVIEW,
    ...[...resources.fragments.keys()].map(reviewPath)
  ])).entries.map(item=>[item.name,item.bytes]));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-unified-source-rehearsal-'));
  fs.chmodSync(temp,0o700);
  let staged,rolledBack;
  try{
    // Initial tree is deliberately verified BEFORE other paths are added.
    writeCandidate(temp,original,resources);
    // Apply resource fragments FROM the reviewed ZIP to their proposed paths.
    for(const index of resources.fragments.keys()){
      const reviewed=resourceFiles.get(reviewPath(index));
      if(!reviewed)throw Error('Missing reviewed resource ZIP fragment.');
      writeFile(temp,resourcePath(index),reviewed,true);
    }
    const candidateProof=verifyCandidate(temp,original,resources);
    if(!candidateProof.intendedSourceByteIdentical)
      throw Error('Candidate resource ZIP fragments failed the source-tree check.');
    for(const [relative,bytes] of originals)writeFile(temp,relative,bytes);
    // Apply existing-path pages and compatibility HTML FROM the reviewed ZIPs.
    for(const change of pages.changed){
      const reviewed=pageFiles.get(change.path);
      if(!reviewed)throw Error('Missing reviewed page ZIP entry.');
      writeFile(temp,change.path,reviewed,true);
    }
    const reviewedPreview=resourceFiles.get(RESOURCE_PREVIEW);
    if(!reviewedPreview)throw Error('Missing reviewed full compatibility preview.');
    writeFile(temp,'site-content.html',reviewedPreview,true);
    staged=verifyAssembled(temp,{root},resources,pages,resources.expected);
    rolledBack=restoreOriginal(temp,originals);
    if(!rolledBack.originalTrackedFilesByteExact||
       !rolledBack.originalResourceSourceRestored||
       !rolledBack.candidateTreeRemoved)
      throw Error('Candidate integrated source tree rollback was incomplete.');
  }finally{
    fs.rmSync(temp,{recursive:true,force:true});
  }
  if(fs.existsSync(temp))throw Error('Isolated candidate workspace was not deleted.');
  const after=verifyCheckout(root,receipt.reviewedGitCommit);
  if(after.fingerprintSha256!==before.fingerprintSha256)
    throw Error('Real Git checkout changed during rehearsal.');
  return {
    format:'naxx-unified-sparse-source-rehearsal-v1',
    reviewedGitCommit:receipt.reviewedGitCommit,
    sameReviewReceipt:true,
    stagedFileCount:staged.fileCount,
    sourceTreeFiles:staged.candidateResourceFiles,
    existingTrackedFiles:staged.trackedCompatibilityFiles,
    changedPages:pages.changed.length,
    changedResourceFragments:resources.fragments.size,
    generatedCompatibilitySha256:staged.stagedSourceSha256,
    exactCompatibilityRebuild:staged.exactCompatibilityRebuild,
    allResourceBytesVerified:staged.allResourceBytesVerified,
    customSourceLayoutUnchanged:staged.customSourceLayoutUnchanged,
    rootLoaderUnchanged:staged.rootLoaderUnchanged,
    allEditedPagesVerified:staged.exactEditedPagesVerified,
    rollbackExact:rolledBack.originalTrackedFilesByteExact,
    originalSiteRestored:rolledBack.originalResourceSourceRestored,
    candidateTreeRemoved:rolledBack.candidateTreeRemoved,
    temporaryFilesDeleted:true,
    realGitCheckoutUnchanged:true,
    browserReadyFullSite:false,
    completeRepositoryBackup:false,
    adoptedSourceTree:false,
    candidateOnly:true,githubReady:false,publishable:false,deployable:false,
    ownerApproved:false,repositoryFilesWritten:0
  };
}
if(require.main===module){
  process.stderr.write('Private unified candidate workspace only; not a deployer or GitHub export.\n');
}
module.exports={TRACKED,SPARSE_COUNT,assertCandidateTreeUnadopted,verifyAssembled,rehearseUnified};

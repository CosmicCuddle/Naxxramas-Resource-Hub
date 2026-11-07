'use strict';
/*
 * PRIVATE COMPLETE-SITE SNAPSHOT REHEARSAL — NEVER A RELEASE TOOL.
 *
 * Starting with exact paired private page/resource ZIPs and one reviewed Git
 * commit, copies every tracked website file into an isolated temporary folder.
 * It applies the reviewed changes and proposed resource tree ONLY to that
 * folder, checks every unchanged asset byte, then deletes both temp trees.
 * No Git metadata, ignored files, private output archive, browser execution,
 * application submission, repository write, or deployment.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {safeRel,inventory}=require('./audit-full-checkout.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {assertCandidateTreeUnadopted}=require('./rehearse-unified-source-layout.cjs');
const {verifyPairedArchives}=require('./verify-paired-editor-archives.cjs');
const {PAGES,NAV,plan:planPages}=require('./plan-page-draft.cjs');
const {planChangeSet}=require('./rehearse-resource-change-set.cjs');
const {ROOT,expectedPaths,writeCandidate,verifyCandidate,resourcePath}=
  require('./rehearse-proposed-resource-tree.cjs');
const {decode}=require('./private-source-zip.cjs');
const {MANIFEST:PAGE_MANIFEST,GUIDE:PAGE_GUIDE}=
  require('./package-reviewed-page-update.cjs');
const {MANIFEST:RESOURCE_MANIFEST,README:RESOURCE_README,
  PREVIEW:RESOURCE_PREVIEW,reviewPath}=
  require('./package-reviewed-resource-preview.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function trackedPaths(root){
  const result=cp.spawnSync('git',['ls-files','-z'],{
    cwd:root,encoding:'utf8',timeout:20000,
    maxBuffer:10*1024*1024,stdio:['ignore','pipe','pipe']
  });
  if(result.error||result.status!==0)throw Error('Clean tracked Git path list unavailable.');
  const names=result.stdout.split('\0').filter(Boolean);
  if(!names.length)throw Error('No tracked website files found.');
  const seen=new Set();
  for(const rel of names){
    if(!safeRel(rel)||seen.has(rel.toLowerCase())||
       rel===ROOT||rel.startsWith(ROOT+'/'))
      throw Error('Unsafe, duplicated or previously adopted tracked source path.');
    seen.add(rel.toLowerCase());
  }
  return names;
}
function safeTrackedSource(root,relative){
  if(!safeRel(relative))throw Error('Unsafe source path.');
  let current=root;
  for(const segment of relative.split('/').slice(0,-1)){
    current=path.join(current,segment);
    const stat=fs.lstatSync(current);
    if(!stat.isDirectory()||stat.isSymbolicLink())
      throw Error('Unsafe source parent directory.');
  }
  const file=path.join(root,...relative.split('/'));
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())
    throw Error('Expected regular tracked website file.');
  return file;
}
function outputPath(root,relative){
  if(!safeRel(relative))throw Error('Unsafe temporary website path.');
  return path.join(root,...relative.split('/'));
}
function writeNew(root,relative,bytes){
  if(!Buffer.isBuffer(bytes))throw Error('Temporary content must be bytes.');
  const file=outputPath(root,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});
}
function overwriteExisting(root,relative,bytes){
  const file=outputPath(root,relative),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())
    throw Error('Temporary overwrite must target an existing regular file.');
  fs.writeFileSync(file,bytes,{flag:'w',mode:0o600});
}
function listFiles(root){
  const found=[];
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,entry.name);
      const stat=fs.lstatSync(file);
      if(stat.isSymbolicLink())throw Error('A temporary preview cannot contain symlinks.');
      if(stat.isDirectory())walk(file);
      else if(stat.isFile())found.push(path.relative(root,file).split(path.sep).join('/'));
      else throw Error('Unsafe temporary preview file type.');
    }
  }
  walk(root);
  return found;
}
function copyTracked(root,siteRoot,names){
  for(const relative of names){
    writeNew(siteRoot,relative,fs.readFileSync(safeTrackedSource(root,relative)));
  }
  return inventory(siteRoot,names);
}
async function rehearseCompleteSnapshot(root,drafts,receipt,pageZip,resourceZip,inspectTemp=null){
  if(typeof root!=='string'||!path.isAbsolute(root))
    throw Error('An absolute local Git checkout root is required.');
  assertCandidateTreeUnadopted(root);
  const paired=await verifyPairedArchives(root,drafts,receipt,pageZip,resourceZip);
  if(paired.pairCompleteForReview!==true||paired.finalGitHubPackage!==false)
    throw Error('An exact private, non-deployable review pair is required.');
  const before=verifyCheckout(root,receipt.reviewedGitCommit);
  if(before.fingerprintSha256!==receipt.checkoutFingerprintSha256)
    throw Error('Reviewed complete Git checkout fingerprint changed.');
  const names=trackedPaths(root);
  const original=fs.readFileSync(safeTrackedSource(root,'site-content.html'));
  const pagePlan=planPages(root,drafts.pages);
  const resourcePlan=await planChangeSet(original,drafts.resources);
  if(pagePlan.changed.length!==paired.existingPageChanges||
     resourcePlan.fragments.size!==paired.proposedResourceChanges)
    throw Error('Reviewed edit counts changed before complete snapshot staging.');
  const pageEntries=new Map(decode(pageZip,new Set([
    PAGE_MANIFEST,PAGE_GUIDE,...pagePlan.changed.map(x=>x.path)
  ])).entries.map(x=>[x.name,x.bytes]));
  const resourceEntries=new Map(decode(resourceZip,new Set([
    RESOURCE_MANIFEST,RESOURCE_README,RESOURCE_PREVIEW,
    ...[...resourcePlan.fragments.keys()].map(reviewPath)
  ])).entries.map(x=>[x.name,x.bytes]));
  const preview=resourceEntries.get(RESOURCE_PREVIEW);
  if(!preview||!preview.equals(resourcePlan.expected))
    throw Error('Reviewed compatibility preview does not match planned resource bytes.');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-full-site-preview-'));
  fs.chmodSync(tmp,0o700);
  const site=path.join(tmp,'site'),resourceTree=path.join(tmp,'source');
  let report,inspection=null;
  try{
    fs.mkdirSync(site,{mode:0o700});
    fs.mkdirSync(resourceTree,{mode:0o700});
    const copied=copyTracked(root,site,names);
    if(copied.fingerprintSha256!==before.fingerprintSha256||
       copied.trackedFiles!==before.trackedFiles)
      throw Error('Complete copied Git snapshot differs from reviewed original.');
    writeCandidate(resourceTree,original,resourcePlan);
    const verified=verifyCandidate(resourceTree,original,resourcePlan);
    if(!verified.intendedSourceByteIdentical)
      throw Error('Temporary source fragments cannot reconstruct the reviewed source.');
    for(const relative of expectedPaths()){
      writeNew(site,relative,fs.readFileSync(outputPath(resourceTree,relative)));
    }
    for(const [index] of resourcePlan.fragments){
      const bytes=resourceEntries.get(reviewPath(index));
      if(!bytes||!bytes.equals(fs.readFileSync(outputPath(site,resourcePath(index)))))
        throw Error('Staged resource fragment does not match its exact reviewed ZIP entry.');
    }
    const changed=new Map();
    for(const entry of pagePlan.changed){
      if(!names.includes(entry.path))
        throw Error('Edited page is not an original tracked Git path.');
      const bytes=pageEntries.get(entry.path);
      if(!bytes||!bytes.equals(entry.bytes))
        throw Error('Reviewed page ZIP bytes differ from source-bound edit plan.');
      overwriteExisting(site,entry.path,bytes);
      changed.set(entry.path,bytes);
    }
    if(!names.includes('site-content.html')||!names.includes('index.html'))
      throw Error('Original website loader and compatibility source must be tracked.');
    overwriteExisting(site,'site-content.html',preview);
    changed.set('site-content.html',preview);
    const stagedNames=listFiles(site);
    const expectedNames=new Set([...names,...expectedPaths()]);
    if(stagedNames.length!==expectedNames.size||
       stagedNames.some(x=>!expectedNames.has(x)))
      throw Error('Complete preview has missing, unexpected or duplicate files.');
    let preserved=0;
    for(const relative of names){
      const bytes=fs.readFileSync(outputPath(site,relative));
      const planned=changed.get(relative);
      if(planned){
        if(!bytes.equals(planned))throw Error('Edited source differs in complete snapshot.');
      }else{
        if(!bytes.equals(fs.readFileSync(safeTrackedSource(root,relative))))
          throw Error('An unrelated original tracked asset was changed.');
        preserved++;
      }
    }
    if(!fs.readFileSync(outputPath(site,'index.html')).equals(
       fs.readFileSync(safeTrackedSource(root,'index.html'))))
      throw Error('Protected root website loader changed.');
    // This is a verified candidate, not a browser-ready or deployable website.
    // A trusted QA-only callback may view it before deletion. Re-hash EVERY file
    // afterward so a browser test cannot silently alter the candidate.
    const stagedProof=new Map(stagedNames.map(rel=>[
      rel,sha(fs.readFileSync(outputPath(site,rel)))
    ]));
    if(inspectTemp!==null){
      if(typeof inspectTemp!=='function')
        throw Error('Preview inspector must be an explicit local QA function.');
      inspection=await inspectTemp(site);
      if(!inspection||inspection.safeLocalBrowserCheck!==true||
         inspection.formSubmissions!==0||
         inspection.nonLocalResponses!==0||
         inspection.pass!==true)
        throw Error('The private browser check did not satisfy isolation gates.');
      const afterNames=listFiles(site);
      if(afterNames.length!==stagedProof.size||
         afterNames.some(rel=>!stagedProof.has(rel)||
           sha(fs.readFileSync(outputPath(site,rel)))!==stagedProof.get(rel)))
        throw Error('The private browser inspection changed staged website files.');
    }
    report={
      format:'naxx-private-complete-site-snapshot-rehearsal-v1',
      reviewedGitCommit:receipt.reviewedGitCommit,
      allOriginalTrackedFilesCopied:true,
      originalTrackedFiles:names.length,
      sourceTreeFiles:expectedPaths().size,
      completeTemporaryFileCount:stagedNames.length,
      changedExistingFiles:changed.size,
      unchangedTrackedFilesByteExact:preserved,
      changedResourceFragments:resourcePlan.fragments.size,
      completeResourceCompatibilitySha256:sha(preview),
      completeSourceRebuildExact:true,
      originalLoaderByteExact:true,
      sourceDataOrFilenamesPrinted:false,
      browserTested:inspection!==null,
      browserInspection:inspection,
      stagedFilesUnchangedAfterInspection:true,
      activeFormsOrExternalRequests:false,
      ownerApproved:false,githubReady:false,publishable:false,deployable:false,
      completeGitHistoryBackup:false,candidateSourceTreeAdopted:false,
      repositoryFilesWritten:0
    };
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
  }
  if(fs.existsSync(tmp))throw Error('Private complete-site snapshot was not deleted.');
  const after=verifyCheckout(root,receipt.reviewedGitCommit);
  if(after.fingerprintSha256!==before.fingerprintSha256)
    throw Error('Real checkout changed during isolated preview preparation.');
  return {...report,temporaryPreviewDeleted:true,realGitCheckoutUnchanged:true};
}
if(require.main===module)
  process.stderr.write('Library-only private complete-site snapshot rehearsal: not a deployer.\n');
module.exports={trackedPaths,safeTrackedSource,copyTracked,rehearseCompleteSnapshot};

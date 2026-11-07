'use strict';
/*
 * ORIGINAL BROWSER REVIEW ZIP -> ONE READ-ONLY SOURCE CHANGE PLAN.
 *
 * Uses exactly the existing local editor's ZIP reader and draft validators.
 * Rechecks actual clean Git checkout, 4 page files/navigation and the original
 * SHA-pinned 414-resource HTML before returning a *metadata-only* plan.
 *
 * No ZIP extraction, repository files written, Git objects created, GitHub
 * requests, ref movement, chosen migration layout, merge or publication.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const vm=require('node:vm');
const {verifyCheckout,planMixed}=require('./plan-mixed-editor-update.cjs');
const zipReader=require('../review-package-reader.js');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FORMAT='naxx-private-browser-zip-to-git-review-v1';
const EXPECTED_COMMIT=/^[a-f0-9]{40}$/;
function validatePath(input,kind){
  if(typeof input!=='string'||!path.isAbsolute(input))
    throw Error('An absolute '+kind+' path is required.');
  return fs.realpathSync(input);
}
function privateZip(checkout,archive){
  const root=validatePath(checkout,'checkout');
  const file=validatePath(archive,'private ZIP');
  const relative=path.relative(root,file);
  if(relative===''||(!relative.startsWith('..'+path.sep)&&
     relative!=='..'&&!path.isAbsolute(relative)))
    throw Error('The private review ZIP must be outside the Git checkout.');
  const stat=fs.lstatSync(archive);
  if(!stat.isFile()||stat.isSymbolicLink()||
     stat.size<22||stat.size>zipReader.MAX_ARCHIVE)
    throw Error('Private review ZIP is unsafe or too large.');
  return {root,file,bytes:fs.readFileSync(file)};
}
function draftValidators(){
  // Reuse the exact review-package validators from the browser editor.
  // The script only registers its API when the document has no button.
  const source=fs.readFileSync(path.resolve(__dirname,'..','review-package.js'),'utf8');
  const sandbox={TextEncoder,Blob,Uint8Array,document:{getElementById(){return null;}}};
  vm.runInNewContext(source,sandbox,{filename:'review-package.js',timeout:5000});
  const validator=sandbox.NaxxEditorReview;
  if(!validator||typeof validator.validatePageDraft!=='function'||
     typeof validator.validateResourceDraft!=='function')
    throw Error('Private editor draft validator unavailable.');
  return validator;
}
async function inspectArchive(bytes){
  const validator=draftValidators();
  const zipTools={sha256:async text=>sha(Buffer.from(text,'utf8'))};
  const result=await zipReader.inspect(new Uint8Array(bytes),zipTools,validator);
  if(result.githubReady!==false||result.canApply!==false||
     result.canPublish!==false||result.websiteFilesVerified!==false)
    throw Error('Private ZIP tried to claim unapproved source privileges.');
  return result;
}
async function planFromReviewZip(checkout,archiveBytes,expectedCommit){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !EXPECTED_COMMIT.test(expectedCommit||'')||
     !Buffer.isBuffer(archiveBytes)||archiveBytes.length<22||
     archiveBytes.length>zipReader.MAX_ARCHIVE)
    throw Error('Verified checkout, exact Git commit and private archive are required.');
  const before=verifyCheckout(checkout,expectedCommit);
  const reviewed=await inspectArchive(archiveBytes);
  const drafts={
    pages:reviewed.hasPageDraft?JSON.parse(reviewed.pageDraftText):null,
    resources:reviewed.hasResourceDraft?JSON.parse(reviewed.resourceDraftText):null,
    expectedCommit
  };
  // planMixed checks real page/nav/source content and uses OS-temporary
  // candidate resources, never a Git-ready source write or release.
  const plan=await planMixed(checkout,drafts);
  const after=verifyCheckout(checkout,expectedCommit);
  if(before.fingerprintSha256!==after.fingerprintSha256||
     plan.checkedOutSourceFingerprint!==before.fingerprintSha256||
     plan.commit!==expectedCommit||plan.noRepositoryFilesWritten!==true||
     plan.publishable!==false||plan.deployable!==false||
     plan.githubReady!==false||plan.resourceRollbackExact===false)
    throw Error('Checkout changed or the mixed source plan was unsafe.');
  const changed=[
    ...plan.changedExistingPagePaths.map(f=>({
      path:f.path,kind:'tracked-page-or-navigation',trackedInGit:true,
      oldSha256:f.sourceSha256,newSha256:f.nextSha256
    })),
    ...plan.changedCandidateResourcePaths.map(f=>({
      path:f.path,kind:'unapproved-resource-candidate',trackedInGit:false,
      oldSha256:f.sourceSha256,newSha256:f.nextSha256
    }))
  ];
  const proposed=new Set(changed.map(f=>f.path));
  if(proposed.size!==changed.length||
     changed.some(f=>f.path==='index.html')||
     changed.length!==plan.changedPathsTotal)
    throw Error('Combined review has duplicated or protected Git paths.');
  return Object.freeze({
    format:FORMAT,reviewOnly:true,gitHubReady:false,
    inputPrivateZipSha256:sha(archiveBytes),
    expectedGitCommit:expectedCommit,
    cleanGitCheckoutBeforeAndAfter:true,
    existingPageAndNavigationChanges:plan.changedExistingPagePaths.length,
    proposedResourceChanges:plan.changedCandidateResourcePaths.length,
    changedPathsTotal:changed.length,
    checkedResourceCount:414,
    originalResourceRuntimeSha256:plan.originalSiteSha256,
    proposedCompatibilitySha256:plan.plannedGeneratedSiteSha256,
    compatibilityReconstructionVerified:plan.resourceRebuildExact===true||
      (!drafts.resources&&plan.resourceRebuildExact===null),
    resourceCandidateRollbackVerified:plan.resourceRollbackExact===true||
      (!drafts.resources&&plan.resourceRollbackExact===null),
    reviewedBrowserPageDraft:reviewed.hasPageDraft,
    reviewedBrowserResourceDraft:reviewed.hasResourceDraft,
    proposedPaths:Object.freeze(changed.map(x=>Object.freeze(x))),
    proposedResourceLayoutUnapproved:true,
    gitDraftAuthorshipVerified:false,sourceLayoutSelected:false,
    completeRepositoryBackup:false,realAdminSaveVerified:false,
    completeWebsiteReadyForPublication:false,
    realGitHubAtomicWriteVerified:false,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    repositoryFilesWritten:0,gitHubWrites:0,
    textOrResourceValuesPrinted:false
  });
}
async function reviewSavedZip(checkout,archive,expectedCommit){
  const selected=privateZip(checkout,archive);
  const result=await planFromReviewZip(selected.root,selected.bytes,expectedCommit);
  const after=privateZip(checkout,archive);
  if(after.file!==selected.file||sha(after.bytes)!==sha(selected.bytes))
    throw Error('Private combined review ZIP changed during source review.');
  return result;
}
function parseArgs(args){
  if(!Array.isArray(args)||args.length!==6)throw Error('Require three named arguments.');
  const allowed=new Set(['--checkout','--zip','--commit']),seen={};
  for(let i=0;i<args.length;i+=2){
    if(!allowed.has(args[i])||Object.hasOwn(seen,args[i])||
       typeof args[i+1]!=='string'||!args[i+1])
      throw Error('Unknown or duplicated review option.');
    seen[args[i]]=args[i+1];
  }
  if(allowed.size!==Object.keys(seen).length)throw Error('Missing review option.');
  return {checkout:seen['--checkout'],archive:seen['--zip'],
    expectedCommit:seen['--commit']};
}
if(require.main===module){
  (async()=>{
    const args=parseArgs(process.argv.slice(2));
    const result=await reviewSavedZip(args.checkout,args.archive,args.expectedCommit);
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  })().catch(()=>{
    // Avoid printing private paths, draft text, source HTML or credentials.
    process.stderr.write('Private combined source review refused; no repository files were changed by this tool.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({FORMAT,parseArgs,privateZip,inspectArchive,
  planFromReviewZip,reviewSavedZip});

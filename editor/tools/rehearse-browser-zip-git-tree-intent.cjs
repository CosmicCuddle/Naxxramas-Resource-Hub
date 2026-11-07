'use strict';
/*
 * PRIVATE GIT TREE INTENT FROM A REAL BROWSER REVIEW ZIP — NO GIT WRITES.
 *
 * Works inside the existing byte-exact complete tracked-site rollback proof.
 * Reconstructs Git SHA-1 blob and tree object identities in memory. Verifies
 * the baseline tree is EXACTLY the reviewed Git commit's tree before deriving
 * a metadata-only candidate tree. Does not write Git objects or approve
 * the unselected 415-source layout, authenticated Save, or deployment.
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto');
const {withFullSiteRollback,read}=
  require('./rehearse-browser-zip-full-site-rollback.cjs');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {filePaths,ROOT,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const {PAGES,NAV}=require('./plan-page-draft.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const {safeRel}=require('./audit-full-checkout.cjs');
const FORMAT='naxx-private-git-tree-intent-from-browser-zip-v1';
const SHA40=/^[0-9a-f]{40}$/,NORMAL=/^100(?:644|755)$/;
const sourcePaths=filePaths(),allowedTracked=new Set([...PAGES,NAV,RUNTIME]);
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function git(root,args){
  return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',
    stdio:['ignore','pipe','pipe'],maxBuffer:20*1024*1024,timeout:30000}).trim();
}
function gitBlobOid(bytes){
  if(!Buffer.isBuffer(bytes))throw Error('Git object bytes must be a Buffer.');
  const h=crypto.createHash('sha1');
  h.update('blob '+bytes.length+'\0','utf8');
  h.update(bytes);
  return h.digest('hex');
}
function treeOid(files){
  if(!Array.isArray(files)||!files.length)
    throw Error('An exact nonempty Git tree path inventory is required.');
  const root={files:new Map(),dirs:new Map()};
  const pathSeen=new Set();
  for(const f of files){
    if(!f||typeof f!=='object'||!safeRel(f.path)||
       !NORMAL.test(f.mode||'')||!SHA40.test(f.oid||'')||
       pathSeen.has(f.path.toLowerCase()))
      throw Error('Unsafe, duplicated or invalid Git tree file identity.');
    pathSeen.add(f.path.toLowerCase());
    let parent=root;
    const names=f.path.split('/');
    for(const component of names.slice(0,-1)){
      if(parent.files.has(component))
        throw Error('Git tree contains a file/directory path collision.');
      if(!parent.dirs.has(component))
        parent.dirs.set(component,{files:new Map(),dirs:new Map()});
      parent=parent.dirs.get(component);
    }
    const leaf=names[names.length-1];
    if(parent.files.has(leaf)||parent.dirs.has(leaf))
      throw Error('Git tree contains duplicate or colliding paths.');
    parent.files.set(leaf,{mode:f.mode,oid:f.oid});
  }
  function encode(node){
    const entries=[
      ...[...node.files].map(([name,val])=>({
        name,sort:name,mode:val.mode,oid:val.oid
      })),
      ...[...node.dirs].map(([name,child])=>({
        name,sort:name+'/',mode:'40000',oid:encode(child)
      }))
    ].sort((a,b)=>Buffer.compare(Buffer.from(a.sort),Buffer.from(b.sort)));
    const records=entries.map(item=>Buffer.concat([
      Buffer.from(item.mode+' '+item.name+'\0','utf8'),
      Buffer.from(item.oid,'hex')
    ]));
    const body=Buffer.concat(records);
    const h=crypto.createHash('sha1');
    h.update('tree '+body.length+'\0','utf8');
    h.update(body);
    return h.digest('hex');
  }
  return encode(root);
}
function gitTreeInventory(checkout,commit){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !SHA40.test(commit||''))
    throw Error('An exact checkout and reviewed Git SHA-1 commit are required.');
  if(git(checkout,['rev-parse','--show-object-format'])!=='sha1')
    throw Error('This private Git tree proof only supports SHA-1 Git repositories.');
  const output=cp.execFileSync('git',['ls-tree','-r','-z',commit],{
    cwd:checkout,encoding:'buffer',stdio:['ignore','pipe','pipe'],
    timeout:30000,maxBuffer:20*1024*1024
  });
  const files=[];
  const seen=new Set();
  for(const line of output.toString('utf8').split('\0').filter(Boolean)){
    const match=/^(100644|100755) blob ([0-9a-f]{40})\t([^\0]+)$/.exec(line);
    if(!match||!safeRel(match[3])||seen.has(match[3].toLowerCase()))
      throw Error('Reviewed Git commit contains unsafe or unsupported tracked content.');
    seen.add(match[3].toLowerCase());
    files.push({path:match[3],mode:match[1],oid:match[2]});
  }
  if(!files.length)throw Error('Reviewed Git tree has no tracked files.');
  const expected=git(checkout,['rev-parse',commit+'^{tree}']);
  if(treeOid(files)!==expected)
    throw Error('Independently reconstructed original Git tree disagrees with HEAD.');
  return Object.freeze({files,treeOid:expected});
}
function deriveIntent(checkout,site,stage,trackedNames,changeSet,commit){
  if(!Array.isArray(trackedNames)||!(changeSet instanceof Set)||
     !changeSet.has(RUNTIME)||
     [...changeSet].some(p=>!allowedTracked.has(p))||
     changeSet.size<2||changeSet.size>6)
    throw Error('Unexpected changed paths in private browser review.');
  const original=gitTreeInventory(checkout,commit);
  const byName=new Map(original.files.map(file=>[file.path,file]));
  if(trackedNames.length!==byName.size||
     trackedNames.some(p=>!byName.has(p))||
     [...changeSet].some(p=>!byName.has(p)))
    throw Error('Changed or tracked source paths differ from the actual Git tree.');
  const proposed=[],changes=[];
  let unchanged=0;
  for(const originalFile of original.files){
    const relative=originalFile.path;
    const old=read(checkout,relative),now=read(site,relative);
    if(gitBlobOid(old)!==originalFile.oid)
      throw Error('Actual tracked website bytes differ from their original Git blob.');
    const newId=gitBlobOid(now);
    if(changeSet.has(relative)){
      if(!now.equals(read(stage,relative))||newId===originalFile.oid)
        throw Error('Changed source file does not match the exact reviewed candidate.');
      changes.push({
        path:relative,mode:originalFile.mode,
        oldGitBlobOid:originalFile.oid,newGitBlobOid:newId,
        newSha256:digest(now)
      });
    }else{
      if(newId!==originalFile.oid||!now.equals(old))
        throw Error('Untouched Git-tracked file was modified.');
      unchanged++;
    }
    proposed.push({
      path:relative,mode:originalFile.mode,oid:newId
    });
  }
  const existing=new Set(original.files.map(f=>f.path));
  if([...existing].some(f=>f===ROOT||f.startsWith(ROOT+'/')))
    throw Error('The proposed resource source tree collides with original Git paths.');
  const newFiles=[];
  for(const relative of sourcePaths){
    if(existing.has(relative))
      throw Error('A resource candidate path is already tracked by Git.');
    const bytes=read(site,relative);
    if(!bytes.equals(read(stage,relative)))
      throw Error('Proposed resource source bytes differ from verified staging.');
    const oid=gitBlobOid(bytes);
    proposed.push({path:relative,mode:'100644',oid});
    newFiles.push({path:relative,mode:'100644',oid});
  }
  if(newFiles.length!==COUNT+1||unchanged!==original.files.length-changeSet.size||
     changes.length!==changeSet.size||
     proposed.length!==original.files.length+COUNT+1)
    throw Error('Complete proposed Git path inventory differs from source proof.');
  const nextTree=treeOid(proposed);
  if(nextTree===original.treeOid)
    throw Error('Proposed Git tree did not change.');
  const ordered=proposed.slice().sort((a,b)=>a.path.localeCompare(b.path));
  const pathDigest=digest(Buffer.from(ordered.map(f=>
    [f.mode,f.oid,f.path].join('\t')+'\n').join(''),'utf8'));
  return Object.freeze({
    format:FORMAT,
    reviewedGitCommit:commit,
    originalTreeOid:original.treeOid,
    proposedTreeOidCalculatedInMemory:nextTree,
    fullProposedPathDigestSha256:pathDigest,
    originalGitBlobsVerified:original.files.length,
    changedExistingGitBlobs:changes.length,
    unchangedTrackedGitBlobsPreserved:unchanged,
    newOverlayGitBlobs:newFiles.length,
    totalProposedGitFiles:proposed.length,
    allOriginalFileModesPreserved:true,
    newCandidateFilesRegularMode100644:true,
    completeResourceCount:COUNT,
    changedPaths:changes.map(item=>Object.freeze(item)),
    allGitBlobOidsCalculatedWithoutWrites:true,
    proposedTreeIdentityIndependentlyReconstructible:true,
    sourceLayoutOwnerApproved:false,
    realGitCommitObjectCreated:false,
    authenticatedSaveVerified:false,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    originalRepositoryFilesWritten:0,gitHubWrites:0,
    sourceValuesPrinted:false
  });
}
async function reviewBrowserGitTree(checkout,zip,commit,inspect=null){
  if(inspect!==null&&typeof inspect!=='function')
    throw Error('Only explicit private inspector callbacks are supported.');
  const before=verifyCheckout(checkout,commit);
  let intent;
  const report=await withFullSiteRollback(checkout,zip,commit,async view=>{
    view.verifyBackup();
    view.verifyStaged();
    intent=deriveIntent(checkout,view.site,view.stage,
      view.trackedNames,view.changeSet,commit);
    if(inspect)await inspect(Object.freeze({
      site:view.site,stage:view.stage,proof:intent,
      rerun:()=>deriveIntent(checkout,view.site,view.stage,
        view.trackedNames,view.changeSet,commit)
    }));
    const repeat=deriveIntent(checkout,view.site,view.stage,
      view.trackedNames,view.changeSet,commit);
    if(repeat.proposedTreeOidCalculatedInMemory!==
       intent.proposedTreeOidCalculatedInMemory||
       repeat.fullProposedPathDigestSha256!==intent.fullProposedPathDigestSha256)
      throw Error('Proposed Git tree changed during private review.');
  });
  if(!report.privateRollbackExact||
     !report.allTemporarySiteCopiesDeleted||
     !report.originalRepositoryCheckoutUnchanged)
    throw Error('Temporary original-site restoration did not finish.');
  const after=verifyCheckout(checkout,commit);
  if(before.fingerprintSha256!==after.fingerprintSha256)
    throw Error('Actual Git checkout changed during the read-only tree proof.');
  return Object.freeze({
    ...intent,
    completeTrackedWebsiteRecovered:true,
    temporaryCandidateDeleted:true,
    reviewedOriginalGitCheckoutUnchanged:true
  });
}
module.exports=Object.freeze({
  FORMAT,gitBlobOid,treeOid,gitTreeInventory,deriveIntent,reviewBrowserGitTree
});

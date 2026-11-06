'use strict';
/* PRIVATE GENERATION-SWITCH REHEARSAL: OS-temp only; NOT GitHub Save,
 * cross-process CAS, power-loss guarantee or deployable editor. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const {MANIFEST,COUNT,recordPath}=require('./rehearse-resource-only-overlay.cjs');
const {verify,draftFrom,withTemporaryVersions}=
  require('./rehearse-versioned-resource-sessions.cjs');
const {withReviewedPackage}=require('./rehearse-reviewed-source-package.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const FORMAT='naxx-private-generation-switch-rehearsal-v1';
const POINTER='CURRENT.json',NAME=/^g[01]$/;
const keys=(object,names)=>!!object&&typeof object==='object'&&
  !Array.isArray(object)&&
  Object.keys(object).sort().join(',')===names.slice().sort().join(',');
function checkedName(name){
  if(!NAME.test(name))throw Error('Unexpected private generation name.');
  return name;
}
const rootOf=(root,name)=>path.join(root,checkedName(name));
const sourceOf=(root,name)=>path.join(rootOf(root,name),'source');
const runtimeOf=(root,name)=>path.join(rootOf(root,name),RUNTIME);
function regular(file){
  const st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink())
    throw Error('Private generation file is unsafe.');
  return fs.readFileSync(file);
}
function verifyGeneration(root,name,original){
  const folder=rootOf(root,name),entries=fs.readdirSync(folder).sort();
  if(entries.join(',')!=='site-content.html,source')
    throw Error('Private generation has missing or unexpected files.');
  const source=sourceOf(root,name),stat=fs.lstatSync(source);
  if(!stat.isDirectory()||stat.isSymbolicLink())
    throw Error('Private generation source directory is unsafe.');
  const checked=verify(source,original),runtime=regular(runtimeOf(root,name));
  const rebuilt=restoreInMemory(checked.split,checked.records);
  if(!runtime.equals(rebuilt)||sha(runtime)!==checked.manifest.sourceSha256||
     runtime.length!==checked.manifest.sourceBytes)
    throw Error('Private generation runtime and 414 fragments disagree.');
  return Object.freeze({revision:checked.manifest.revision,
    sourceSha256:checked.manifest.sourceSha256,
    parentSha256:checked.manifest.parentSha256,
    resourcesVerified:checked.records.length,htmlBytes:runtime.length});
}
function marker(name,result){
  return {format:FORMAT,generation:name,revision:result.revision,
    sourceSha256:result.sourceSha256};
}
function writeMarker(root,name,result){
  // Same-directory rename is NOT a server-enforced GitHub compare-and-swap.
  const contents=JSON.stringify(marker(name,result))+'\n';
  const file=path.join(root,POINTER),temp=path.join(root,'.CURRENT.next');
  fs.writeFileSync(temp,contents,{flag:'wx',mode:0o600});
  try{fs.renameSync(temp,file);}
  finally{if(fs.existsSync(temp))fs.rmSync(temp);}
}
function readMarker(root){
  const bytes=regular(path.join(root,POINTER));
  if(bytes.length>512||bytes.length===0)
    throw Error('Private active-generation pointer size is unsafe.');
  const value=JSON.parse(bytes.toString('utf8'));
  if(!keys(value,['format','generation','revision','sourceSha256'])||
     value.format!==FORMAT||!NAME.test(value.generation)||
     !Number.isSafeInteger(value.revision)||value.revision<0||
     !/^[a-f0-9]{64}$/.test(value.sourceSha256))
    throw Error('Private active-generation pointer is invalid.');
  return value;
}
function verifyActive(root,original){
  const current=readMarker(root);
  const checked=verifyGeneration(root,current.generation,original);
  if(checked.revision!==current.revision||
     checked.sourceSha256!==current.sourceSha256)
    throw Error('Active-generation pointer does not match verified files.');
  return Object.freeze({...current,resourcesVerified:checked.resourcesVerified});
}
function activate(root,original,expectedGeneration,{interrupt=null}={}){
  if(expectedGeneration!=='g0'||
     ![null,'before-pointer','after-pointer'].includes(interrupt))
    throw Error('Only the fictional old-generation transition is allowed.');
  const active=verifyActive(root,original);
  if(active.generation!==expectedGeneration)
    throw Error('Stale private generation: another activation already won.');
  const staged=verifyGeneration(root,'g1',original);
  if(staged.revision!==active.revision+1||
     staged.parentSha256!==active.sourceSha256)
    throw Error('Staged generation is not a reviewed successor.');
  if(interrupt==='before-pointer')
    throw Error('Injected before-pointer interruption.');
  writeMarker(root,'g1',staged);
  if(interrupt==='after-pointer')
    throw Error('Injected after-pointer acknowledgement loss.');
  return verifyActive(root,original);
}
function recoverOriginal(root,original){
  // Explicit manual simulation; real GitHub rollback needs a reviewed
  // new commit and owner's approval, not a ref rewind.
  const current=verifyActive(root,original);
  if(current.generation!=='g1')
    throw Error('Recovery requires the new test generation.');
  const previous=verifyGeneration(root,'g0',original);
  if(previous.revision!==0||previous.sourceSha256!==SOURCE_SHA)
    throw Error('Independent original generation no longer matches baseline.');
  writeMarker(root,'g0',previous);
  if(verifyActive(root,original).sourceSha256!==SOURCE_SHA)
    throw Error('Private recovery did not restore original source.');
  return true;
}
async function withPreparedGenerations(original,callback){
  if(!Buffer.isBuffer(original)||sha(original)!==SOURCE_SHA||
     typeof callback!=='function')
    throw Error('Original pinned site and private callback are required.');
  return withTemporaryVersions(original,async source=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-generation-'));
    fs.chmodSync(root,0o700);
    try{
      fs.mkdirSync(rootOf(root,'g0'),{mode:0o700});
      fs.cpSync(source,sourceOf(root,'g0'),{recursive:true,errorOnExist:true});
      fs.writeFileSync(runtimeOf(root,'g0'),original,{flag:'wx',mode:0o600});
      const baseline=verifyGeneration(root,'g0',original);
      if(baseline.sourceSha256!==SOURCE_SHA||baseline.revision!==0)
        throw Error('Private initial generation is not exact original.');
      writeMarker(root,'g0',baseline);
      const state=verify(sourceOf(root,'g0'),original);
      const draft=draftFrom(state,[{index:0,title:'Private generation-switch rehearsal'}]);
      const receipt=await withReviewedPackage(sourceOf(root,'g0'),original,draft,
        ({root:packageFolder,receipt,verified})=>{
          if(verified.stagedFileCount!==3||receipt.proposedFileCount!==3)
            throw Error('Unexpected reviewed three-file package.');
          fs.mkdirSync(rootOf(root,'g1'),{mode:0o700});
          fs.cpSync(sourceOf(root,'g0'),sourceOf(root,'g1'),
            {recursive:true,errorOnExist:true});
          fs.copyFileSync(runtimeOf(root,'g0'),runtimeOf(root,'g1'),
            fs.constants.COPYFILE_EXCL);
          for(const item of receipt.proposedPaths){
            const origin=path.join(packageFolder,...item.path.split('/'));
            const target=item.path===RUNTIME?runtimeOf(root,'g1'):
              path.join(sourceOf(root,'g1'),...item.path.split('/'));
            if(![RUNTIME,MANIFEST,recordPath(0)].includes(item.path)||
               !regular(origin).length)
              throw Error('Reviewed private package has unapproved paths.');
            fs.copyFileSync(origin,target);
          }
          return receipt;
        });
      const next=verifyGeneration(root,'g1',original);
      if(receipt.proposedFullSiteSha256!==next.sourceSha256||
         next.resourcesVerified!==COUNT||next.parentSha256!==SOURCE_SHA||
         next.revision!==1)
        throw Error('Prepared generation differs from reviewed package.');
      for(let i=1;i<COUNT;i++){
        const rel=recordPath(i).split('/');
        if(!regular(path.join(sourceOf(root,'g0'),...rel)).equals(
             regular(path.join(sourceOf(root,'g1'),...rel))))
          throw Error('Unrelated resource fragment was changed.');
      }
      return await callback(Object.freeze({root,receipt,baseline,next}));
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
}
async function demonstrate(original){
  let temporaryRoot;
  const result=await withPreparedGenerations(original,({root,receipt})=>{
    temporaryRoot=root;
    // A torn multi-file generation is never selected by CURRENT.
    const torn=path.join(root,'unfinished-private');
    fs.mkdirSync(torn,{mode:0o700});
    fs.cpSync(sourceOf(root,'g0'),path.join(torn,'source'),{recursive:true});
    fs.copyFileSync(runtimeOf(root,'g0'),path.join(torn,RUNTIME));
    fs.copyFileSync(path.join(sourceOf(root,'g1'),...recordPath(0).split('/')),
      path.join(torn,'source',...recordPath(0).split('/')));
    let tornRejected=false;
    try{verify(path.join(torn,'source'),original);}
    catch(_){tornRejected=true;}
    if(!tornRejected)throw Error('Partial generation unexpectedly verified.');
    fs.rmSync(torn,{recursive:true,force:true});
    const originalStillActive=verifyActive(root,original).sourceSha256===SOURCE_SHA;
    // A complete-looking candidate whose generated full HTML has been
    // corrupted must not replace the independently verified original.
    const stagedRuntime=runtimeOf(root,'g1');
    const originalStagedRuntime=regular(stagedRuntime);
    fs.writeFileSync(stagedRuntime,Buffer.from('corrupted test-only HTML'));
    let corruptedCandidateRefused=false;
    try{activate(root,original,'g0');}
    catch(_){corruptedCandidateRefused=true;}
    if(!corruptedCandidateRefused||
       verifyActive(root,original).generation!=='g0')
      throw Error('Damaged staged HTML replaced the original version.');
    fs.writeFileSync(stagedRuntime,originalStagedRuntime);
    if(verifyGeneration(root,'g1',original).revision!==1)
      throw Error('Private candidate did not restore after corruption test.');
    let preSwitchFailed=false;
    try{activate(root,original,'g0',{interrupt:'before-pointer'});}
    catch(e){preSwitchFailed=/Injected before-pointer/.test(e.message);}
    if(!preSwitchFailed||verifyActive(root,original).generation!=='g0')
      throw Error('Pre-switch interruption replaced active source.');
    let lostAcknowledgement=false;
    try{activate(root,original,'g0',{interrupt:'after-pointer'});}
    catch(e){lostAcknowledgement=/Injected after-pointer/.test(e.message);}
    if(!lostAcknowledgement||verifyActive(root,original).generation!=='g1')
      throw Error('Post-switch uncertainty was mistaken for failed Save.');
    let staleSecondRefused=false;
    try{activate(root,original,'g0');}
    catch(e){staleSecondRefused=/Stale private generation/.test(e.message);}
    if(!staleSecondRefused||verifyActive(root,original).generation!=='g1')
      throw Error('Stale private session rewrote newer generation.');
    // The recovery target must itself pass full 414-fragment verification.
    // An old name is not proof of good backup bytes.
    const oldRecord=path.join(sourceOf(root,'g0'),...recordPath(0).split('/'));
    const originalOldRecord=regular(oldRecord);
    fs.writeFileSync(oldRecord,Buffer.from('damaged private backup fragment'));
    let corruptedBackupRefused=false;
    try{recoverOriginal(root,original);}
    catch(_){corruptedBackupRefused=true;}
    if(!corruptedBackupRefused||
       verifyActive(root,original).generation!=='g1')
      throw Error('Damaged original backup was activated.');
    fs.writeFileSync(oldRecord,originalOldRecord);
    const recovered=recoverOriginal(root,original);
    const active=verifyActive(root,original);
    if(!originalStillActive||!recovered||active.sourceSha256!==SOURCE_SHA)
      throw Error('Original offline source was not recoverable.');
    return Object.freeze({
      format:FORMAT,baselineResourceCount:COUNT,
      stagedFilesVerified:receipt.proposedFileCount,
      unrelatedResourceFilesUnchanged:COUNT-1,
      interruptedIncompleteGenerationRejected:tornRejected,
      damagedPreparedRuntimeRefused:corruptedCandidateRefused,
      damagedBackupRecoveryRefused:corruptedBackupRefused,
      originalRemainedActiveBeforeSwitch:originalStillActive&&preSwitchFailed,
      afterSwitchUncertainResultReconciled:lostAcknowledgement,
      secondStaleSessionRefused:staleSecondRefused,
      explicitOriginalRecoveryVerified:recovered,
      activeOriginalHashRestored:active.sourceSha256===SOURCE_SHA,
      realCrossProcessCASProven:false,powerLossDurabilityProven:false,
      temporaryLocalPointerOnly:true,realGitHubSavePerformed:false,
      productionFilesWritten:0,githubWrites:0,
      canonicalSourceLayoutApproved:false,ownerApproved:false,
      canApply:false,canPush:false,canMerge:false,canPublish:false
    });
  });
  if(!temporaryRoot||fs.existsSync(temporaryRoot))
    throw Error('Disposable generation folder was not deleted.');
  return Object.freeze({...result,temporaryGenerationDeleted:true});
}
if(require.main===module){
  (async()=>{
    const original=fs.readFileSync(
      path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(await demonstrate(original),null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Private generation-switch rehearsal refused safely.\n');
    process.exitCode=1;
  });
}
module.exports={FORMAT,verifyGeneration,readMarker,verifyActive,
  activate,recoverOriginal,withPreparedGenerations,demonstrate};

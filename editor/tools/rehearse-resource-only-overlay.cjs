'use strict';
/*
 * DISPOSABLE RESOURCE-ONLY OVERLAY REHEARSAL. Never a release builder.
 * Stores 414 original resource objects individually and one checksummed
 * manifest in an OS-private temporary directory. It deliberately DOES NOT
 * copy the large non-resource website shell or any inline images.
 *
 * This remains BASELINE-DEPENDENT: the exact original 31 MB compatibility
 * HTML must be supplied to restore the source. This cannot be committed,
 * merged, used as a publisher or made canonical without owner approval
 * and a separately designed version-aware update/rollback process.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {planChangeSet}=require('./rehearse-resource-change-set.cjs');
const {SOURCE_SHA,auditStorage}=require('./audit-source-storage-budget.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const enc=value=>Buffer.from(value,'utf8');
const ROOT='content/resource-overlays',COUNT=414;
const MANIFEST=ROOT+'/manifest.json';
const recordPath=i=>ROOT+'/resources/'+String(i+1).padStart(4,'0')+'.fragment';
const filePaths=()=>new Set([MANIFEST,...Array.from({length:COUNT},(_,i)=>recordPath(i))]);
function checkedSource(original){
  if(!Buffer.isBuffer(original)||sha(original)!==SOURCE_SHA)
    throw Error('Exact original compatibility source is required.');
  const split=splitInMemory(original);
  if(split.records.length!==COUNT)throw Error('Unexpected resource count.');
  return split;
}
function expectedState(split,plan=null){
  if(plan&&(!plan.split||plan.split.source!==split.source||
      plan.manifest?.originalSourceSha256!==SOURCE_SHA))
    throw Error('Overlay plan is not bound to the original source.');
  const records=split.records.slice();
  if(plan){
    for(const [index,record] of plan.fragments){
      if(!Number.isInteger(index)||index<0||index>=COUNT||typeof record!=='string')
        throw Error('Unsafe resource change index or bytes.');
      records[index]=record;
    }
  }
  const reconstructed=restoreInMemory(split,records);
  const manifest={
    format:'naxx-private-resource-overlay-feasibility-v1',
    candidateOnly:true,approved:false,publishable:false,deployable:false,
    originalSourceSha256:SOURCE_SHA,stagedSourceSha256:sha(reconstructed),
    sourceLength:split.bytes.length,stagedLength:reconstructed.length,
    resourceCount:COUNT,
    resources:records.map((record,index)=>({
      position:index+1,path:recordPath(index),sha256:sha(enc(record))
    }))
  };
  return {records,manifest,reconstructed};
}
function safePath(dir,rel){
  if(!filePaths().has(rel))throw Error('Unapproved resource overlay path.');
  return path.join(dir,...rel.split('/'));
}
function writeFile(dir,rel,bytes,overwrite=false){
  const file=safePath(dir,rel);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  if(overwrite){
    const st=fs.lstatSync(file);
    if(!st.isFile()||st.isSymbolicLink())throw Error('Unsafe overlay overwrite.');
  }
  fs.writeFileSync(file,bytes,{mode:0o600,flag:overwrite?'w':'wx'});
}
function readFile(dir,rel){
  const file=safePath(dir,rel);
  const st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink())
    throw Error('Missing or unsafe overlay file.');
  return fs.readFileSync(file);
}
function checkList(dir){
  const names=[];
  function visit(folder){
    for(const item of fs.readdirSync(folder,{withFileTypes:true})){
      const file=path.join(folder,item.name),stat=fs.lstatSync(file);
      if(stat.isSymbolicLink())throw Error('Symlink forbidden in overlay.');
      if(stat.isDirectory())visit(file);
      else if(stat.isFile())names.push(path.relative(dir,file).split(path.sep).join('/'));
      else throw Error('Unsafe overlay file type.');
    }
  }
  visit(dir);
  const expected=filePaths();
  if(names.length!==expected.size||names.some(x=>!expected.has(x)))
    throw Error('Overlay has missing or unexpected files.');
  return names.length;
}
function writeOverlay(dir,original,plan=null){
  const split=checkedSource(original),x=expectedState(split,plan);
  x.records.forEach((record,i)=>writeFile(dir,recordPath(i),enc(record)));
  writeFile(dir,MANIFEST,enc(JSON.stringify(x.manifest,null,2)+'\n'));
  return x;
}
function verifyOverlay(dir,original,plan=null){
  const split=checkedSource(original),x=expectedState(split,plan);
  const found=checkList(dir);
  const saved=JSON.parse(readFile(dir,MANIFEST).toString('utf8'));
  if(JSON.stringify(saved)!==JSON.stringify(x.manifest))
    throw Error('Overlay manifest mismatches the reviewed resource plan.');
  let fragmentBytes=0;
  const records=[];
  for(let i=0;i<COUNT;i++){
    const bytes=readFile(dir,recordPath(i));
    if(sha(bytes)!==x.manifest.resources[i].sha256||
       !bytes.equals(enc(x.records[i])))
      throw Error('Overlay resource fragment changed or was reordered.');
    fragmentBytes+=bytes.length;
    records.push(bytes.toString('utf8'));
  }
  const rebuilt=restoreInMemory(split,records);
  if(!rebuilt.equals(x.reconstructed)||
     sha(rebuilt)!==x.manifest.stagedSourceSha256)
    throw Error('Overlay reconstruction differs from expected website.');
  const manifestBytes=readFile(dir,MANIFEST).length;
  const fullTree=auditStorage(original);
  return {
    format:x.manifest.format,
    candidateOnly:true,approved:false,deployable:false,publishable:false,
    resourceFiles:COUNT,overlayFiles:found,
    changedFragments:plan?plan.fragments.size:0,
    unchangedFragments:COUNT-(plan?plan.fragments.size:0),
    originalShellCopiedToOverlay:false,
    versionAwareRebuildNotYetDesigned:true,
    originalCompatibilitySha256:SOURCE_SHA,
    byteExactIntendedReconstruction:true,
    exactOriginalRestored:plan===null&&rebuilt.equals(original),
    resourceFragmentBytes:fragmentBytes,
    manifestBytes,overlayTreeBytes:fragmentBytes+manifestBytes,
    fullCandidateTreeBytes:fullTree.completeCandidateTreeBytes,
    shellAndImageDuplicationAvoided:true,
    sourceValuesPrinted:false,reposWritten:0,deployments:0
  };
}
function rollbackOverlay(dir,original,plan){
  if(!plan||!plan.fragments?.size)throw Error('A changed overlay plan is required.');
  verifyOverlay(dir,original,plan);
  const split=checkedSource(original);
  for(const index of plan.fragments.keys())
    writeFile(dir,recordPath(index),enc(split.records[index]),true);
  const base=expectedState(split,null);
  writeFile(dir,MANIFEST,enc(JSON.stringify(base.manifest,null,2)+'\n'),true);
  return verifyOverlay(dir,original,null);
}
async function withOverlay(original,draft,fn){
  if(typeof fn!=='function')throw Error('A private verifier function is required.');
  checkedSource(original);
  const plan=draft?await planChangeSet(original,draft):null;
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-overlay-feasibility-'));
  fs.chmodSync(folder,0o700);
  try{
    writeOverlay(folder,original,plan);
    return await fn(folder,plan);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
async function rehearseOverlay(original,draft){
  let folderName;
  const result=await withOverlay(original,draft,(folder,plan)=>{
    folderName=folder;
    const staged=verifyOverlay(folder,original,plan);
    const rollback=plan?rollbackOverlay(folder,original,plan):
      verifyOverlay(folder,original,null);
    return {staged,rollback};
  });
  if(!folderName||fs.existsSync(folderName))
    throw Error('Private overlay temp directory was not deleted.');
  if(!result.rollback.exactOriginalRestored)
    throw Error('Overlay rollback did not recover original compatibility bytes.');
  return {
    format:'naxx-resource-overlay-storage-rehearsal-v1',
    ...result,originalFileUnmodified:true,
    tempDirectoryDeleted:true,githubFilesWritten:0,published:false,
    canonicalSourceAdoptionApproved:false
  };
}
if(require.main===module){
  (async()=>{
    const source=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    const draft={format:'naxx-local-resource-draft-v2',
      baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Private resource-only overlay trial'},
        {index:413,content:'Private multiline overlay content.\n\nSecond paragraph.'}]};
    process.stdout.write(JSON.stringify(await rehearseOverlay(source,draft),null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Private resource-only overlay rehearsal failed closed.\n');
    process.exitCode=1;
  });
}
module.exports={ROOT,MANIFEST,COUNT,recordPath,filePaths,checkedSource,
  expectedState,writeOverlay,verifyOverlay,rollbackOverlay,withOverlay,rehearseOverlay};

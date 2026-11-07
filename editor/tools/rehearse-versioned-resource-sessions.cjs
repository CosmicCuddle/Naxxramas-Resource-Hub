'use strict';
/* Test-only, private multi-session resource overlay. NO production writer. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {replaceTitleInRecord}=require('./rehearse-title-edit.cjs');
const {replaceContentInRecord}=require('./rehearse-content-edit.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {recordPath,filePaths,COUNT,MANIFEST}=require('./rehearse-resource-only-overlay.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=s=>Buffer.from(s,'utf8');
const FMT='naxx-private-versioned-resource-overlay-v1';
const DFMT='naxx-private-versioned-resource-draft-v1';
const HEX=/^[a-f0-9]{64}$/;
const keys=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).sort().join(',')===fields.slice().sort().join(',');
function splitBase(original){
  if(!Buffer.isBuffer(original)||sha(original)!==SOURCE_SHA)
    throw Error('Exact original non-resource website shell is required.');
  const split=splitInMemory(original);
  if(split.records.length!==COUNT||!restoreInMemory(split).equals(original))
    throw Error('Original 414-record source does not reconstruct exactly.');
  return split;
}
function makeManifest(split,records,revision,parent){
  if(!Number.isSafeInteger(revision)||revision<0||
     (revision===0?parent!==null:!HEX.test(parent))||
     !Array.isArray(records)||records.length!==COUNT)
    throw Error('Invalid revision state.');
  const rebuilt=restoreInMemory(split,records);
  return {
    format:FMT,privateOnly:true,publishable:false,deployable:false,
    originalSha256:SOURCE_SHA,revision,parentSha256:parent,
    sourceSha256:sha(rebuilt),sourceBytes:rebuilt.length,
    resources:records.map((record,i)=>{
      if(typeof record!=='string')throw Error('Invalid resource fragment.');
      return {index:i,path:recordPath(i),sha256:sha(bytes(record))};
    })
  };
}
function fileAt(dir,rel){
  if(!filePaths().has(rel))throw Error('Unapproved resource path.');
  return path.join(dir,...rel.split('/'));
}
function read(dir,rel){
  const file=fileAt(dir,rel),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Unsafe resource file type.');
  return fs.readFileSync(file);
}
function write(dir,rel,value,fresh=false){
  const file=fileAt(dir,rel);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  if(!fresh){
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink())
      throw Error('Unsafe overlay rewrite target.');
  }
  fs.writeFileSync(file,value,{flag:fresh?'wx':'w',mode:0o600});
}
function verifyPaths(dir){
  const seen=[];
  function walk(folder){
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      const file=path.join(folder,entry.name),st=fs.lstatSync(file);
      if(st.isSymbolicLink())throw Error('Symlink forbidden in resource overlay.');
      if(st.isDirectory())walk(file);
      else if(st.isFile())seen.push(path.relative(dir,file).split(path.sep).join('/'));
      else throw Error('Unexpected overlay entry type.');
    }
  }
  walk(dir);
  const expected=filePaths();
  if(seen.length!==expected.size||seen.some(rel=>!expected.has(rel)))
    throw Error('Missing or unexpected resource overlay files.');
}
function verify(dir,original){
  const split=splitBase(original);
  verifyPaths(dir);
  const saved=JSON.parse(read(dir,MANIFEST).toString('utf8'));
  if(!keys(saved,['format','privateOnly','publishable','deployable','originalSha256',
     'revision','parentSha256','sourceSha256','sourceBytes','resources'])||
     saved.format!==FMT||saved.privateOnly!==true||
     saved.publishable!==false||saved.deployable!==false||
     saved.originalSha256!==SOURCE_SHA||
     !Number.isSafeInteger(saved.revision)||saved.revision<0||
     (saved.revision===0?saved.parentSha256!==null:!HEX.test(saved.parentSha256))||
     !HEX.test(saved.sourceSha256)||!Number.isSafeInteger(saved.sourceBytes)||
     !Array.isArray(saved.resources)||saved.resources.length!==COUNT)
    throw Error('Invalid versioned source manifest.');
  const records=[];
  for(let i=0;i<COUNT;i++){
    const meta=saved.resources[i];
    if(!keys(meta,['index','path','sha256'])||
       meta.index!==i||meta.path!==recordPath(i)||!HEX.test(meta.sha256))
      throw Error('Resource manifest order/hash invalid.');
    const value=read(dir,recordPath(i));
    if(sha(value)!==meta.sha256||!bytes(value.toString('utf8')).equals(value))
      throw Error('Resource fragment checksum or encoding conflict.');
    records.push(value.toString('utf8'));
  }
  const regenerated=makeManifest(split,records,saved.revision,saved.parentSha256);
  if(JSON.stringify(regenerated)!==JSON.stringify(saved))
    throw Error('Versioned source does not match complete compatibility hash.');
  if(saved.revision===0&&saved.sourceSha256!==SOURCE_SHA)
    throw Error('Original baseline revision was modified.');
  return {split,records,manifest:saved};
}
function initialise(dir,original){
  const split=splitBase(original),manifest=makeManifest(split,split.records,0,null);
  for(let i=0;i<COUNT;i++)write(dir,recordPath(i),bytes(split.records[i]),true);
  write(dir,MANIFEST,bytes(JSON.stringify(manifest)+'\n'),true);
  return verify(dir,original);
}
function draftFrom(snapshot,edits){
  if(!snapshot||!Array.isArray(snapshot.records)||!snapshot.manifest||
     !Array.isArray(edits)||edits.length===0||edits.length>COUNT)
    throw Error('A verified source snapshot and nonempty edits are required.');
  const seen=new Set(),changes=edits.map(edit=>{
    if(!edit||!Number.isInteger(edit.index)||edit.index<0||edit.index>=COUNT||
       seen.has(edit.index)||![
         'index,title','content,index','content,index,title'
       ].includes(Object.keys(edit).sort().join(',')))
      throw Error('Invalid or repeated resource index in draft.');
    seen.add(edit.index);
    return {...edit,expectedSha256:sha(bytes(snapshot.records[edit.index]))};
  }).sort((a,b)=>a.index-b.index);
  return {format:DFMT,sourceBaselineSha256:SOURCE_SHA,
    revision:snapshot.manifest.revision,
    sourceSha256:snapshot.manifest.sourceSha256,changes};
}
function plan(snapshot,draft){
  if(!keys(draft,['format','sourceBaselineSha256','revision','sourceSha256','changes'])||
     draft.format!==DFMT||draft.sourceBaselineSha256!==SOURCE_SHA||
     !Number.isSafeInteger(draft.revision)||draft.revision<0||
     !HEX.test(draft.sourceSha256)||!Array.isArray(draft.changes)||
     draft.changes.length===0||draft.changes.length>COUNT)
    throw Error('Invalid version-bound resource draft.');
  // Fail closed: stale drafts are rejected even when editing different records.
  if(draft.revision!==snapshot.manifest.revision||
     draft.sourceSha256!==snapshot.manifest.sourceSha256)
    throw Error('Stale save: reopen the updated source before reviewing edits.');
  const newRecords=snapshot.records.slice(),indices=[],seen=new Set();
  for(const change of draft.changes){
    if(!change||!Number.isInteger(change.index)||change.index<0||
       change.index>=COUNT||seen.has(change.index)||!HEX.test(change.expectedSha256)||
       !['expectedSha256,index,title','content,expectedSha256,index',
         'content,expectedSha256,index,title'].includes(
           Object.keys(change).sort().join(',')))
      throw Error('Unsafe or duplicated versioned draft entry.');
    seen.add(change.index);
    let value=snapshot.records[change.index];
    if(sha(bytes(value))!==change.expectedSha256)
      throw Error('Resource checksum conflict: target has changed.');
    if(Object.hasOwn(change,'title'))
      value=replaceTitleInRecord(value,change.title).record;
    if(Object.hasOwn(change,'content'))
      value=replaceContentInRecord(value,change.content).record;
    if(value===snapshot.records[change.index])
      throw Error('No change requested for selected resource.');
    newRecords[change.index]=value;indices.push(change.index);
  }
  const next=makeManifest(snapshot.split,newRecords,
    snapshot.manifest.revision+1,snapshot.manifest.sourceSha256);
  if(next.sourceSha256===snapshot.manifest.sourceSha256)
    throw Error('Empty compatibility-source update.');
  return {newRecords,indices,manifest:next};
}
function save(dir,original,draft){
  const before=verify(dir,original),next=plan(before,draft);
  const oldManifest=read(dir,MANIFEST);
  const oldRecords=new Map(next.indices.map(i=>[i,read(dir,recordPath(i))]));
  try{
    // Manifest written last; failed private transactions restore old version.
    for(const i of next.indices)write(dir,recordPath(i),bytes(next.newRecords[i]));
    write(dir,MANIFEST,bytes(JSON.stringify(next.manifest)+'\n'));
    const after=verify(dir,original);
    if(after.manifest.revision!==before.manifest.revision+1)
      throw Error('Expected exact next revision.');
    return {after,changed:next.indices.length};
  }catch(error){
    for(const [i,b] of oldRecords)write(dir,recordPath(i),b);
    write(dir,MANIFEST,oldManifest);
    verify(dir,original);
    throw error;
  }
}
function rollback(dir,original){
  const current=verify(dir,original),split=splitBase(original);
  let restored=0;
  for(let i=0;i<COUNT;i++){
    if(current.records[i]!==split.records[i]){
      write(dir,recordPath(i),bytes(split.records[i]));restored++;
    }
  }
  write(dir,MANIFEST,bytes(JSON.stringify(
    makeManifest(split,split.records,0,null))+'\n'));
  const after=verify(dir,original);
  if(after.manifest.sourceSha256!==SOURCE_SHA)
    throw Error('Rollback to original compatibility file failed.');
  return {restored,exactOriginal:true};
}
async function withTemporaryVersions(original,fn){
  if(typeof fn!=='function')throw Error('A private test callback is required.');
  splitBase(original);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-two-session-overlay-'));
  fs.chmodSync(dir,0o700);
  try{initialise(dir,original);return await fn(dir);}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}
async function rehearse(original){
  let location;
  const result=await withTemporaryVersions(original,dir=>{
    location=dir;
    const baseline=verify(dir,original);
    const oldDraft=draftFrom(baseline,[{index:1,title:'Old discarded session'}]);
    const first=save(dir,original,draftFrom(baseline,[
      {index:0,title:'Private first saved session'}]));
    let staleRejected=false;
    try{save(dir,original,oldDraft);}
    catch(error){staleRejected=/Stale save/.test(error.message);}
    if(!staleRejected)throw Error('An old draft was silently merged.');
    const second=save(dir,original,draftFrom(verify(dir,original),[
      {index:413,content:'Private second session.\n\nSecond paragraph.'}]));
    const ending=verify(dir,original);
    const restored=rollback(dir,original);
    return {revisions:[first.after.manifest.revision,second.after.manifest.revision],
      staleRejected,changedPerSession:[first.changed,second.changed],
      finalCompatibilitySha256Verified:ending.manifest.sourceSha256===
        sha(restoreInMemory(ending.split,ending.records)),
      totalFiles:filePaths().size,originalShellCopied:false,
      restored};
  });
  if(!location||fs.existsSync(location))throw Error('Private session data not deleted.');
  return {format:'naxx-private-two-session-save-test-v1',...result,
    temporaryDataDeleted:true,originalWebsiteUnchanged:true,
    siteFilesWritten:0,published:false,deployable:false,ownerApproved:false};
}
if(require.main===module){
  (async()=>{
    const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(await rehearse(original),null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Private multi-session trial failed; no source data printed.\n');
    process.exitCode=1;
  });
}
module.exports={FMT,DFMT,splitBase,makeManifest,verify,initialise,draftFrom,plan,
  save,rollback,withTemporaryVersions,rehearse};

'use strict';
/*
 * RESEARCH ONLY: verify an explicitly pinned, linear chain of LOCAL Git
 * commits carrying an experimental versioned resource overlay.
 *
 * This is NOT a save writer, remote-head attestation, owner approval, or
 * adoption of the 415-file source layout. Do not use for production writes.
 * All source material comes from exact ordinary Git blobs; never from a
 * worktree, uploaded ZIP, or a self-asserted expected source checksum.
 */
const crypto=require('node:crypto');
const {getBlob,runGit}=require('./rehearse-local-git-head-preflight.cjs');
const {splitBase,makeManifest}=require('./rehearse-versioned-resource-sessions.cjs');
const {recordPath,MANIFEST,COUNT}=require('./rehearse-resource-only-overlay.cjs');
const {replaceTitleInRecord}=require('./rehearse-title-edit.cjs');
const {replaceContentInRecord}=require('./rehearse-content-edit.cjs');
const {enclosingParts,property}=require('./audit-legacy-shape.cjs');
const {readJsString}=require('./audit-legacy-json.cjs');
const {restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const COMMIT=/^[a-f0-9]{40}$|^[a-f0-9]{64}$/;
const RUNTIME='site-content.html',OVERLAY='content/resource-overlays';
const ALLOWED=new Set([MANIFEST,...Array.from({length:COUNT},(_,i)=>recordPath(i))]);
const exact=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);

function gitCommit(repo,commit){
  const line=runGit(repo,['rev-list','--parents','-n','1',commit]).trim();
  const parts=line.split(' ');
  if(parts[0]!==commit||parts.some(p=>!COMMIT.test(p)))
    throw Error('Pinned local Git commit lineage is incomplete.');
  return parts;
}
function listedOverlay(repo,commit){
  const raw=runGit(repo,['ls-tree','-r','-z','--full-tree',
    commit,'--',OVERLAY]);
  const map=new Set();
  for(const line of raw.split('\0').filter(Boolean)){
    const m=/^([0-9]{6}) blob [0-9a-f]{40,64}\t([^\0]+)$/.exec(line);
    if(!m||m[1]!=='100644'||!ALLOWED.has(m[2])||map.has(m[2]))
      throw Error('Unexpected, duplicated or unsafe tracked resource overlay path.');
    map.add(m[2]);
  }
  return map;
}
function utf8(bytes,max){
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>max)
    throw Error('Missing or excessively large versioned resource blob.');
  const string=bytes.toString('utf8');
  if(!Buffer.from(string,'utf8').equals(bytes))
    throw Error('Invalid UTF-8 in a pinned Git source resource.');
  return string;
}
function editable(record){
  const start=record.search(/\S/);
  if(start<0||record[start]!=='{')
    throw Error('Edited resource is not a literal object.');
  const fields=enclosingParts(record,start).segments.map(segment=>({
    segment,field:property(record,segment)
  }));
  const result={};
  for(const name of ['title','content']){
    const found=fields.filter(item=>item.field.key===name);
    if(found.length!==1)throw Error('Edited resource is missing a unique editable field.');
    let begin=found[0].field.valueStart;
    while(begin<record.length&&/\s/.test(record[begin]))begin++;
    const value=readJsString(record,begin);
    if(!value||record.slice(value.end,found[0].segment[1]).trim())
      throw Error('Edited resource field is not a static string literal.');
    result[name]=value.value;
  }
  return result;
}
function onlyEditableFields(before,after){
  if(before===after)return false;
  const oldValues=editable(before),newValues=editable(after);
  let rebuilt=before,changed=false;
  if(oldValues.title!==newValues.title){
    rebuilt=replaceTitleInRecord(rebuilt,newValues.title).record;
    changed=true;
  }
  if(oldValues.content!==newValues.content){
    rebuilt=replaceContentInRecord(rebuilt,newValues.content).record;
    changed=true;
  }
  if(!changed||rebuilt!==after)
    throw Error('A resource changed a protected field, formatting or non-editable source bytes.');
  return true;
}
function changedPaths(repo,oldCommit,newCommit){
  const raw=runGit(repo,['diff','--name-only','-z',
    oldCommit,newCommit,'--']);
  return raw.split('\0').filter(Boolean);
}
function verifyPinnedLocalRevisionChain(repo,commitIds){
  if(typeof repo!=='string'||!repo||
     !Array.isArray(commitIds)||commitIds.length<2||
     commitIds.length>32||new Set(commitIds).size!==commitIds.length||
     commitIds.some(c=>typeof c!=='string'||!COMMIT.test(c)))
    throw Error('At least two distinct, independently pinned Git commits are required.');

  // The caller must pin the entire source chain, not read it from a ZIP.
  // HEAD is compared at the start and end; this is NOT a process lock.
  const target=commitIds[commitIds.length-1];
  const initialHead=runGit(repo,['rev-parse','--verify',
    'HEAD^{commit}']).trim();
  if(initialHead!==target)
    throw Error('The local Git checkout does not match the independently pinned tip.');

  for(let i=1;i<commitIds.length;i++){
    const parents=gitCommit(repo,commitIds[i]);
    if(parents.length!==2||parents[1]!==commitIds[i-1])
      throw Error('The pinned revision chain is not a contiguous single-parent Git history.');
  }
  gitCommit(repo,commitIds[0]); // Exact original commit must exist.
  const original=getBlob(repo,commitIds[0],RUNTIME);
  const split=splitBase(original);
  const baseFiles=listedOverlay(repo,commitIds[0]);
  if(baseFiles.size!==0)
    throw Error('The pinned original revision already has an unapproved resource overlay.');

  let prior={revision:0,sourceSha256:SOURCE_SHA,records:split.records.slice()};
  const shell={
    prefix:split.source.slice(0,split.arrayBegin),
    suffix:split.source.slice(split.arrayEnd),
    separators:split.separators.slice()
  };
  const shellSha=sha(Buffer.from(JSON.stringify([
    shell.prefix,shell.suffix,shell.separators]),'utf8'));
  const recordsPaths=Array.from({length:COUNT},(_,i)=>recordPath(i));
  const summaries=[];
  let mostRecent=null;

  for(let step=1;step<commitIds.length;step++){
    const commit=commitIds[step];
    const overlay=listedOverlay(repo,commit);
    if(overlay.size!==ALLOWED.size||
       [...ALLOWED].some(p=>!overlay.has(p)))
      throw Error('Missing or unexpected versioned resource source path in Git commit.');
    const manifestText=utf8(getBlob(repo,commit,MANIFEST),512*1024);
    let manifest;
    try{manifest=JSON.parse(manifestText);}catch(_){
      throw Error('The pinned Git manifest is invalid JSON.');
    }
    if(Buffer.from(JSON.stringify(manifest)+'\n','utf8').toString('utf8')!==manifestText)
      throw Error('The pinned Git manifest is not canonical and may contain hidden duplicate fields.');
    const fragments=[];
    for(let i=0;i<COUNT;i++)
      fragments.push(utf8(getBlob(repo,commit,recordPath(i)),1024*1024));

    const expected=makeManifest(split,fragments,step,prior.sourceSha256);
    if(JSON.stringify(manifest)!==JSON.stringify(expected))
      throw Error('Manifest revision, parent, resource hashes or complete source hash differ from verified Git blobs.');
    const regenerated=restoreInMemory(split,fragments);
    const runtime=getBlob(repo,commit,RUNTIME);
    if(!runtime.equals(regenerated))
      throw Error('Pinned Git runtime differs from the fully reconstructed original-shell source.');
    let edited=0,resourcePaths=[];
    for(let i=0;i<COUNT;i++){
      if(onlyEditableFields(prior.records[i],fragments[i])){
        edited++;
        resourcePaths.push(recordPath(i));
      }
    }
    if(edited<1)throw Error('A claimed new resource revision contains no actual editable-field changes.');
    const diff=changedPaths(repo,commitIds[step-1],commit);
    const expectedChanged=[
      RUNTIME,MANIFEST,...(step===1?recordsPaths:resourcePaths)
    ].sort();
    if(!exact(diff.slice().sort(),expectedChanged))
      throw Error('Git revision changed unexpected tracked files or omitted required source files.');
    summaries.push(Object.freeze({
      revision:step,commit,editedResources:edited,sourceSha256:expected.sourceSha256,
      parentSha256:prior.sourceSha256,all414PhysicalBlobsVerified:true,
      completeRuntimeGitBlobMatched:true,onlyEditableFieldsChanged:true,
      exactCommittedPathsVerified:true
    }));
    mostRecent={
      snapshot:{manifest:expected,shell,fragments},
      trust:{expectedRevision:step,expectedSourceSha256:sha(runtime),
        expectedParentSha256:prior.sourceSha256,
        expectedShellSha256:shellSha,expectedRecordPaths:recordsPaths.slice()}
    };
    prior={revision:step,sourceSha256:sha(runtime),records:fragments};
  }
  const finalHead=runGit(repo,['rev-parse','--verify',
    'HEAD^{commit}']).trim();
  if(finalHead!==target)
    throw Error('Local Git checkout changed during the read-only revision inspection.');

  return {
    ...mostRecent,
    evidence:Object.freeze({
      format:'naxx-private-read-only-local-git-revision-chain-v1',
      pinnedBaseCommit:commitIds[0],pinnedTipCommit:target,
      committedRevisionCount:summaries.length,
      localGitCommitObjectsVerified:true,localCheckoutStable:true,
      originalShellByteIdentical:true,allResourceVersionsVerified:true,
      remoteGitHubHeadAuthenticated:false,
      remoteLockHeld:false,sourceLayoutApproved:false,
      readOnly:true,reviewOnly:true,canApply:false,canPush:false,
      canMerge:false,canPublish:false,filesWritten:0,gitHubWrites:0,
      revisions:Object.freeze(summaries)
    })
  };
}
module.exports={verifyPinnedLocalRevisionChain};

'use strict';
/*
 * PROTECTED DEVELOPMENT TOOL: deterministic resource fragment change set.
 *
 * This module does not publish or export a website. It can stage changed
 * resource fragments inside the already verified temporary package, rebuild
 * all source bytes, and then DELETE that package. Original custom fields,
 * layout, scripts and the 29-item side collection must remain byte-identical.
 *
 * The manifest is intentionally NOT a deployment authorisation or a live
 * GitHub source manifest. There are no runtime code evaluations.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('../resource-title-core.js');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {replaceTitleInRecord}=require('./rehearse-title-edit.cjs');
const {replaceContentInRecord}=require('./rehearse-content-edit.cjs');
const {withTemporaryPackage,reconstructTemporaryPackage,resourcePath}=
  require('./rehearse-resource-files.cjs');

const SOURCE_SHA=core.BASE_SHA,COUNT=414,HEX=/^[a-f0-9]{64}$/;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const enc=text=>Buffer.from(text,'utf8');
function verifyOriginal(original) {
  if(!Buffer.isBuffer(original)||hash(original)!==SOURCE_SHA)
    throw Error('Original resource source hash mismatch. No files staged.');
  return splitInMemory(original);
}
function fixedFile(root,relative){
  const full=path.join(root,relative);
  const info=fs.lstatSync(full);
  if(!info.isFile()||info.isSymbolicLink())
    throw Error('A staged resource path is not a regular file.');
  return full;
}
function readExpected(root,relative,expected){
  if(!HEX.test(expected))throw Error('Invalid staged file checksum.');
  const data=fs.readFileSync(fixedFile(root,relative));
  if(hash(data)!==expected)throw Error('Staged file differs from its manifest checksum.');
  return data;
}
function expectedChange(split,edits,index){
  const original=split.records[index];
  let current=original;
  const entry=edits.get(index);
  if(!entry)throw Error('Expected resource edit missing.');
  if(entry.title!==undefined)current=replaceTitleInRecord(current,entry.title).record;
  if(entry.content!==undefined)current=replaceContentInRecord(current,entry.content).record;
  if(current===original)throw Error('Resource edit did not change the original.');
  return current;
}
async function planChangeSet(original,draft){
  const split=verifyOriginal(original);
  if(!draft||draft.format!=='naxx-local-resource-draft-v2')
    throw Error('Only explicit protected v2 resource drafts can be staged.');
  const model=await core.open(split.source,crypto.webcrypto);
  const restored=core.restoreResourceDraft(draft,model);
  const edits=new Map();
  for(const item of draft.changes){
    const index=item.index;
    if(edits.has(index))throw Error('Duplicate resource edit.');
    const fields={};
    if(restored.titles.has(index))fields.title=restored.titles.get(index);
    if(restored.contents.has(index))fields.content=restored.contents.get(index);
    if(!Object.keys(fields).length)throw Error('Empty resource edit.');
    edits.set(index,fields);
  }
  if(!edits.size)throw Error('No resource changes to stage.');
  const fragments=new Map();
  const resourceHashes=[];
  for(let index=0;index<COUNT;index++){
    const originalText=split.records[index];
    const staged=edits.has(index)?expectedChange(split,edits,index):originalText;
    const sourceHash=hash(enc(originalText)),stagedHash=hash(enc(staged));
    resourceHashes.push({position:index+1,originalSha256:sourceHash,stagedSha256:stagedHash});
    if(edits.has(index))fragments.set(index,staged);
  }
  const records=split.records.slice();
  for(const [i,value] of fragments)records[i]=value;
  const assembled=restoreInMemory(split,records);
  const changes=[...edits.keys()].sort((a,b)=>a-b).map(index=>{
    const fields=edits.get(index);
    return {
      position:index+1,
      path:resourcePath(index).split(path.sep).join('/'),
      originalSha256:resourceHashes[index].originalSha256,
      stagedSha256:resourceHashes[index].stagedSha256,
      fields:Object.keys(fields).sort()
    };
  });
  const prefix=split.source.slice(0,split.arrayBegin);
  const suffix=split.source.slice(split.arrayEnd);
  const manifest={
    format:'naxx-temporary-resource-changes-v1',
    publishable:false,githubReady:false,deployable:false,
    originalSourceSha256:SOURCE_SHA,
    stagedSourceSha256:hash(assembled),
    stagedSourceBytes:assembled.length,
    recordCount:COUNT,
    layoutSha256:{
      prefix:hash(enc(prefix)),suffix:hash(enc(suffix)),
      separators:hash(enc(JSON.stringify(split.separators)))
    },
    resources:resourceHashes,
    changes
  };
  // The caller only receives changes in memory; no folder is modified.
  return {split,manifest,fragments,expected:assembled};
}
function verifyStagedPackage(root,original,draft,plan) {
  const split=verifyOriginal(original);
  const manifest=plan.manifest;
  if(!manifest||manifest.format!=='naxx-temporary-resource-changes-v1'||
     manifest.publishable!==false||manifest.deployable!==false||
     manifest.githubReady!==false||manifest.originalSourceSha256!==SOURCE_SHA||
     manifest.recordCount!==COUNT||!Array.isArray(manifest.resources)||
     manifest.resources.length!==COUNT||
     !Array.isArray(manifest.changes)||manifest.changes.length!==plan.fragments.size)
    throw Error('Staged resource change-set manifest invalid.');
  const originalManifest=JSON.parse(fs.readFileSync(fixedFile(root,'manifest.json'),'utf8'));
  if(originalManifest.sourceSha256!==SOURCE_SHA||
     originalManifest.recordCount!==COUNT||originalManifest.sourceLength!==original.length)
    throw Error('Original package manifest changed.');
  const prefix=readExpected(root,'layout/prefix.utf8',originalManifest.files.prefix);
  const suffix=readExpected(root,'layout/suffix.utf8',originalManifest.files.suffix);
  const serialized=readExpected(root,'layout/separators.json',originalManifest.files.separators);
  const separators=JSON.parse(serialized.toString('utf8'));
  if(!Array.isArray(separators)||separators.length!==COUNT+1||
     separators.some(value=>typeof value!=='string'))
    throw Error('Staged separators corrupted.');
  if(hash(prefix)!==manifest.layoutSha256.prefix||
     hash(suffix)!==manifest.layoutSha256.suffix||
     hash(serialized)!==manifest.layoutSha256.separators)
    throw Error('Staged layout checksum mismatch.');
  if(!prefix.equals(enc(split.source.slice(0,split.arrayBegin)))||
     !suffix.equals(enc(split.source.slice(split.arrayEnd)))||
     !serialized.equals(enc(JSON.stringify(split.separators))))
    throw Error('Original non-resource source bytes changed.');
  const rebuiltRecords=[];
  let untouched=0;
  for(let i=0;i<COUNT;i++){
    const pathName=resourcePath(i);
    const metadata=manifest.resources[i],originalBytes=enc(split.records[i]);
    if(metadata.position!==i+1||
       metadata.originalSha256!==hash(originalBytes)||
       originalManifest.resources[i]!==metadata.originalSha256)
      throw Error('Original fragment index or checksum differs.');
    const staged=readExpected(root,pathName,metadata.stagedSha256);
    const intended=plan.fragments.has(i)?enc(plan.fragments.get(i)):originalBytes;
    if(!staged.equals(intended))
      throw Error('Resource fragment differs from verified intended title/content edits.');
    if(!Buffer.from(staged.toString('utf8'),'utf8').equals(staged))
      throw Error('Invalid staged resource UTF-8.');
    rebuiltRecords.push(staged.toString('utf8'));
    if(!plan.fragments.has(i))untouched++;
  }
  for(const item of manifest.changes){
    const index=item.position-1;
    const expected=plan.fragments.get(index);
    if(typeof expected!=='string'||item.path!==resourcePath(index).split(path.sep).join('/')||
       item.originalSha256!==manifest.resources[index].originalSha256||
       item.stagedSha256!==manifest.resources[index].stagedSha256)
      throw Error('Staged changed-path manifest entry invalid.');
    const requested=draft.changes.find(change=>change.index===index);
    const intendedFields=['title','content'].filter(field=>Object.hasOwn(requested,field)).sort();
    if(JSON.stringify(item.fields)!==JSON.stringify(intendedFields))
      throw Error('Staged changed-field manifest entry invalid.');
  }
  const joined=restoreInMemory(split,rebuiltRecords);
  if(!joined.equals(plan.expected)||hash(joined)!==manifest.stagedSourceSha256||
     joined.length!==manifest.stagedSourceBytes)
    throw Error('Rebuilt website does not match verified intended source.');
  return {
    changedFragments:manifest.changes.length,
    unchangedFragments:untouched,
    sourceReconstructedExactly:true,
    nonResourceSourcePreserved:true,
    allChangedPathsVerified:true
  };
}
async function rehearseDraft(original,draft){
  const plan=await planChangeSet(original,draft);
  let folder;
  const result=withTemporaryPackage(original,(root)=>{
    folder=root;
    if(!reconstructTemporaryPackage(root).equals(original))
      throw Error('Original package did not reconstruct before editing.');
    for(const [index,content] of plan.fragments){
      fs.writeFileSync(fixedFile(root,resourcePath(index)),content,{encoding:'utf8'});
    }
    let staleRejected=false;
    try{reconstructTemporaryPackage(root);}catch(_){staleRejected=true;}
    if(!staleRejected)throw Error('Unchanged original manifest wrongly accepted edits.');
    return {
      format:plan.manifest.format,readOnlyProduction:true,published:false,
      filesAddedToRepository:0,resourceValuesPrinted:false,
      originalSourceSha256:SOURCE_SHA,
      modifiedSourceSha256:plan.manifest.stagedSourceSha256,
      originalManifestRejectedChangedFragments:staleRejected,
      ...verifyStagedPackage(root,original,draft,plan)
    };
  });
  if(!folder||fs.existsSync(folder))throw Error('Temporary resource package was not deleted.');
  result.temporaryFilesDeleted=true;
  return result;
}
if(require.main===module){
  (async()=>{
    const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    const draft={format:'naxx-local-resource-draft-v2',baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Safe Changed Resource Title'},
        {index:413,content:'Rehearsal text\n\nSecond paragraph.'}]};
    const report=await rehearseDraft(original,draft);
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Resource fragment change-set rehearsal stopped; no original values printed.\n');
    process.exitCode=1;
  });
}
module.exports={planChangeSet,verifyStagedPackage,rehearseDraft};

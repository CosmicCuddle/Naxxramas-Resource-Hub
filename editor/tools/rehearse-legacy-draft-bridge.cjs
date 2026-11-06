'use strict';
/*
 * PRIVATE LEGACY EDITOR DRAFT BRIDGE — READ-ONLY / TEMPORARY ONLY.
 *
 * Converts the existing original-baseline resource-title-v1 and
 * resource-v2 drafts into a versioned-v1 resource draft **in memory** only
 * when the physically verified source is still EXACT original revision 0.
 * Even disjoint changes are NEVER automatically rebased to later revisions.
 *
 * Existing page/navigation-v3 drafts are NOT resource drafts. Their
 * independent read-only page planner is used to check their pinned files;
 * no migration of page data or combined source package is claimed.
 *
 * No writes, export, auto-save, GitHub updates, remote calls or publication.
 * The input draft bytes remain owned by the caller and are never overwritten.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const resourceCore=require('../resource-title-core.js');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const {splitBase,verify,draftFrom,plan,withTemporaryVersions,save}=
  require('./rehearse-versioned-resource-sessions.cjs');
const {proposedReceipt}=require('./plan-private-github-source-review.cjs');
const {PAGES,NAV,runs,plan:planPage}=require('./plan-page-draft.cjs');
const {restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const COUNT=414,MAX_DRAFT_BYTES=16777216;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const FORMAT='naxx-private-legacy-draft-bridge-v1';
const LEGACY_TITLE='naxx-local-resource-title-draft-v1';
const LEGACY_RESOURCE='naxx-local-resource-draft-v2';
const LEGACY_PAGE='naxx-local-draft-v3';
function parseBytes(input){
  // The exact original draft remains untouched. No JSON or content
  // printed; never accept an unbounded JSON payload.
  const bytes=Buffer.isBuffer(input)?input:
    typeof input==='string'?Buffer.from(input,'utf8'):null;
  if(!bytes||bytes.length===0||bytes.length>MAX_DRAFT_BYTES||
     !Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes))
    throw Error('Unsupported legacy draft size or UTF-8 encoding.');
  let parsed;
  try{parsed=JSON.parse(bytes.toString('utf8'));}
  catch(_){throw Error('Legacy draft JSON is invalid.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
    throw Error('Legacy draft is not a JSON object.');
  return {value:parsed,originalSha256:sha(bytes),
    inputBytes:bytes.length};
}
function identify(parsed){
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return null;
  if(parsed.format===LEGACY_TITLE)return 'title-v1';
  if(parsed.format===LEGACY_RESOURCE)return 'resource-v2';
  if(parsed.format===LEGACY_PAGE)return 'page-v3';
  return null;
}
function baseInfo(legacy,kind,code){
  return {
    format:FORMAT,originalDraftPreserved:true,
    originalDraftSha256:legacy.originalSha256,
    originalDraftBytes:legacy.inputBytes,
    oldDraftFormat:kind,decision:code,
    sourceOfTruthApproved:false,
    githubBranchVerified:false,completeAdminMigrationVerified:false,
    canApply:false,canMerge:false,canPublish:false,
    filesWritten:0,githubWrites:0,
    sourceValuesPrinted:false
  };
}
async function prepareResourceReview(folder,original,draftInput){
  const old=parseBytes(draftInput),kind=identify(old.value);
  if(kind!=='title-v1'&&kind!=='resource-v2')
    throw Error('Resource conversion supports only original v1/v2 drafts.');
  // Physical verification of all files is REQUIRED before trusting a
  // candidate source snapshot. Baseline original HTML is SHA-pinned.
  splitBase(original);
  const state=verify(folder,original);
  const base=baseInfo(old,kind,'review-only');
  if(state.manifest.revision!==0||
     state.manifest.sourceSha256!==SOURCE_SHA||
     !restoreInMemory(state.split,state.records).equals(original))
    return Object.freeze({...base,decision:'stale-original-draft',
      sourceRevision:state.manifest.revision,
      sourceBytesMatched:false,convertedDraft:null,receipt:null,
      editedResourceCount:0,
      needsOwnerReview:true,automaticRebaseForbidden:true});
  const model=await resourceCore.open(original.toString('utf8'),crypto.webcrypto);
  const restored=resourceCore.restoreResourceDraft(old.value,model);
  const indices=[...new Set([...restored.titles.keys(),
    ...restored.contents.keys()])].sort((a,b)=>a-b);
  if(indices.length===0)
    return Object.freeze({...base,decision:'no-resource-edits',
      sourceRevision:0,sourceBytesMatched:true,convertedDraft:null,
      receipt:null,editedResourceCount:0,
      needsOwnerReview:false,automaticRebaseForbidden:true});
  const entries=indices.map(index=>{
    const change={index};
    if(restored.titles.has(index))change.title=restored.titles.get(index);
    if(restored.contents.has(index))change.content=restored.contents.get(index);
    return change;
  });
  // A versioned candidate is created ONLY from the full verified original
  // snapshot; no unapproved migration of other custom resource fields.
  const converted=draftFrom(state,entries);
  const next=plan(state,converted);
  if(next.indices.length!==indices.length||
     next.manifest.revision!==1||
     next.manifest.parentSha256!==SOURCE_SHA)
    throw Error('Legacy bridge failed to preserve its revision boundary.');
  const receipt=proposedReceipt(folder,original,converted);
  if(receipt.editedResourceCount!==indices.length||
     receipt.currentRevision!==0||
     receipt.proposedRevision!==1||
     receipt.proposedFullSiteSha256!==next.manifest.sourceSha256)
    throw Error('Legacy bridge changed a protected source proposal.');
  return Object.freeze({
    ...base,sourceRevision:0,sourceBytesMatched:true,
    editedResourceCount:indices.length,
    titleChanges:restored.titles.size,
    multilineContentChanges:restored.contents.size,
    nextRevision:1,proposedFileCount:receipt.proposedFileCount,
    convertedDraft:converted,receipt,
    needsOwnerReview:true,automaticRebaseForbidden:true
  });
}
function inspectPageDraft(root,draftInput){
  const old=parseBytes(draftInput),kind=identify(old.value);
  if(kind!=='page-v3')throw Error('This is not a page/navigation-v3 draft.');
  // This planner independently checks the four page files and navigation
  // source hashes; source bytes for proposed edits are NOT returned.
  const proposal=planPage(root,old.value);
  const result={
    ...baseInfo(old,kind,
      proposal.changed.length?'separate-page-review':'no-page-edits'),
    resourceMigrationPerformed:false,
    originalPagesSourceVerified:proposal.sourceVerified===true,
    sourceCommitVerified:false,
    pageAndNavigationFilesChecked:proposal.verified.length,
    proposedPageAndNavigationFiles:proposal.changed.map(file=>Object.freeze({
      path:file.path,kind:file.kind,modifiedFields:file.modifiedFields,
      expectedOldSha256:file.sourceSha256,proposedNewSha256:file.nextSha256
    })),
    resourceDraft:null,
    pageDraftStillSeparate:true,needsOwnerReview:proposal.changed.length>0
  };
  return Object.freeze({
    ...result,
    proposedPageAndNavigationFiles:
      Object.freeze(result.proposedPageAndNavigationFiles)
  });
}
async function demonstrate(original,repoRoot){
  let privateFolder;
  const resource=await withTemporaryVersions(original,async dir=>{
    privateFolder=dir;
    const v2=Buffer.from(JSON.stringify({
      format:LEGACY_RESOURCE,baselineSha256:SOURCE_SHA,
      changes:[
        {index:0,title:'Private bridging source title'},
        {index:413,content:'Private bridging content.\n\nSecond paragraph.'}
      ]
    }));
    const earlier=await prepareResourceReview(dir,original,v2);
    if(earlier.decision!=='review-only'||earlier.editedResourceCount!==2||
       earlier.proposedFileCount!==4||
       earlier.originalDraftSha256!==sha(v2))
      throw Error('Original v2 bridge did not produce expected review.');
    save(dir,original,earlier.convertedDraft); // disposable only
    const obsolete=await prepareResourceReview(dir,original,v2);
    if(obsolete.decision!=='stale-original-draft'||
       obsolete.convertedDraft!==null||
       obsolete.originalDraftSha256!==sha(v2))
      throw Error('Old draft was silently re-based or lost.');
    return {
      oldV2ConvertedForReview:true,oldDraftSha256Retained:true,
      resourceChanges:earlier.editedResourceCount,
      proposedRevision:earlier.nextRevision,
      proposedPathCount:earlier.proposedFileCount,
      obsoleteV2RejectedAfterVersionAdvance:true,
      currentSourceStaysInDisposableFolder:true
    };
  });
  if(fs.existsSync(privateFolder))
    throw Error('Temporary source state was not deleted.');
  // Pages are intentionally not converted into resources; real page-v3
  // acceptance is covered by independent planner + existing CI.
  return Object.freeze({
    format:FORMAT,...resource,originalResourceCount:COUNT,
    pageV3RemainsSeparate:true,temporaryFolderDeleted:true,
    originalWebsiteUnchanged:true,gitHubWrites:0,
    originalDraftsDeleted:0,ownerApproved:false,canPublish:false
  });
}
if(require.main===module){
  (async()=>{
    const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    const report=await demonstrate(original,path.resolve(__dirname,'..','..'));
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  })().catch(_=>{
    process.stderr.write('Private legacy draft bridge stopped safely.\n');
    process.exitCode=1;
  });
}
module.exports={
  FORMAT,LEGACY_TITLE,LEGACY_RESOURCE,LEGACY_PAGE,
  parseBytes,identify,prepareResourceReview,inspectPageDraft,demonstrate
};

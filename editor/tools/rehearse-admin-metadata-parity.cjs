'use strict';
/*
 * ORIGINAL ADMIN METADATA PARITY — PRIVATE, NO-LOGIN, READ-ONLY.
 *
 * Every one of the 414 original resource objects is compared at lexical
 * source level with the same resource in the complete staged website.
 * Only individually requested title/content STRING LITERAL bytes may vary;
 * every other byte in each record, including all unknown custom keys and
 * layout/relationships, must remain byte identical.
 *
 * The original non-resource DATA shell is preserved byte-for-byte by the
 * existing source-bound restore function. This tool cannot authenticate
 * administrator actions or produce a GitHub Save.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {enclosingParts,property}=require('./audit-legacy-shape.cjs');
const {readJsString}=require('./audit-legacy-json.cjs');
const {splitInMemory,restoreInMemory}=
  require('./check-legacy-roundtrip.cjs');
const {verify:verifyOverlay}=require('./rehearse-versioned-resource-sessions.cjs');
const {withCompletePrivateCandidate}=
  require('./rehearse-browser-zip-complete-source.cjs');
const {inspectArchive}=require('./review-private-combined-zip.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const {SOURCE_SHA}=require('./audit-source-storage-budget.cjs');
const STANDARD=new Set([
  'id','title','section','classes','content','description','category',
  'icon','image','type','name','expansion','tier','dungeon','raid','enabled','visible'
]);
const FORMAT='naxx-original-admin-resource-metadata-parity-v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const skip=(text,pos)=>{while(/\s/.test(text[pos]||''))pos++;return pos;};
function parseRecord(record){
  if(typeof record!=='string'||record.length<2||
     record[skip(record,0)]!=='{')
    throw Error('Resource object literal is missing.');
  const root=enclosingParts(record,skip(record,0));
  if(record.slice(root.close+1).trim())
    throw Error('Resource object has unsupported trailing source.');
  const fields=[],seen=new Set();
  for(const segment of root.segments){
    const p=property(record,segment);
    if(!p.key||seen.has(p.key))
      throw Error('A resource has unparseable or duplicate custom properties.');
    seen.add(p.key);
    fields.push({key:p.key,segment,from:p.valueStart});
  }
  if(!fields.length)throw Error('Empty resource record.');
  return fields;
}
function maskPermittedLiterals(record,fields,allowed){
  const spans=[];
  for(const entry of fields){
    if(!allowed.has(entry.key))continue;
    const from=skip(record,entry.from),literal=readJsString(record,from);
    if(!literal||literal.quoteKind==='template'||
       record.slice(literal.end,entry.segment[1]).trim())
      throw Error('Editable resource value is not one plain string literal.');
    spans.push({key:entry.key,from,end:literal.end,
      value:literal.value,quoteKind:literal.quoteKind});
  }
  if(spans.length!==allowed.size)
    throw Error('The changed resource field is missing.');
  let masked=record;
  for(const span of spans.slice().sort((a,b)=>b.from-a.from))
    masked=masked.slice(0,span.from)+'<allowed-edited-string>'+masked.slice(span.end);
  return {masked,values:new Map(spans.map(x=>[x.key,x]))};
}
function compareRecords(originalRecords,nextRecords,expectedFields){
  if(!Array.isArray(originalRecords)||!Array.isArray(nextRecords)||
     originalRecords.length!==414||nextRecords.length!==414||
     !(expectedFields instanceof Map))
    throw Error('414 original resources and an exact edit map are required.');
  for(const [index,fields] of expectedFields){
    if(!Number.isInteger(index)||index<0||index>=414||
       !(fields instanceof Set)||fields.size<1||
       [...fields].some(x=>x!=='title'&&x!=='content'))
      throw Error('Unapproved resource edit index or property.');
  }
  let custom=0,protectedFields=0,recordEdits=0,changedLiterals=0;
  for(let i=0;i<414;i++){
    const original=originalRecords[i],next=nextRecords[i];
    const fields=parseRecord(original);
    const nextFields=parseRecord(next);
    const names=fields.map(f=>f.key),nextNames=nextFields.map(f=>f.key);
    if(names.length!==nextNames.length||
       names.some((name,index)=>name!==nextNames[index]))
      throw Error('Original custom resource properties were removed or reordered.');
    custom+=names.filter(n=>!STANDARD.has(n)).length;
    protectedFields+=names.length;
    const allowed=expectedFields.get(i)||new Set();
    if(!allowed.size){
      if(original!==next)
        throw Error('An unedited resource or custom field changed.');
      continue;
    }
    recordEdits++;
    const previous=maskPermittedLiterals(original,fields,allowed);
    const proposed=maskPermittedLiterals(next,nextFields,allowed);
    if(previous.masked!==proposed.masked)
      throw Error('A non-editable resource property, quote or delimiter changed.');
    for(const key of allowed){
      const before=previous.values.get(key),after=proposed.values.get(key);
      if(!before||!after||before.quoteKind!==after.quoteKind||
         before.value===after.value)
        throw Error('Requested resource text was missing, unchanged or retyped.');
      changedLiterals++;
    }
  }
  if(recordEdits!==expectedFields.size||changedLiterals<1)
    throw Error('Reviewed resource edits have incomplete field coverage.');
  return Object.freeze({
    resourceRecordsCompared:414,
    sourcePropertiesChecked:protectedFields,
    protectedAdditionalCustomFieldOccurrences:custom,
    changedResourceRecords:recordEdits,
    changedApprovedTextLiterals:changedLiterals,
    uneditedResourcesByteExact:414-recordEdits,
    allOtherResourceBytesIdentical:true
  });
}
function editMapFromDraft(draft){
  if(!draft||draft.format!=='naxx-local-resource-draft-v2'||
     !Array.isArray(draft.changes)||!draft.changes.length)
    throw Error('An exact verified original resource-v2 draft is required.');
  const changes=new Map();
  for(const item of draft.changes){
    if(!item||!Number.isInteger(item.index)||item.index<0||
       item.index>=414)
      throw Error('Unsafe original resource index in review ZIP.');
    const keys=Object.keys(item).filter(k=>k!=='index');
    if(!keys.length||keys.some(k=>k!=='title'&&k!=='content'))
      throw Error('Unapproved fields in resource review ZIP.');
    if(!changes.has(item.index))changes.set(item.index,new Set());
    for(const key of keys){
      if(changes.get(item.index).has(key)||typeof item[key]!=='string')
        throw Error('Duplicated or unsafe editable resource field.');
      changes.get(item.index).add(key);
    }
  }
  return changes;
}
async function reviewAdminFieldParity(checkout,zip,reviewedCommit,inspect=null){
  if(inspect!==null&&typeof inspect!=='function')
    throw Error('Private QA inspection callback must be a function.');
  const verified=await inspectArchive(zip);
  if(!verified.hasPageDraft||!verified.hasResourceDraft)
    throw Error('Both page and resource drafts must be verified for complete review.');
  const edits=editMapFromDraft(JSON.parse(verified.resourceDraftText));
  let output;
  const result=await withCompletePrivateCandidate(checkout,zip,reviewedCommit,
    async candidate=>{
      if(sha(candidate.original)!==SOURCE_SHA)
        throw Error('Original verified source changed.');
      const old=splitInMemory(candidate.original);
      const overlay=verifyOverlay(candidate.overlay,candidate.original);
      if(overlay.records.length!==414)
        throw Error('Staged overlay has an incomplete resource inventory.');
      const next=restoreInMemory(old,overlay.records);
      const runtime=fs.readFileSync(path.join(candidate.stage,RUNTIME));
      if(!next.equals(runtime)||
         sha(next)!==candidate.evidence.generatedRuntimeSha256)
        throw Error('Staged runtime does not preserve original DATA shell.');
      const proof=compareRecords(old.records,overlay.records,edits);
      if(inspect)await inspect(Object.freeze({
        originalRecords:old.records.slice(),
        proposedRecords:overlay.records.slice(),
        expectedFields:edits,
        rerun:()=>compareRecords(old.records,overlay.records,edits)
      }));
      const again=compareRecords(old.records,overlay.records,edits);
      if(JSON.stringify(again)!==JSON.stringify(proof))
        throw Error('Resource custom-property evidence changed during review.');
      output=Object.freeze({
        format:FORMAT, ...proof,
        originalResourceSha256:SOURCE_SHA,
        sourceBoundOriginalDataShellPreserved:true,
        completeProposedRuntimeMatchesPhysicalSource:true,
        originalDirectDataMembersProtectedByShell:true,
        originalSeparateSideCollectionProtectedByShell:true,
        embeddedNonResourceMediaProtectedByShell:true,
        originalAdminScriptsProtectedByShell:true,
        noAdministratorLoginAttempted:true,
        actualAdminFeatureAcceptanceCompleted:false,
        finalResourceLayoutOwnerApproved:false,
        productionReleaseBackupRetained:false,
        canApply:false,canSave:false,canMerge:false,canPublish:false,
        websiteFilesWritten:0,githubWrites:0,
        noResourceValuesOrIdentifiersPrinted:true
      });
      return output;
    });
  if(result.sourceCheckoutUnchanged!==true||
     result.temporaryPackageDeleted!==true||result!==output)
    throw Error('Private custom-data inspection did not clean up.');
  return result;
}
module.exports=Object.freeze({
  FORMAT,parseRecord,maskPermittedLiterals,compareRecords,
  editMapFromDraft,reviewAdminFieldParity
});

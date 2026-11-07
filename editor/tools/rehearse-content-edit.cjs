'use strict';
/* Protected in-memory resource content edit rehearsal.
 * Never exports, writes, runs original JS or publishes an edited website.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {enclosingParts,property}=require('./audit-legacy-shape.cjs');
const {readJsString}=require('./audit-legacy-json.cjs');
const {contentValid}=require('../resource-title-core.js');
function sha256(b){return crypto.createHash('sha256').update(b).digest('hex');}
function space(s,i){while(i<s.length&&/\s/.test(s[i]))i++;return i;}
function replaceContentInRecord(record,newContent){
  if(!contentValid(newContent))
    throw Error('Only safe multiline plain text of at most 30,000 characters is accepted.');
  const begin=space(record,0);
  if(record[begin]!=='{')throw Error('Resource is not a literal object.');
  const original=enclosingParts(record,begin);
  const found=original.segments.map(segment=>({segment,field:property(record,segment)}))
    .filter(item=>item.field.key==='content');
  if(found.length!==1)throw Error('A resource must have exactly one content field.');
  const item=found[0],start=space(record,item.field.valueStart);
  const value=readJsString(record,start);
  if(!value||record.slice(value.end,item.segment[1]).trim())
    throw Error('Original resource content must be a static quoted string.');
  const literal=JSON.stringify(newContent);
  const updated=record.slice(0,start)+literal+record.slice(value.end);
  const parsed=enclosingParts(updated,begin);
  if(parsed.segments.length!==original.segments.length)
    throw Error('Resource fields changed unexpectedly.');
  const matching=parsed.segments.filter(seg=>property(updated,seg).key==='content');
  if(matching.length!==1)throw Error('Content field count changed unexpectedly.');
  const next=readJsString(updated,space(updated,property(updated,matching[0]).valueStart));
  if(!next||next.value!==newContent)throw Error('Content could not be reconstructed exactly.');
  return {record:updated,oldContent:value.value,start,end:value.end};
}
function simulateContentEdit(original,index,newContent){
  const split=splitInMemory(original);
  if(!Number.isInteger(index)||index<0||index>=split.records.length)
    throw Error('Resource index out of range.');
  const result=replaceContentInRecord(split.records[index],newContent);
  if(result.record===split.records[index])throw Error('No actual content change requested.');
  const modified=split.records.slice();
  modified[index]=result.record;
  const rebuilt=restoreInMemory(split,modified);
  const unchanged=modified.reduce((n,s,i)=>n+(i!==index&&s===split.records[i]?1:0),0);
  if(unchanged!==413)throw Error('Other resource fragments were unexpectedly altered.');
  const text=rebuilt.toString('utf8');
  if(text.slice(0,split.arrayBegin)!==split.source.slice(0,split.arrayBegin)||
     !text.endsWith(split.source.slice(split.arrayEnd)))
    throw Error('Non-resource website content unexpectedly altered.');
  if(rebuilt.equals(original))throw Error('Rebuilt source was not changed.');
  return {
    format:'naxx-original-multiline-content-rehearsal-v1',
    originalSourceVerified:true,readOnly:true,published:false,
    editedFields:1,unchangedResourceFragments:unchanged,
    originalNonResourceSourcePreserved:true,
    modifiedContentMatchesProposedText:result.oldContent!==newContent,
    originalSha256:sha256(original),rebuiltSha256:sha256(rebuilt),
    sourceValuesOrIdsEmitted:false
  };
}
if(require.main===module){
  try{
    const input=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(simulateContentEdit(input,0,'Development-only content\n\nSecond paragraph.'),null,2)+'\n');
  }catch(_){process.stderr.write('Multiline content rehearsal stopped safely.\n');process.exitCode=1;}
}
module.exports={replaceContentInRecord,simulateContentEdit};

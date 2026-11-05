'use strict';
/*
 * One-resource TITLE edit experiment. This NEVER writes to disk.
 *
 * It does not execute the original JavaScript, infer IDs, or print titles.
 * It proves a single field can be replaced while all other source bytes stay
 * exactly unchanged. Only valid plain-text titles are supported in this test.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {splitInMemory,restoreInMemory} = require('./check-legacy-roundtrip.cjs');
const {enclosingParts,property} = require('./audit-legacy-shape.cjs');
const {readJsString} = require('./audit-legacy-json.cjs');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function safeTitle(value) {
  return typeof value==='string' &&
    value.length>0 && value.length<=160 &&
    !/[<>\x00-\x1f\x7f]/.test(value);
}
function replaceTitleInRecord(record, newTitle) {
  if (!safeTitle(newTitle))
    throw new Error('The test title must be short, plain text without HTML or control characters.');
  const first = record.search(/\S/);
  if (first<0||record[first]!=='{')
    throw new Error('Expected a literal resource object.');
  const parsed=enclosingParts(record,first);
  const titles=parsed.segments.map(segment=>{
    const field=property(record,segment);
    return {segment,field};
  }).filter(x=>x.field.key==='title');
  if (titles.length!==1)
    throw new Error('Resource must contain exactly one title field.');
  const target=titles[0],start=target.field.valueStart;
  let from=start;
  while (from<target.segment[1]&&/\s/.test(record[from]))from++;
  const oldTitle=readJsString(record,from);
  if (!oldTitle || record.slice(oldTitle.end,target.segment[1]).trim())
    throw new Error('Existing title is not a static string literal.');
  const serialized=JSON.stringify(newTitle);
  const replacement=record.slice(0,from)+serialized+record.slice(oldTitle.end);
  // Recheck syntax and preserve the field and direct member count.
  const revised=enclosingParts(replacement,first);
  if (revised.segments.length!==parsed.segments.length)
    throw new Error('Title edit unexpectedly changed the record structure.');
  return {record:replacement,originalTitleLiteral:record.slice(from,oldTitle.end),
    newTitleLiteral:serialized};
}
function simulateTitleEdit(bytes,index,newTitle) {
  const split=splitInMemory(bytes);
  if (!Number.isInteger(index)||index<0||index>=split.records.length)
    throw new Error('Resource index out of bounds.');
  const records=split.records.slice();
  const changed=replaceTitleInRecord(records[index],newTitle);
  const originalRecord=records[index];
  records[index]=changed.record;
  const rebuilt=restoreInMemory(split,records);
  if(rebuilt.equals(bytes))throw new Error('Test did not change the source.');
  const reconstituted=rebuilt.toString('utf8');
  // Only the single original literal is replaced, all other bytes unchanged.
  const expectedRecord=originalRecord.replace(changed.originalTitleLiteral,changed.newTitleLiteral);
  if(expectedRecord!==changed.record)
    throw new Error('Title replacement unexpectedly touched another field.');
  if(split.source.slice(0,split.arrayBegin)!==reconstituted.slice(0,split.arrayBegin))
    throw new Error('Original source outside the resources array changed.');
  // Suffix position moves when the title length changes.
  if(!reconstituted.endsWith(split.source.slice(split.arrayEnd)))
    throw new Error('Original source suffix changed.');
  const unchanged=records.reduce((count,record,n)=>
    count+(n!==index&&record===split.records[n]?1:0),0);
  if(unchanged!==split.records.length-1)
    throw new Error('Unexpected changes to additional resource records.');
  const reconstructedFields=enclosingParts(changed.record,changed.record.search(/\S/));
  if(reconstructedFields.segments.length<5)
    throw new Error('Resource data is incomplete after edit.');
  return {
    format:'naxx-legacy-one-title-edit-v1',
    memoryOnly:true,
    writtenToDisk:false,
    published:false,
    originalRecords:split.records.length,
    recordsLeftByteIdentical:unchanged,
    resourcesWithIntendedTextChange:1,
    originalSha256:sha256(bytes),
    modifiedSha256:sha256(rebuilt),
    originalContentByteLength:bytes.length,
    modifiedContentByteLength:rebuilt.length,
    originalOutsideResourceArrayPreserved:true,
    note:'Testing a synthetic title replacement; not proof of browser rendering or authorization to publish.'
  };
}
if(require.main===module){
  try{
    const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(simulateTitleEdit(bytes,0,'Development Preview Title'),null,2)+'\n');
  }catch(_){
    process.stderr.write('Resource title-edit rehearsal failed safely. No content was printed.\n');
    process.exitCode=1;
  }
}
module.exports={safeTitle,replaceTitleInRecord,simulateTitleEdit};

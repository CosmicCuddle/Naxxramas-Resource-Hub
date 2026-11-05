'use strict';
/*
 * Read-only aggregate audit for the original 29-item side collection.
 * Prints no names, IDs, source fragments, or field names; never evaluates HTML.
 * All live-source operations require the exact preserved Git blob fingerprint.
 */
const fs = require('node:fs');
const path = require('node:path');
const {findSourceArray} = require('./check-legacy-roundtrip.cjs');
const {enclosingParts,property} = require('./audit-legacy-shape.cjs');
const {readJsString} = require('./audit-legacy-json.cjs');

function space(source,i) { while (i < source.length && /\s/.test(source[i])) i++; return i; }
function literalString(source,start,end) {
  const v=source.slice(start,end).trim();
  const parsed=readJsString(v,0);
  return parsed && parsed.end===v.length ? parsed.value : null;
}
function summarizeSideCollection(source,arrayBegin) {
  if (source[space(source,arrayBegin)]!=='[') throw new Error('Expected side collection array.');
  const array=enclosingParts(source,space(source,arrayBegin));
  const nameValues=new Set();
  const types={object:0,array:0,string:0,numberLike:0,expression:0,other:0,unparsed:0};
  let namesPresent=0,parseableNames=0,duplicateNames=0,idFields=0;
  let fields=0,unknownFieldTypes=0,unparsedFields=0;
  const perRecord=[];
  for (const range of array.segments) {
    const start=space(source,range[0]);
    if (source[start]!=='{') throw new Error('Unexpected non-object in side collection.');
    const obj=enclosingParts(source,start);
    if (source.slice(obj.close+1,range[1]).trim()) throw new Error('Unexpected expression after side item.');
    perRecord.push(obj.segments.length);
    for (const seg of obj.segments) {
      const field=property(source,seg);
      fields++;
      if (!field.key) { unparsedFields++;types.unparsed++;continue; }
      if (types[field.type]===undefined) unknownFieldTypes++;
      else types[field.type]++;
      if (field.key==='id') idFields++;
      if (field.key==='name') {
        namesPresent++;
        const name=literalString(source,field.valueStart,seg[1]);
        if (name!==null) {
          parseableNames++;
          if (nameValues.has(name)) duplicateNames++;
          else nameValues.add(name);
        }
      }
    }
  }
  return {
    recordCount:array.segments.length,
    directObjectCount:array.segments.length,
    totalProperties:fields,
    minimumPropertiesInRecord:Math.min(...perRecord),
    maximumPropertiesInRecord:Math.max(...perRecord),
    nameFields:namesPresent,
    parseableLiteralNames:parseableNames,
    duplicatedLiteralNames:duplicateNames,
    idFields,
    propertyValueTypeCounts:types,
    fieldsCouldNotBeParsed:unparsedFields,
    unexpectedValueTypes:unknownFieldTypes
  };
}
function audit(bytes) {
  // Verifies the entire original source against its known Git object fingerprint.
  const {source}=findSourceArray(bytes);
  const cloneMatches=[...source.matchAll(/\b(?:const|let|var)\s+DATA\s*=\s*JSON\s*\.\s*parse\s*\(\s*JSON\s*\.\s*stringify\s*\(\s*(window\s*\.\s*[A-Za-z_$][\w$]*)\s*\)\s*\)/g)];
  if (cloneMatches.length!==1) throw new Error('Original DATA clone not uniquely identified.');
  const clone=cloneMatches[0],name=clone[1].replace(/\s/g,'');
  const candidates=[];
  for (let i=source.indexOf(name);i>=0&&i<clone.index;i=source.indexOf(name,i+name.length)) {
    const eq=space(source,i+name.length);
    if (source[eq]!=='=' || source[eq+1]==='=' || source[eq+1]==='>') continue;
    const value=space(source,eq+1);
    if (source[value]==='{') candidates.push(value);
  }
  if (candidates.length!==1) throw new Error('Original DATA object not uniquely identified.');
  const root=enclosingParts(source,candidates[0]);
  if (root.segments.length!==27) throw new Error('Unexpected DATA structure.');
  const collections=[];
  root.segments.forEach((seg,i)=>{
    const field=property(source,seg);
    if (field.type!=='array') return;
    const begin=space(source,field.valueStart);
    const parts=enclosingParts(source,begin);
    collections.push({memberIndex:i+1,begin,count:parts.segments.length});
  });
  const side=collections.filter(x=>x.count===29);
  if (side.length!==1||side[0].memberIndex!==17)
    throw new Error('Expected exactly one 29-object side collection in the verified baseline.');
  const summary=summarizeSideCollection(source,side[0].begin);
  if (summary.recordCount!==29||summary.nameFields!==29||summary.idFields!==0)
    throw new Error('Original 29-item collection contract changed.');
  return {
    format:'naxx-original-side-collection-v1',
    originalSourceVerified:true,
    readOnly:true,
    sourceCodeExecuted:false,
    directRootMembers:root.segments.length,
    arrayMemberIndex:side[0].memberIndex,
    ...summary,
    valuesOrNamesEmitted:false,
    note:'Syntactic shape only; purpose, references and runtime behaviour still unverified.'
  };
}
if (require.main===module) {
  try {
    const filename=path.resolve(__dirname,'..','..','site-content.html');
    process.stdout.write(JSON.stringify(audit(fs.readFileSync(filename)),null,2)+'\n');
  } catch (_) {
    process.stderr.write('Side-collection audit stopped safely without printing site content.\n');
    process.exitCode=1;
  }
}
module.exports={audit,summarizeSideCollection,literalString};

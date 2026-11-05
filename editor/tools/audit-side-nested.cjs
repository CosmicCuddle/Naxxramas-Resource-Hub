'use strict';
/*
 * Protected read-only investigation of the 29 side objects and their nested
 * structures. No source JS execution, network, mutations, files written, values,
 * names, field keys, IDs, per-item hashes or source snippets emitted.
 *
 * An exact match between a string literal and a resource ID is only a possible
 * link. It is NOT evidence of an actual runtime dependency.
 */
const fs=require('node:fs');
const path=require('node:path');
const {splitInMemory}=require('./check-legacy-roundtrip.cjs');
const {findSideCollection}=require('./audit-side-collection.cjs');
const {enclosingParts,property,kind}=require('./audit-legacy-shape.cjs');
const {stringValue}=require('./audit-resource-schema.cjs');

const TYPES=['object','array','string','numberLike','expression','other','unparsed'];
const MAX_DEPTH=6,MAX_NODES=50000;
function space(src,p) {while(p<src.length&&/\s/.test(src[p]))p++;return p;}
function literal(src,start,end) {
  return stringValue(src.slice(start,end));
}
function resourceIdsFromRecords(records) {
  const ids=new Set();
  if (records.length!==414)throw new Error('Unexpected original resource collection.');
  for(const src of records){
    const root=enclosingParts(src,space(src,0));
    let idFields=0;
    for(const seg of root.segments){
      const f=property(src,seg);
      if(f.key!=='id')continue;
      idFields++;
      const id=literal(src,f.valueStart,seg[1]);
      if(id===null||ids.has(id))throw new Error('Resource identifier is ambiguous.');
      ids.add(id);
    }
    if(idFields!==1)throw new Error('Resource identifier is missing or repeated.');
  }
  return ids;
}
function scanNested(source,arrayBegin,resourceIds) {
  const top=enclosingParts(source,space(source,arrayBegin));
  const s={
    sideObjects:top.segments.length,
    sideFieldOccurrences:0,sideFieldLayouts:new Set(),
    sideLiteralCandidates:0,sideExactResourceIdMatches:0,
    nestedTopObjectFields:0,nestedDirectFieldOccurrences:0,
    nestedObjectsInspected:0,nestedArraysInspected:0,nestedArrayElements:0,
    allNestedFields:0,nestedFieldLayouts:new Set(),
    nestedTypeOccurrences:Object.fromEntries(TYPES.map(k=>[k,0])),
    nestedLiteralCandidates:0,nestedExactResourceIdMatches:0,
    nestedExpressionForms:{booleanLiteral:0,nullLiteral:0,simpleIdentifier:0,callOrProperty:0,other:0},
    distinctPossibleResourceIds:new Set(),
    unparseableNestedFields:0,duplicateNestedFieldKeys:0,
    maxDepthVisited:0,depthLimitReached:0,nodesVisited:0
  };
  function possibleLink(value,isSide){
    if(value===null)return;
    if(isSide)s.sideLiteralCandidates++;
    else s.nestedLiteralCandidates++;
    if(resourceIds.has(value)){
      if(isSide)s.sideExactResourceIdMatches++;
      else s.nestedExactResourceIdMatches++;
      s.distinctPossibleResourceIds.add(value);
    }
  }
  function inspect(source,at,depth) {
    if(++s.nodesVisited>MAX_NODES)throw new Error('Unexpected nested collection size.');
    if(depth>MAX_DEPTH){s.depthLimitReached++;return;}
    s.maxDepthVisited=Math.max(s.maxDepthVisited,depth);
    const first=source[space(source,at)];
    const obj=first==='{';
    if(!obj&&first!=='[')throw new Error('Expected nested literal container.');
    const container=enclosingParts(source,space(source,at));
    if(obj)s.nestedObjectsInspected++;
    else{s.nestedArraysInspected++;s.nestedArrayElements+=container.segments.length;}
    const keys=new Set(),layout=[];
    for(const item of container.segments) {
      if(obj) {
        const field=property(source,item);
        s.allNestedFields++;
        if(depth===0)s.nestedDirectFieldOccurrences++;
        if(!field.key){s.unparseableNestedFields++;throw new Error('Unexpected unnamed nested field.');}
        if(keys.has(field.key))s.duplicateNestedFieldKeys++;
        keys.add(field.key);
        layout.push(field.key+':'+field.type); // only retained in memory for counting
        s.nestedTypeOccurrences[field.type]++;
        if(field.type==='object'||field.type==='array'){
          inspect(source,field.valueStart,depth+1);
        } else if(field.type==='string'||field.type==='numberLike'){
          possibleLink(literal(source,field.valueStart,item[1]),false);
        } else if(field.type==='expression') {
          const value=source.slice(field.valueStart,item[1]).trim();
          const kind=/^(?:true|false)$/.test(value)?'booleanLiteral':
            value==='null'?'nullLiteral':
            /^[A-Za-z_$][\w$]*$/.test(value)?'simpleIdentifier':
            /^(?:[A-Za-z_$][\w$]*\s*[.(]|\()/.test(value)?'callOrProperty':'other';
          s.nestedExpressionForms[kind]++;
        }
      } else {
        const t=kind(source,item[0]);
        if(t==='object'||t==='array')inspect(source,item[0],depth+1);
        else if(t==='string'||t==='numberLike')
          possibleLink(literal(source,item[0],item[1]),false);
      }
    }
    if(obj)s.nestedFieldLayouts.add(layout.join('|'));
  }
  for(const item of top.segments){
    if(source[space(source,item[0])]!=='{')throw new Error('Non-object side item.');
    const outer=enclosingParts(source,space(source,item[0]));
    if(source.slice(outer.close+1,item[1]).trim())throw new Error('Unexpected expression after side item.');
    const layout=[];
    for(const seg of outer.segments){
      const f=property(source,seg);
      if(!f.key)throw new Error('Unexpected side field.');
      layout.push(f.key+':'+f.type);
      s.sideFieldOccurrences++;
      if(f.type==='object'){
        s.nestedTopObjectFields++;
        inspect(source,f.valueStart,0);
      }else if(f.type==='array'){
        // Unexpected for the previously confirmed original, but preserve if observed.
        inspect(source,f.valueStart,0);
      }else if(f.type==='string'||f.type==='numberLike'){
        possibleLink(literal(source,f.valueStart,seg[1]),true);
      }
    }
    s.sideFieldLayouts.add(layout.join('|'));
  }
  return {
    format:'naxx-side-collection-nested-structure-v1',
    readOnly:true,sourceCodeExecuted:false,
    sideObjects:s.sideObjects,sideFieldOccurrences:s.sideFieldOccurrences,
    distinctSideFieldLayouts:s.sideFieldLayouts.size,
    directObjectFieldsInSideRecords:s.nestedTopObjectFields,
    fieldsDirectlyWithinNestedTopObjects:s.nestedDirectFieldOccurrences,
    totalNestedObjectContainers:s.nestedObjectsInspected,
    totalNestedArrayContainers:s.nestedArraysInspected,
    totalNestedArrayElements:s.nestedArrayElements,
    totalNestedObjectProperties:s.allNestedFields,
    distinctNestedFieldLayouts:s.nestedFieldLayouts.size,
    nestedPropertyValueTypes:s.nestedTypeOccurrences,
    nestedExpressionForms:s.nestedExpressionForms,
    nestedLiteralCandidates:s.nestedLiteralCandidates,
    outerLiteralCandidates:s.sideLiteralCandidates,
    exactNestedLiteralMatchesToResourceIds:s.nestedExactResourceIdMatches,
    exactOuterLiteralMatchesToResourceIds:s.sideExactResourceIdMatches,
    distinctPotentiallyMatchedResourceIds:s.distinctPossibleResourceIds.size,
    duplicateNestedFieldKeys:s.duplicateNestedFieldKeys,
    unparseableNestedFields:s.unparseableNestedFields,
    maximumDepthInspected:s.maxDepthVisited,
    depthLimitReached:s.depthLimitReached,
    valuesNamesKeysOrIdsEmitted:false,
    note:'Only literal syntax checked; a matching string is NOT proof of a link. Runtime behavior and all other code references remain unverified.'
  };
}
function audit(bytes) {
  const found=findSideCollection(bytes); // exact baseline SHA validated first
  const {records}=splitInMemory(bytes);
  const result=scanNested(found.source,found.arrayBegin,resourceIdsFromRecords(records));
  if(result.sideObjects!==29||result.sideFieldOccurrences!==203||
     result.directObjectFieldsInSideRecords!==87)
    throw new Error('The protected side collection differs from its verified top-level schema.');
  return {originalSourceVerified:true,...result};
}
if(require.main===module){
  try{
    const file=path.resolve(__dirname,'..','..','site-content.html');
    process.stdout.write(JSON.stringify(audit(fs.readFileSync(file)),null,2)+'\n');
  }catch(_){
    process.stderr.write('Nested structure audit stopped safely without exposing source content.\n');
    process.exitCode=1;
  }
}
module.exports={audit,scanNested,resourceIdsFromRecords};

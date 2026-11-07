'use strict';
/*
 * Read-only JSON.parse initializer audit. No eval, vm, DOM, network, file writes,
 * or output of source strings/record values/IDs/URLs. Requires baseline blob.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const {inspectSource,MAIN_BASELINE_BLOB_SHA}=require('./inspect-legacy.cjs');
const {enclosingParts,property}=require('./audit-legacy-shape.cjs');

const KNOWN_TOP_KEYS=new Set([
  'resources','categories','sections','classes','dungeons','raids',
  'addons','items','groups','pages','general','guides','profiles',
  'database','home','updates','patches','content','records','entries'
]);
const RECORD_FIELDS=new Set([
  'id','type','title','name','description','desc','category','section',
  'group','link','url','icon','image','content','sort','order','class',
  'classes','expansion','tier','dungeon','raid','enabled','visible'
]);
function space(src,i){while(i<src.length&&/\s/.test(src[i]))i++;return i;}
function readJsString(src,position){
  const quote=src[position];
  if(quote!=='"'&&quote!=="'"&&quote!==String.fromCharCode(96))return null;
  let i=position+1,last=i;const parts=[];
  const simple={'0':'\0','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t','v':'\v'};
  for(;i<src.length;i++){
    const c=src[i];
    if(c===quote){parts.push(src.slice(last,i));return{value:parts.join(''),end:i+1,quoteKind:quote===String.fromCharCode(96)?'template':quote==='"'?'double':'single'};}
    if(quote===String.fromCharCode(96)&&c==='$'&&src[i+1]==='{')return null;
    if(c!=='\\')continue;
    parts.push(src.slice(last,i));
    const e=src[++i];let replacement;
    if(e===undefined)return null;
    if(e==='\n')replacement='';
    else if(e==='\r'){if(src[i+1]==='\n')i++;replacement='';}
    else if(e==='x'){
      const hex=src.slice(i+1,i+3);
      if(!/^[\da-fA-F]{2}$/.test(hex))return null;
      replacement=String.fromCharCode(parseInt(hex,16));i+=2;
    }else if(e==='u'){
      if(src[i+1]==='{'){
        const end=src.indexOf('}',i+2);if(end<0)return null;
        const hex=src.slice(i+2,end);if(!/^[\da-fA-F]{1,6}$/.test(hex))return null;
        const val=parseInt(hex,16);if(val>0x10ffff)return null;
        replacement=String.fromCodePoint(val);i=end;
      }else{
        const hex=src.slice(i+1,i+5);
        if(!/^[\da-fA-F]{4}$/.test(hex))return null;
        replacement=String.fromCharCode(parseInt(hex,16));i+=4;
      }
    }else if(/[1-9]/.test(e))return null;
    else replacement=Object.hasOwn(simple,e)?simple[e]:e;
    parts.push(replacement);
    last=i+1;
  }
  return null;
}
function typeOfValue(value){
  if(Array.isArray(value))return 'array';
  if(value===null)return 'null';
  return typeof value==='object'?'object':typeof value;
}
function aggregateArray(array){
  const shapes={object:0,array:0,string:0,number:0,boolean:0,null:0,other:0};
  const knownFields={}, ids=new Set();let duplicates=0,missingIds=0;
  for(const obj of array){
    const type=typeOfValue(obj);
    shapes[type]===undefined?shapes.other++:shapes[type]++;
    if(type!=='object')continue;
    const id=obj.id;
    if(id===undefined||id===null)missingIds++;
    else if(typeof id==='string'||typeof id==='number'){
      const key=String(id);if(ids.has(key))duplicates++;else ids.add(key);
    }else missingIds++;
    for(const key of Object.keys(obj)){
      if(RECORD_FIELDS.has(key))knownFields[key]=(knownFields[key]||0)+1;
    }
  }
  return {itemCount:array.length,types:shapes,knownFieldOccurrences:knownFields,
    objectRecordWithIdCount:ids.size,duplicateIdCount:duplicates,objectRecordMissingIdCount:missingIds};
}
function summarizeData(data){
  const t=typeOfValue(data);
  const report={rootType:t,directRootPropertyCount:null,
    rootArray:null,topLevelKnownKeys:{},unknownRootKeyCount:null,
    candidateCollections:[],collectionCandidateLimitReached:false};
  if(t==='array'){report.rootArray=aggregateArray(data);return report;}
  if(t!=='object')return report;
  const keys=Object.keys(data);
  report.directRootPropertyCount=keys.length;
  report.unknownRootKeyCount=keys.filter(x=>!KNOWN_TOP_KEYS.has(x)).length;
  for(const key of keys)if(KNOWN_TOP_KEYS.has(key))
    report.topLevelKnownKeys[key]=typeOfValue(data[key]);
  let attempts=0;
  function visit(value,level,parentKey){
    if(attempts>=50000){report.collectionCandidateLimitReached=true;return;}
    if(level>2||value===null||typeof value!=='object')return;
    attempts++;
    if(Array.isArray(value)){
      if(parentKey==='resources'||parentKey==='records'||parentKey==='entries'||parentKey==='items'){
        if(report.candidateCollections.length<35)
          report.candidateCollections.push({keyType:parentKey,nestingLevel:level,...aggregateArray(value)});
      }
      return;
    }
    for(const key of Object.keys(value)){
      if(level===0||key==='resources'||key==='records'||key==='entries'||key==='items'){
        visit(value[key],level+1,key);
      }
    }
  }
  visit(data,0,'root');
  return report;
}
function summarizeLexicalRecordObjects(source,segments){
  const fields={}, ids=new Set();
  let objects=0,withId=0,missingId=0,duplicateLiteralIds=0,unknownFields=0;
  let unparsedFields=0,nonliteralIds=0;
  for(const item of segments){
    const p=space(source,item[0]);
    if(source[p]!=='{')continue;
    objects++;
    const group=enclosingParts(source,p);
    let foundId=false;
    for(const range of group.segments){
      const field=property(source,range);
      if(!field.key){unparsedFields++;continue;}
      if(RECORD_FIELDS.has(field.key))
        fields[field.key]=(fields[field.key]||0)+1;
      else unknownFields++;
      if(field.key==='id'){
        foundId=true;
        const raw=source.slice(space(source,field.valueStart),range[1]).trim();
        // Only compare literal IDs, not expressions such as new Date() or calls.
        const literal=/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[0-9]+)$/.test(raw);
        if(!literal||raw.length>1024){nonliteralIds++;continue;}
        const hash=crypto.createHash('sha256').update(raw).digest('hex');
        if(ids.has(hash))duplicateLiteralIds++;else ids.add(hash);
      }
    }
    if(foundId)withId++;else missingId++;
  }
  return {objectItemsInspected:objects,withIdField:withId,missingIdField:missingId,
    verifiedLiteralIdUniqueness:false,lexicallyRepeatedIdLiterals:duplicateLiteralIds,
    uniqueLiteralIdHashes:ids.size,nonliteralIds,knownFieldOccurrences:fields,
    unknownFieldOccurrences:unknownFields,unparsedFieldOccurrences:unparsedFields};
}
function inspectJsonInitializer(bytes){
  const baseline=inspectSource(bytes);
  if(baseline.gitBlobSha!==MAIN_BASELINE_BLOB_SHA)
    throw new Error('Source baseline mismatch. Refusing to audit unverified content.');
  const report={reportFormat:'naxx-legacy-static-json-v1',sourceGitBlobSha:baseline.gitBlobSha,
    sourceVerified:true,initializerKind:'unknown',staticJsonDecoded:false,
    parsedJson:false,jsonUtf16Length:null,parseFailureClass:null,structure:null,
    argumentExpressionFamily:null,argumentLeadingCharCode:null,argumentSymbolAfterToken:null,
    argumentIdentifierCharCount:null,
    nestedArgumentKind:null,nestedArgumentLeadingCharCode:null,nestedIdentifierCharCount:null,
    nestedIsWindowProperty:false,nestedNextSymbolClass:null,nestedAssignmentCandidates:null,
    nestedAssignmentValueClass:null,
    nestedAssignmentsBeforeData:null,nestedAssignmentKinds:{},nestedStaticLiteralSummaries:[],
    resourceRecordsVerified:false,
    note:'Candidate arrays and ID counts require gameplay/editor relationship verification. Values and identifiers are never printed.'};
  const source=bytes.toString('utf8');
  const assignments=[...source.matchAll(/\b(?:const|let|var)\s+DATA\s*=/g)];
  if(assignments.length!==1){report.parseFailureClass='assignmentNotUnique';return report;}
  const start=space(source,assignments[0].index+assignments[0][0].length);
  const call=/^JSON\s*\.\s*parse\s*\(/.exec(source.slice(start,start+70));
  if(!call){report.parseFailureClass='notJsonParseCall';return report;}
  let at=space(source,start+call[0].length);
  report.argumentLeadingCharCode=source.charCodeAt(at);
  const argumentHead=source.slice(at,at+220);
  const allowedCalls=[
    'atob','decodeURIComponent','unescape','JSON.stringify',
    'document.getElementById','document.querySelector','localStorage.getItem',
    'String.raw','LZString.decompressFromBase64',
    'LZString.decompressFromEncodedURIComponent','pako.inflate'
  ];
  const id=/^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*/.exec(argumentHead);
  if(id){
    const key=id[0].replace(/\s/g,'');
    report.argumentIdentifierCharCount=key.length;
    report.argumentExpressionFamily=allowedCalls.includes(key)?key:'otherIdentifierExpression';
    const next=space(source,at+id[0].length);
    report.argumentSymbolAfterToken=source[next]==='('?'call':
      source[next]==='['?'index':source[next]==='.'?'property':'other';
  }else report.argumentExpressionFamily=source[at]==='('?'parenthesized':
    source[at]==='['?'array':'otherExpression';
  if(report.argumentExpressionFamily==='JSON.stringify' && report.argumentSymbolAfterToken==='call'){
    const prefix=/^JSON\s*\.\s*stringify\s*\(/.exec(source.slice(at,at+70));
    if(prefix){
      const inner=space(source,at+prefix[0].length);
      report.nestedArgumentLeadingCharCode=source.charCodeAt(inner);
      report.nestedArgumentKind=source[inner]==='{'?'objectLiteral':
        source[inner]==='['?'arrayLiteral':
        source[inner]==='('?'parenthesized':
        source[inner]==='"'||source[inner]==="'"?'quotedString':
        source[inner]===String.fromCharCode(96)?'templateLiteral':'otherExpression';
      if(report.nestedArgumentKind==='otherExpression'){
        const id=/^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*/.exec(source.slice(inner,inner+220));
        if(id){
          const full=id[0].replace(/\s/g,'');
          report.nestedIdentifierCharCount=full.length;
          report.nestedArgumentKind='identifierOrCall';
          report.nestedIsWindowProperty=/^window\.[A-Za-z_$][\w$]*$/.test(full);
          const afterId=space(source,inner+id[0].length);
          report.nestedNextSymbolClass=source[afterId]===')'?'closed':
            source[afterId]==='('?'call':
            source.slice(afterId,afterId+2)==='||'?'logicalOr':'otherExpression';
          if(report.nestedIsWindowProperty){
            let matches=0, before=0;
            for(let x=source.indexOf(full); x!==-1; x=source.indexOf(full,x+full.length)){
              const afterName=space(source,x+full.length);
              if(source[afterName]!=='=' || source[afterName+1]==='=' || source[afterName+1]==='>')continue;
              matches++;if(x<start)before++;
              const p=space(source,afterName+1);
              const valClass=source[p]==='{'?'objectLiteral':
                source[p]==='['?'arrayLiteral':
                source[p]==='"'||source[p]==="'"?'quotedString':
                source[p]===String.fromCharCode(96)?'templateLiteral':
                source[p]==='('?'parenthesized':'expression';
              report.nestedAssignmentKinds[valClass]=(report.nestedAssignmentKinds[valClass]||0)+1;
              if(valClass==='objectLiteral'||valClass==='arrayLiteral'){
                try{
                  const parts=enclosingParts(source,p);
                  const summary={kind:valClass,directMembers:parts.segments.length,
                    beforeDataAssignment:x<start};
                  if(valClass==='objectLiteral'){
                    let known=0,unknown=0,unparsed=0;
                    for(const range of parts.segments){
                      const field=property(source,range);
                      if(!field.key)unparsed++;
                      else if(KNOWN_TOP_KEYS.has(field.key))known++;else unknown++;
                    }
                    summary.allowedKeyCount=known;summary.unknownKeyCount=unknown;
                    summary.unparsedKeyCount=unparsed;
                    summary.memberValueTypes={object:0,array:0,string:0,numberLike:0,expression:0,other:0};
                    summary.recognizedKeyTypes={};
                    summary.directArrays=[];
                    summary.directArrayTotalElements=0;
                    for(let idx=0;idx<parts.segments.length;idx++){
                      const field=property(source,parts.segments[idx]);
                      if(!field.key)continue;
                      if(summary.memberValueTypes[field.type]!==undefined)
                        summary.memberValueTypes[field.type]++;
                      if(KNOWN_TOP_KEYS.has(field.key))
                        summary.recognizedKeyTypes[field.key]=field.type;
                      if(field.type==='array'){
                        const child=enclosingParts(source,space(source,field.valueStart));
                        let objects=0,strings=0,nestedArrays=0,other=0;
                        for(const item of child.segments){
                          const first=source[space(source,item[0])];
                          if(first==='{')objects++;
                          else if(first==='[')nestedArrays++;
                          else if(first==='"'||first==="'")strings++;
                          else other++;
                        }
                        const recordShape=objects>0 ? summarizeLexicalRecordObjects(source,child.segments) : null;
                        summary.directArrays.push({memberIndex:idx+1,itemCount:child.segments.length,
                          objectItems:objects,stringItems:strings,nestedArrayItems:nestedArrays,otherItems:other,
                          recordShape});
                        summary.directArrayTotalElements+=child.segments.length;
                      }
                    }
                  }
                  if(report.nestedStaticLiteralSummaries.length<6)
                    report.nestedStaticLiteralSummaries.push(summary);
                }catch(_){report.nestedAssignmentKinds.unparsedLiteral=
                  (report.nestedAssignmentKinds.unparsedLiteral||0)+1;}
              }
            }
            report.nestedAssignmentCandidates=matches;
            report.nestedAssignmentsBeforeData=before;
            if(matches===1)
              report.nestedAssignmentValueClass=Object.keys(report.nestedAssignmentKinds)[0]||null;
          }
        }
      }
    }
  }
  report.initializerKind=source[at]==='"'?'doubleQuoted':source[at]==="'"?'singleQuoted':
    source[at]===String.fromCharCode(96)?'template':'otherExpression';
  const literal=readJsString(source,at);
  if(!literal){report.parseFailureClass='notStaticStringLiteral';return report;}
  const after=space(source,literal.end);
  if(source[after]!==')'){report.parseFailureClass='additionalArgsOrDynamicExpression';return report;}
  report.staticJsonDecoded=true;
  report.jsonUtf16Length=literal.value.length;
  let parsed;
  try{parsed=JSON.parse(literal.value);}
  catch(_){report.parseFailureClass='invalidJsonString';return report;}
  report.parsedJson=true;
  report.structure=summarizeData(parsed);
  return report;
}
if(require.main===module){
  const filename=path.resolve(__dirname,'..','..','site-content.html');
  // A failure contains no source excerpts, keys, IDs or record values.
  try {process.stdout.write(JSON.stringify(inspectJsonInitializer(fs.readFileSync(filename)),null,2)+'\n');}
  catch(_) {process.stderr.write('Static JSON audit stopped safely. Source content was not printed.\n');process.exitCode=1;}
}
module.exports={readJsString,summarizeData,inspectJsonInitializer,summarizeLexicalRecordObjects};

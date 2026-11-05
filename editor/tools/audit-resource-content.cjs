'use strict';
/*
 * Aggregate-only, exact-baseline-verified content field audit.
 * No original resource values, IDs, names, URLs or literal source printed.
 * Never evaluates website JS, never writes to disk.
 */
const fs=require('node:fs');
const path=require('node:path');
const {splitInMemory}=require('./check-legacy-roundtrip.cjs');
const {enclosingParts,property}=require('./audit-legacy-shape.cjs');
const {readJsString}=require('./audit-legacy-json.cjs');
function space(s,i){while(i<s.length&&/\s/.test(s[i]))i++;return i;}
function literalValue(s,range,field){
  const begin=space(s,field.valueStart),parsed=readJsString(s,begin);
  if(!parsed||s.slice(parsed.end,range[1]).trim())
    throw Error('Resource content is not a supported literal.');
  return parsed.value;
}
function inspectContents(records){
  if(records.length!==414)throw Error('Unexpected content record count.');
  const lengths=[],bytes=[],tags=[];
  let missing=0,duplicates=0,empty=0,withMarkup=0,withLineBreaks=0,withControls=0,withScriptLike=0;
  for(const record of records){
    const obj=enclosingParts(record,space(record,0));
    let count=0;
    for(const range of obj.segments){
      const f=property(record,range);
      if(f.key!=='content')continue;
      count++;
      const value=literalValue(record,range,f);
      if(typeof value!=='string')throw Error('Content is not text.');
      lengths.push(value.length);
      bytes.push(Buffer.byteLength(value,'utf8'));
      if(!value.length)empty++;
      if(/<\s*\/?\s*[a-z][^>]*>/i.test(value))withMarkup++;
      if(/[\n\r]/.test(value))withLineBreaks++;
      if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))withControls++;
      if(/<\s*script\b/i.test(value))withScriptLike++;
    }
    if(count===0)missing++;
    if(count>1)duplicates++;
  }
  if(missing||duplicates||lengths.length!==414)throw Error('Invalid content-field inventory.');
  return {
    originalSourceVerified:true,readOnly:true,sourceCodeEvaluated:false,
    format:'naxx-legacy-resource-content-shape-v1',
    resourcesChecked:records.length,contentFields: lengths.length,
    emptyContentFields:empty,contentWithHtmlLikeMarkup:withMarkup,
    contentWithLineBreaks:withLineBreaks,
    contentWithControlCharacters:withControls,
    contentWithScriptTagLikeMarkup:withScriptLike,
    minDecodedCharacters:Math.min(...lengths),maxDecodedCharacters:Math.max(...lengths),
    minDecodedUtf8Bytes:Math.min(...bytes),maxDecodedUtf8Bytes:Math.max(...bytes),
    totalDecodedUtf8Bytes:bytes.reduce((a,b)=>a+b,0),
    contentValuesOrResourceIdentifiersEmitted:false,
    caveat:'Shape and literal data only. Does not establish safety or behaviour of any HTML markup.'
  };
}
function audit(bytes){
  const original=splitInMemory(bytes); // protected full baseline verified first
  return inspectContents(original.records);
}
if(require.main===module){
  try{
    const file=path.resolve(__dirname,'..','..','site-content.html');
    process.stdout.write(JSON.stringify(audit(fs.readFileSync(file)),null,2)+'\n');
  }catch(_){
    process.stderr.write('Original content audit stopped without printing website data.\n');
    process.exitCode=1;
  }
}
module.exports={audit,inspectContents};

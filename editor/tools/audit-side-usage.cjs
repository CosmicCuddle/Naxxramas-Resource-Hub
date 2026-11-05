'use strict';
/*
 * Candidate code-usage counts for original DATA collection properties.
 * Baseline-verified, lexical only: not a runtime dependency graph.
 * Does not execute JS or emit property names, content, expressions, URLs, IDs.
 */
const fs=require('node:fs');
const path=require('node:path');
const {findSideCollection}=require('./audit-side-collection.cjs');

function escapeRegExp(x){return x.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');}
function skipQuoted(js,i) {
  const q=js[i];i++;
  while(i<js.length){
    if(js[i]==='\\'){i+=2;continue;}
    if(js[i]===q)return i+1;
    i++;
  }
  return js.length;
}
function codeSpans(js) {
  const spans=[];
  let i=0,begin=0;
  while(i<js.length) {
    const c=js[i],n=js[i+1];
    const string=c==='"'||c==="'"||c===String.fromCharCode(96);
    const lineComment=c==='/'&&n==='/';
    const blockComment=c==='/'&&n==='*';
    if(!string&&!lineComment&&!blockComment){i++;continue;}
    if(begin<i)spans.push([begin,i]);
    if(string)i=skipQuoted(js,i);
    else if(lineComment) {const end=js.indexOf('\n',i+2);i=end<0?js.length:end+1;}
    else{const end=js.indexOf('*/',i+2);i=end<0?js.length:end+2;}
    begin=i;
  }
  if(begin<js.length)spans.push([begin,js.length]);
  return spans;
}
function inCode(spans,offset) {
  let low=0,high=spans.length-1;
  while(low<=high) {
    const mid=(low+high)>>1;
    if(offset<spans[mid][0])high=mid-1;
    else if(offset>=spans[mid][1])low=mid+1;
    else return true;
  }
  return false;
}
function countAccesses(js,key) {
  const escaped=escapeRegExp(key);
  // Starts must be in code. Bracket-quoted keys are allowed because the token
  // after DATA[ is meant to be a literal string within an access expression.
  const dot=new RegExp('\\bDATA\\s*\\.\\s*'+escaped+'\\b','g');
  const bracket=new RegExp('\\bDATA\\s*\\[\\s*(["\\x27])'+escaped+'\\1\\s*\\]','g');
  const spans=codeSpans(js);
  let dotCandidates=0,bracketCandidates=0;
  for(const m of js.matchAll(dot)) if(inCode(spans,m.index))dotCandidates++;
  for(const m of js.matchAll(bracket)) if(inCode(spans,m.index))bracketCandidates++;
  return {dotCandidates,bracketCandidates,totalCandidates:dotCandidates+bracketCandidates};
}
function summarizeScriptReferences(source,sideKey,resourceKey='resources') {
  if(!/^[A-Za-z_$][\w$-]*$/.test(sideKey)||!/^[A-Za-z_$][\w$-]*$/.test(resourceKey))
    throw new Error('Unexpected collection property syntax.');
  const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  let sideDot=0,sideBracket=0,resourceDot=0,resourceBracket=0;
  for(const match of scripts){
    const js=match[1];
    const side=countAccesses(js,sideKey);
    const resource=countAccesses(js,resourceKey);
    sideDot+=side.dotCandidates;sideBracket+=side.bracketCandidates;
    resourceDot+=resource.dotCandidates;resourceBracket+=resource.bracketCandidates;
  }
  return {
    scanMethod:'lexical candidate counting in inline script blocks only',
    inlineScriptBlocksScanned:scripts.length,
    sideCollectionCandidateDotAccesses:sideDot,
    sideCollectionCandidateBracketAccesses:sideBracket,
    mainResourcesCandidateDotAccesses:resourceDot,
    mainResourcesCandidateBracketAccesses:resourceBracket,
    identifiersOrSourceValuesEmitted:false,
    limitations:'May miss aliases, computed property access, external JS or runtime mutations; regex literals and non-code template syntax can produce false candidates. Counts alone do not prove dependencies.'
  };
}
function audit(bytes) {
  const found=findSideCollection(bytes);
  const output=summarizeScriptReferences(found.source,found.internalPropertyKey);
  if(output.inlineScriptBlocksScanned===0)throw new Error('Unexpected script-free source.');
  return {originalSourceVerified:true,readOnly:true,sourceCodeExecuted:false,...output};
}
if(require.main===module) {
  try{
    const file=path.resolve(__dirname,'..','..','site-content.html');
    process.stdout.write(JSON.stringify(audit(fs.readFileSync(file)),null,2)+'\n');
  }catch(_){
    process.stderr.write('Side-collection code-usage audit stopped without exposing source content.\n');
    process.exitCode=1;
  }
}
module.exports={audit,countAccesses,summarizeScriptReferences,codeSpans,inCode};

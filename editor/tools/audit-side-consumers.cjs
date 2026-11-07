'use strict';
/*
 * Read-only, baseline-verified scan of possible accesses to the two original
 * DATA collections. The classifications are syntactic hints, NOT proof that
 * the corresponding browser paths run or that indirect writes cannot occur.
 * No source code, property keys, IDs, user data or snippets are printed.
 */
const fs=require('node:fs');
const path=require('node:path');
const {findSideCollection}=require('./audit-side-collection.cjs');
const {codeSpans,inCode,countAccesses}=require('./audit-side-usage.cjs');

const DIRECT=/^\s*(?:\+\+|--|(?:(?:\?\?|\|\||&&|[+\-*\/%&|^])?=(?!=|>)))/;
const MUTATOR=/^\s*(?:\?\.|\.)\s*(?:push|pop|shift|unshift|splice|sort|reverse|copyWithin|fill)\s*\(/;
const MEMBER=/^\s*(?:\s*\[[^\]\n]{1,120}\]|\s*\.\s*[A-Za-z_$][\w$]*){1,3}\s*(?:\+\+|--|(?:(?:\?\?|\|\||&&|[+\-*\/%&|^])?=(?!=|>)))/;
function escaped(word) {
  if(!/^[A-Za-z_$][\w$]*$/.test(word))throw new Error('Unexpected source identifier.');
  return word.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
}
function suffixInCode(js,after,spans,limit=240) {
  let result='';
  for(let pos=after;pos<Math.min(js.length,after+limit);pos++)
    result+=inCode(spans,pos)?js[pos]:' ';
  return result;
}
function classify(js,after,spans) {
  const tail=suffixInCode(js,after,spans);
  if(DIRECT.test(tail))return 'directReassignmentCandidates';
  if(MUTATOR.test(tail))return 'directMutatorCallCandidates';
  if(MEMBER.test(tail))return 'memberAssignmentCandidates';
  return 'otherAccessCandidates';
}
function candidatesInScript(js,key){
  const identifier=escaped(key);
  const patterns=[
    new RegExp('\\bDATA\\s*\\.\\s*'+identifier+'\\b','g'),
    new RegExp('\\bDATA\\s*\\[\\s*(["\\x27])'+identifier+'\\1\\s*\\]','g')
  ];
  const counts={
    directReassignmentCandidates:0,
    directMutatorCallCandidates:0,
    memberAssignmentCandidates:0,
    otherAccessCandidates:0
  };
  const spans=codeSpans(js);
  for(const pattern of patterns){
    for(const found of js.matchAll(pattern)){
      if(!inCode(spans,found.index))continue;
      counts[classify(js,found.index+found[0].length,spans)]++;
    }
  }
  const sum=Object.values(counts).reduce((a,b)=>a+b,0);
  if(sum!==countAccesses(js,key).totalCandidates)
    throw new Error('Candidate accounting mismatch.');
  return counts;
}
function summarize(source,sideKey,resourceKey='resources') {
  const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  if(scripts.length===0)throw new Error('No inline scripts to scan.');
  const side={directReassignmentCandidates:0,directMutatorCallCandidates:0,memberAssignmentCandidates:0,otherAccessCandidates:0};
  const resources={...side};
  let scriptsWithSide=0,scriptsWithResources=0,scriptsWithBoth=0;
  for(const match of scripts) {
    const a=candidatesInScript(match[1],sideKey);
    const b=candidatesInScript(match[1],resourceKey);
    const aSum=Object.values(a).reduce((x,y)=>x+y,0);
    const bSum=Object.values(b).reduce((x,y)=>x+y,0);
    if(aSum)scriptsWithSide++;
    if(bSum)scriptsWithResources++;
    if(aSum&&bSum)scriptsWithBoth++;
    for(const name of Object.keys(side)){side[name]+=a[name];resources[name]+=b[name];}
  }
  return {
    format:'naxx-legacy-collection-consumer-candidates-v1',
    readOnly:true,sourceCodeExecuted:false,
    inlineScriptBlocks:scripts.length,
    scriptsWithSideCandidates:scriptsWithSide,
    scriptsWithResourceCandidates:scriptsWithResources,
    scriptsWithBothCandidates:scriptsWithBoth,
    sideCollection:side,
    mainResources:resources,
    privateKeysOrValuesEmitted:false,
    disclaimer:'Only lexical candidates in inline scripts. Direct assignment and known-mutator syntax are possible writes, not proven execution. Other-access candidates may conceal alias writes, computed access, DOM updates or external code.'
  };
}
function audit(bytes) {
  const found=findSideCollection(bytes); // original Git blob verified
  return {originalSourceVerified:true,...summarize(found.source,found.internalPropertyKey)};
}
if(require.main===module) {
  try{
    const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(audit(bytes),null,2)+'\n');
  }catch(_){
    process.stderr.write('Legacy consumer candidate audit stopped safely. No source details printed.\n');
    process.exitCode=1;
  }
}
module.exports={audit,summarize,candidatesInScript};

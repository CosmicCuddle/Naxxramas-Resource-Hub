'use strict';
/* Read-only lexical shape report of existing DATA literal. No eval, source logs, or writes. */
const fs = require('node:fs');
const path = require('node:path');
const {inspectSource, MAIN_BASELINE_BLOB_SHA} = require('./inspect-legacy.cjs');

const ALLOWED_KEYS = new Set([
  'resources','categories','sections','classes','dungeons','raids',
  'addons','items','groups','pages','general','guides','profiles',
  'database','home','updates','patches','content','records','entries'
]);
function whitespace(source, p) {
  while (p < source.length && /\s/.test(source[p])) p++;
  return p;
}
function skipString(source, from) {
  const q = source[from];
  let i = from + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === q) return i + 1;
    i++;
  }
  throw new Error('Unterminated quoted text; no structural count can be trusted.');
}
function skipComment(source, i) {
  if (source[i] !== '/') return i;
  if (source[i + 1] === '/') {
    const end = source.indexOf('\n', i + 2);
    return end < 0 ? source.length : end + 1;
  }
  if (source[i + 1] === '*') {
    const end = source.indexOf('*/', i + 2);
    if (end < 0) throw new Error('Unterminated comment.');
    return end + 2;
  }
  return i;
}
const matching = { '{':'}', '[':']', '(':')' };
function enclosingParts(source, from, cap = 250000) {
  const open = source[from];
  if (!matching[open]) throw new Error('Expected object, array, or group.');
  const stack = [matching[open]];
  const segments = [];
  let start = from + 1, i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === String.fromCharCode(96)) { i = skipString(source, i); continue; }
    const afterComment = skipComment(source, i);
    if (afterComment !== i) { i = afterComment; continue; }
    if (matching[ch]) stack.push(matching[ch]);
    else if (ch === '}' || ch === ']' || ch === ')') {
      if (stack.pop() !== ch) throw new Error('Mismatched closing delimiter.');
      if (!stack.length) {
        if (source.slice(start, i).trim()) segments.push([start,i]);
        return {close:i, segments};
      }
    } else if (ch === ',' && stack.length === 1) {
      if (source.slice(start, i).trim()) segments.push([start,i]);
      if (segments.length > cap) throw new Error('Excessive number of members.');
      start = i + 1;
    }
    i++;
  }
  throw new Error('Unclosed literal structure.');
}
function kind(source, offset) {
  const p = whitespace(source,offset);
  const c = source[p];
  if (c === '{') return 'object';
  if (c === '[') return 'array';
  if (c === '"' || c === "'" || c === String.fromCharCode(96)) return 'string';
  if (/[0-9+-]/.test(c || '')) return 'numberLike';
  if (/[a-zA-Z_$]/.test(c || '')) return 'expression';
  return 'other';
}
function property(source, range) {
  const start = whitespace(source, range[0]);
  const snippet = source.slice(start,Math.min(start+200,range[1]));
  const match = /^(?:(['"])([a-zA-Z_$][\w$-]*)\1|([a-zA-Z_$][\w$]*))\s*:/.exec(snippet);
  if (!match) return {key:null,valueStart:start,type:'unparsed'};
  const key = match[2] || match[3];
  return {key, valueStart:start+match[0].length, type:kind(source,start+match[0].length)};
}
function arraySummary(source,from) {
  const parts = enclosingParts(source,whitespace(source,from));
  const kinds = {object:0,array:0,string:0,numberLike:0,expression:0,other:0};
  for (const item of parts.segments) kinds[kind(source,item[0])]++;
  return {lexicalItems:parts.segments.length, directItemTypes:kinds};
}
function analyzeStructure(bytes) {
  const base = inspectSource(bytes);
  if (base.gitBlobSha !== MAIN_BASELINE_BLOB_SHA) {
    throw new Error('Original site-content.html no longer matches the approved Git blob. Aborting.');
  }
  const source = bytes.toString('utf8');
  const matches = [...source.matchAll(/\b(?:const|let|var)\s+DATA\s*=/g)];
  const report = {
    reportFormat:'naxx-legacy-shape-v1', sourceGitBlobSha:base.gitBlobSha,
    verifiedBaseline:true, assignmentCandidates:matches.length,
    candidateRootType:'unknown', initializerCharCode:null,
    initializerTokenClass:'unclassified', initializerWordLength:null,
    initializerNextSymbolClass:null,
    parseMethod:'read-only lexical scan; no JavaScript execution',
    directRootMembers:null, permittedTopLevelKeyMatches:{},
    unknownTopLevelPropertyCount:null, unparsedTopLevelMemberCount:null,
    directTopLevelArrayItems:null, arrayItemShapes:null,
    resourceCollectionCandidates:[], resourceRecordsVerified:false, resourceRecordCount:null,
    limits:'Syntactic member counts do not prove semantic records or valid relationships.'
  };
  if (matches.length !== 1) return report;
  const p = whitespace(source,matches[0].index+matches[0][0].length);
  const first = source[p];
  report.initializerCharCode = source.charCodeAt(p);
  if (first === '{' || first === '[') {
    report.initializerTokenClass = 'literal';
  } else if (first === '(') {
    report.initializerTokenClass = 'parenthesis';
  } else if (first === '"' || first === "'") {
    report.initializerTokenClass = 'string';
  } else {
    const prefix = source.slice(p,p+240);
    const word = /^([A-Za-z_$][\w$]*)(?:\s*\.\s*[A-Za-z_$][\w$]*)*/.exec(prefix);
    if (word) {
      report.initializerTokenClass = 'identifierOrPropertyExpression';
      report.initializerWordLength = word[0].replace(/\s/g,'').length;
      let after = whitespace(source,p+word[0].length);
      report.initializerNextSymbolClass = source[after] === '(' ? 'call' :
        source[after] === '[' ? 'indexed' : source[after] === '?' ? 'conditional' :
        source[after] === '.' ? 'property' : 'other';
      if (/^JSON\s*\.\s*parse\b/.test(word[0])) report.initializerTokenClass = 'jsonParseCall';
      if (/^Object\s*\.\s*freeze\b/.test(word[0])) report.initializerTokenClass = 'frozenObject';
      if (/^function\b/.test(word[0])) report.initializerTokenClass = 'function';
    } else report.initializerTokenClass = 'otherExpression';
  }
  if (first !== '{' && first !== '[') {
    report.candidateRootType = 'expression';
    return report;
  }
  const rootType = report.candidateRootType = first === '{' ? 'object' : 'array';
  const root = enclosingParts(source,p);
  report.directRootMembers = root.segments.length;
  if (rootType === 'array') {
    report.directTopLevelArrayItems = root.segments.length;
    report.arrayItemShapes = arraySummary(source,p).directItemTypes;
    return report;
  }
  let unknown = 0, unparsed = 0;
  for (const seg of root.segments) {
    const prop = property(source,seg);
    if (!prop.key) { unparsed++; continue; }
    if (ALLOWED_KEYS.has(prop.key)) {
      report.permittedTopLevelKeyMatches[prop.key] = (report.permittedTopLevelKeyMatches[prop.key]||0)+1;
    } else unknown++;
    if (prop.key === 'resources' && prop.type === 'array') {
      report.resourceCollectionCandidates.push({nestingLevel:1,containerType:'array',
        ...arraySummary(source,prop.valueStart)});
    }
    if (prop.type === 'object') {
      const group = enclosingParts(source,whitespace(source,prop.valueStart),200000);
      for (const inner of group.segments) {
        const child = property(source,inner);
        if (child.key === 'resources' && child.type === 'array') {
          report.resourceCollectionCandidates.push({nestingLevel:2,containerType:'array',
            ...arraySummary(source,child.valueStart)});
        }
      }
    }
  }
  report.unknownTopLevelPropertyCount = unknown;
  report.unparsedTopLevelMemberCount = unparsed;
  return report;
}
if (require.main === module) {
  const filename = path.resolve(__dirname,'..','..','site-content.html');
  const report = analyzeStructure(fs.readFileSync(filename));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
module.exports = {analyzeStructure,enclosingParts,property,kind};

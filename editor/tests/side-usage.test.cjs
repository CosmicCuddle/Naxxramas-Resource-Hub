'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {audit,countAccesses,summarizeScriptReferences}=require('../tools/audit-side-usage.cjs');

test('counts direct DATA property accesses while excluding quoted text and comments',()=>{
  const js=[
    'let a=DATA.side; let b=DATA["side"]; let c=DATA[\'side\'];',
    'const quote="DATA.side"; // DATA.side',
    '/* DATA["side"] */',
    'let other=DATA.resources;'
  ].join('\n');
  const a=countAccesses(js,'side');
  assert.equal(a.dotCandidates,1);
  assert.equal(a.bracketCandidates,2);
  const b=countAccesses(js,'resources');
  assert.equal(b.dotCandidates,1);
  assert.equal(b.bracketCandidates,0);
});

test('scan reports only aggregate counts and does not claim runtime proof',()=>{
  const html='<script>let x=DATA.side;let y=DATA.resources;</script><style>DATA.side</style><script>let s="DATA.side";</script>';
  const report=summarizeScriptReferences(html,'side');
  assert.equal(report.inlineScriptBlocksScanned,2);
  assert.equal(report.sideCollectionCandidateDotAccesses,1);
  assert.equal(report.mainResourcesCandidateDotAccesses,1);
  assert.equal(report.identifiersOrSourceValuesEmitted,false);
  assert.ok(!JSON.stringify(report).includes('DATA.side'));
  assert.throws(()=>summarizeScriptReferences(html,'../../secret'));
});

test('full baseline side collection has safe code-usage candidate report',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  const report=audit(bytes);
  assert.equal(report.originalSourceVerified,true);
  assert.equal(report.sourceCodeExecuted,false);
  assert.equal(report.identifiersOrSourceValuesEmitted,false);
  assert.ok(report.inlineScriptBlocksScanned>0);
  assert.ok(Number.isSafeInteger(report.sideCollectionCandidateDotAccesses));
  assert.ok(Number.isSafeInteger(report.mainResourcesCandidateDotAccesses));
  assert.ok(!Object.hasOwn(report,'sideKey'));
});

test('reference report rejects an altered baseline',()=>{
  const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  assert.throws(()=>audit(Buffer.concat([original,Buffer.from('z')])),/fingerprint|Unexpected|Aborting/i);
});
